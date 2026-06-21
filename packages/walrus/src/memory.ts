/**
 * Dewlock Walrus Memory wrapper — thin layer over @mysten-incubation/memwal 0.0.7.
 * Namespace prefix changed from "daily-walrus:" to "dewlock:" to isolate per-app memories.
 *
 * API surface: isMemoryEnabled, memNamespace, remember, rememberBulk, recall, memoryHealth.
 * NOTE: memwal is the MUTABLE memory layer (risk profiles, contacts, decision logs).
 * Tamper-evidence/immutability is provided by Walrus Blob + Sui HEAD pointer — NOT memwal.
 */

import { MemWal } from "@mysten-incubation/memwal";

const RELAYER_URL =
  process.env.MEMWAL_RELAYER_URL ?? "https://relayer.memory.walrus.xyz";

/** Memory is only available after provisioning (MEMWAL_ACCOUNT_ID + MEMWAL_DELEGATE_KEY set). */
export function isMemoryEnabled(): boolean {
  return Boolean(
    process.env.MEMWAL_ACCOUNT_ID && process.env.MEMWAL_DELEGATE_KEY,
  );
}

/**
 * Per-user namespace. Each wallet address gets an isolated memory partition
 * within the shared MemWal account.
 */
export function memNamespace(walletAddr: string): string {
  return `dewlock:${walletAddr}`;
}

// Cache clients by namespace to avoid re-creating on every call.
const clients = new Map<string, MemWal>();

function clientFor(namespace: string): MemWal {
  let c = clients.get(namespace);
  if (!c) {
    c = MemWal.create({
      key: process.env.MEMWAL_DELEGATE_KEY as string,
      accountId: process.env.MEMWAL_ACCOUNT_ID as string,
      serverUrl: RELAYER_URL,
      namespace,
    });
    clients.set(namespace, c);
  }
  return c;
}

interface RecallItemLike {
  text?: string;
  content?: string;
  memory?: string;
  snippet?: string;
}

/**
 * Max time we BLOCK a caller (e.g. a serverless route) waiting for memwal to confirm
 * indexing. rememberAndWait can block 30-43s on a busy/cold relayer — well past a 60s
 * function budget once other work is added — which surfaced as a "save to memwal" error
 * (esp. the first write on a fresh wallet namespace). We submit the write and wait only
 * up to this bound, then return and let indexing finish in the background.
 */
const REMEMBER_WAIT_MS = 12_000;

/**
 * Write one memory entry. Best-effort + fail-soft + bounded: never blocks the caller past
 * REMEMBER_WAIT_MS and never throws on a slow/failed relayer (memwal is the MUTABLE,
 * best-effort layer — durability lives in the Walrus blob + Sui pointer). No-op when memwal
 * is not configured. The submit is dispatched immediately; we stop AWAITING after the bound,
 * but the underlying promise keeps running so indexing still completes server-side.
 */
export async function remember(
  namespace: string,
  text: string,
): Promise<void> {
  if (!isMemoryEnabled() || !text.trim()) return;
  // .catch on the underlying write so a late rejection (after we stop waiting) is handled,
  // never an unhandled rejection; log so a real relayer outage is still visible in logs.
  const write = clientFor(namespace)
    .rememberAndWait(text)
    .catch((err: unknown) => {
      console.warn("[memwal] remember failed (fail-soft):", err instanceof Error ? err.message : String(err));
    });
  await Promise.race([write, new Promise<void>((resolve) => setTimeout(resolve, REMEMBER_WAIT_MS))]);
}

/**
 * Bulk-write memory entries in batches of 20 (memwal API limit).
 * Returns job IDs for optional polling.
 */
export async function rememberBulk(
  namespace: string,
  texts: string[],
): Promise<{ jobIds: string[]; total: number }> {
  const clean = texts.map((t) => t.trim()).filter(Boolean);
  if (!isMemoryEnabled() || clean.length === 0) return { jobIds: [], total: 0 };
  const jobIds: string[] = [];
  for (let i = 0; i < clean.length; i += 20) {
    const accepted = await clientFor(namespace).rememberBulk(
      clean.slice(i, i + 20).map((text) => ({ text, namespace })),
    );
    jobIds.push(...accepted.job_ids);
  }
  return { jobIds, total: clean.length };
}

/** Recall relevant memories for a query. Returns up to topK text strings. */
export async function recall(
  namespace: string,
  query: string,
  topK = 5,
): Promise<string[]> {
  if (!isMemoryEnabled()) return [];
  // Pass the limit through — the SDK defaults to 10 when omitted, which silently
  // caps every recall at ~10 hits regardless of topK. For append-only pointer
  // streams (e.g. the conversation index) the newest entry then often falls
  // outside the returned set, so "latest by timestamp" reads stale.
  const res = (await clientFor(namespace).recall({ query, limit: topK })) as {
    results?: RecallItemLike[];
  };
  const items = res?.results ?? [];
  return items
    .map((r) => r.text ?? r.content ?? r.memory ?? r.snippet ?? "")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, topK);
}

/**
 * Recall entries for a category and keep only those whose text starts with `prefix`.
 * memwal recall is SEMANTIC (fuzzy) and the SDK has no enumerate/list API, so this
 * is best-effort "recent matches", NOT an exhaustive listing — callers must treat
 * the result count as approximate. Returns [] when memory is off.
 */
export async function recallByPrefix(
  namespace: string,
  prefix: string,
  topK = 50,
): Promise<string[]> {
  if (!isMemoryEnabled()) return [];
  const lines = await recall(namespace, prefix, topK);
  const norm = prefix.trim().toLowerCase();
  return lines.filter((l) => l.trim().toLowerCase().startsWith(norm));
}

/** Check whether the MemWal relayer is alive. Returns false when not configured. */
export async function memoryHealth(): Promise<boolean> {
  if (!isMemoryEnabled()) return false;
  try {
    await clientFor("health-check").health();
    return true;
  } catch {
    return false;
  }
}
