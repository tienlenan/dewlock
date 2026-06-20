/**
 * Conversation persistence (server-only).
 *
 * Two stores, clean split of concerns:
 *  - CONTENT → a Walrus blob per conversation (immutable, content-addressed). The
 *    messages are Seal-encrypted client-side (`enc`); the server stores them opaquely.
 *  - INDEX → an Upstash Redis HASH per wallet listing {id, blobId, titleEnc,
 *    createdAt, updatedAt}. Exact key-value (HGETALL/HSET/HDEL/DEL) — the source of
 *    truth for enumeration, with no indexing lag and no shared rate limit.
 *
 * The index used to live in memwal (a semantic vector store): ~30-43s indexing lag
 * and a relayer rate limit shared app-wide made list/read/delete slow + flaky. memwal
 * is no longer on the conversation path; Redis is authoritative, so a delete is a plain
 * HDEL with no resurrection and no tombstone bookkeeping.
 *
 * Titles are encrypted client-side (`titleEnc`) — the server never sees a plaintext
 * title, preserving the Seal "server can't read conversations" posture even though the
 * list read is open. Per-wallet isolation is the Redis key itself.
 *
 * Fail-soft on READ (list→[], get→null when unavailable). On WRITE, "saved" is reported
 * only AFTER the Redis index write confirms (report-after-HSET) — a failed index write
 * returns ok:false so the caller retries rather than believing an orphan blob persisted.
 */

import { publishJsonBlob, readJsonBlob } from "@dewlock/walrus";
import {
  kvGetIndex,
  kvUpsertEntry,
  kvDeleteEntry,
  kvClearIndex,
  isKvConfigured,
  type KvIndexEntry,
} from "./index-kv";
import type { SerializableMessage } from "./serialize";

/** Wire/Redis index entry — title is CIPHERTEXT (client-encrypted). */
export type ConversationIndexEntry = KvIndexEntry;

export interface ConversationRecord {
  id: string;
  walletAddress: string;
  createdAt: number;
  updatedAt: number;
  /** Plaintext serialized messages (legacy; omitted when `enc` is present). */
  messages?: SerializableMessage[];
  /** Seal-encrypted ciphertext (tagged base64, "dseal1:…"); server stores opaquely. */
  enc?: string;
}

/** List a wallet's conversations (newest first; titles are ciphertext). */
export async function listConversations(wallet: string): Promise<ConversationIndexEntry[]> {
  if (!isKvConfigured()) return [];
  try {
    return await kvGetIndex(wallet);
  } catch {
    return [];
  }
}

/** Read a full conversation by id (null when missing / unavailable). */
export async function getConversation(wallet: string, id: string): Promise<ConversationRecord | null> {
  if (!isKvConfigured()) return null;
  try {
    const entry = (await kvGetIndex(wallet)).find((c) => c.id === id);
    if (!entry) return null;
    return await readJsonBlob<ConversationRecord>(entry.blobId);
  } catch {
    return null;
  }
}

/**
 * Fast path: read a conversation directly from a known blobId, skipping the index
 * (the client already has the blobId from the list). Verifies the record belongs to
 * the wallet (defense against a forged blobId pointing at another wallet's blob).
 */
export async function getConversationByBlob(
  wallet: string,
  blobId: string,
): Promise<ConversationRecord | null> {
  try {
    const record = await readJsonBlob<ConversationRecord>(blobId);
    if (!record || record.walletAddress !== wallet) return null;
    return record;
  } catch {
    return null;
  }
}

/**
 * Persist (insert/replace) a conversation. The content blob is published to Walrus
 * first; "saved" (ok:true) is reported only after the Redis index write confirms.
 * `titleEnc` is the client-encrypted title stored in the index (never on the blob).
 */
export async function upsertConversation(
  record: ConversationRecord,
  titleEnc: string,
): Promise<{ ok: boolean; blobId?: string; reason?: string }> {
  if (!isKvConfigured()) return { ok: false, reason: "unconfigured" };

  let blobId: string;
  try {
    const ptr = await publishJsonBlob("dewlock-conversation", record);
    if (!ptr.blobId) return { ok: false, reason: "blob" };
    blobId = ptr.blobId;
  } catch {
    return { ok: false, reason: "blob" };
  }

  // report-after-HSET: an orphan blob (published but unindexed) expires naturally on
  // Walrus; never claim "saved" until the durable index write succeeds.
  try {
    const res = await kvUpsertEntry(record.walletAddress, {
      id: record.id,
      blobId,
      titleEnc,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
    if (!res.ok) return { ok: false, blobId, reason: res.reason };
    return { ok: true, blobId };
  } catch {
    return { ok: false, blobId, reason: "index" };
  }
}

/** Drop a conversation from the index (the content blob stays immutably on Walrus). */
export async function removeConversation(wallet: string, id: string): Promise<boolean> {
  if (!isKvConfigured()) return false;
  try {
    await kvDeleteEntry(wallet, id);
    return true;
  } catch {
    return false;
  }
}

/** Drop ALL of a wallet's conversations in one atomic index delete. */
export async function clearConversations(wallet: string): Promise<boolean> {
  if (!isKvConfigured()) return false;
  try {
    await kvClearIndex(wallet);
    return true;
  } catch {
    return false;
  }
}
