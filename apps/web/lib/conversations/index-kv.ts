import "server-only";

/**
 * Upstash Redis conversation index (server-only, REST → serverless-safe).
 *
 * One HASH per wallet, `convo:idx:<wallet>` (wallet lowercased):
 *   field = conversationId
 *   value = { blobId, titleEnc, createdAt, updatedAt }   ← title is CIPHERTEXT
 *
 * Redis is the single source of truth for enumeration: list = HGETALL, upsert =
 * HSET, delete = HDEL, clear = DEL. Exact key-value (no semantic recall, no
 * indexing lag) — the whole reason we moved off memwal for the conversation index.
 * The REST token is read here and never leaves the server (this module + the API
 * route are the only callers; `server-only` throws if a client bundle imports it).
 *
 * `titleEnc` is encrypted client-side (see title-crypto.ts) so an open list read
 * exposes only ciphertext titles + Seal-protected blobIds — the server can't read
 * either, preserving the Seal "server can't read conversations" posture.
 */

import { Redis } from "@upstash/redis";

export interface KvIndexEntry {
  id: string;
  blobId: string;
  /** Client-encrypted title (base64 iv+ciphertext). Server never sees plaintext. */
  titleEnc: string;
  createdAt: number;
  updatedAt: number;
}

/** Stored HASH value — `id` is the field name, so it is omitted from the value. */
type StoredValue = Omit<KvIndexEntry, "id">;

const KEY = (wallet: string) => `convo:idx:${wallet.toLowerCase()}`;
/** Per-wallet field ceiling — a sane upper bound that also caps a cost-burn attack. */
const MAX_FIELDS = 2000;
/** Reject absurd ciphertext titles (a normal AES-GCM title is < ~1 KB). */
const MAX_TITLE_ENC = 8192;

function creds(): { url?: string; token?: string } {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
  };
}

/** True when Upstash REST creds are present (either env-var pair). */
export function isKvConfigured(): boolean {
  const { url, token } = creds();
  return Boolean(url && token);
}

let client: Redis | null = null;
function getRedis(): Redis {
  if (client) return client;
  const { url, token } = creds();
  if (!url || !token) {
    throw new Error(
      "Upstash Redis not configured — set UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN).",
    );
  }
  client = new Redis({ url, token });
  return client;
}

/** Normalize a HASH value the SDK may hand back already-parsed or as a JSON string. */
function parseValue(raw: unknown): StoredValue | null {
  const v = typeof raw === "string" ? safeJson(raw) : raw;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.blobId !== "string" || typeof o.titleEnc !== "string") return null;
  return {
    blobId: o.blobId,
    titleEnc: o.titleEnc,
    createdAt: Number(o.createdAt) || 0,
    updatedAt: Number(o.updatedAt) || 0,
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** List a wallet's index entries, newest first. */
export async function kvGetIndex(wallet: string): Promise<KvIndexEntry[]> {
  const map = await getRedis().hgetall<Record<string, unknown>>(KEY(wallet));
  if (!map) return [];
  const out: KvIndexEntry[] = [];
  for (const [id, raw] of Object.entries(map)) {
    const v = parseValue(raw);
    if (v) out.push({ id, ...v });
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

/**
 * Insert/replace one entry. Returns ok=false (never throws for these) when the
 * write is rejected by a guard:
 *  - `title too large`  → titleEnc over the cap (abuse).
 *  - `index full`       → a NEW id would exceed MAX_FIELDS (abuse / runaway).
 *  - `stale`            → updatedAt strictly older than the stored value
 *                         (rollback/replay guard; equal is allowed for idempotent retries).
 * Network/credential failures DO throw → the caller surfaces a hard save error
 * (report-after-HSET: never report "saved" on a failed index write).
 */
export async function kvUpsertEntry(
  wallet: string,
  entry: KvIndexEntry,
): Promise<{ ok: boolean; reason?: string }> {
  if (entry.titleEnc.length > MAX_TITLE_ENC) return { ok: false, reason: "title too large" };
  const redis = getRedis();
  const key = KEY(wallet);

  const cur = parseValue(await redis.hget<unknown>(key, entry.id));
  if (cur && entry.updatedAt < cur.updatedAt) return { ok: false, reason: "stale" };
  if (!cur && (await redis.hlen(key)) >= MAX_FIELDS) return { ok: false, reason: "index full" };

  const { id, ...value } = entry;
  await redis.hset(key, { [id]: value });
  return { ok: true };
}

/** Remove one entry (idempotent). */
export async function kvDeleteEntry(wallet: string, id: string): Promise<void> {
  await getRedis().hdel(KEY(wallet), id);
}

/** Drop a wallet's entire index (cutover clear + user "clear all"). */
export async function kvClearIndex(wallet: string): Promise<void> {
  await getRedis().del(KEY(wallet));
}
