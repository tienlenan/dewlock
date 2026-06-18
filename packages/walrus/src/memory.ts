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

/** Write one memory entry and wait for indexing. No-op when memwal is not configured. */
export async function remember(
  namespace: string,
  text: string,
): Promise<void> {
  if (!isMemoryEnabled() || !text.trim()) return;
  await clientFor(namespace).rememberAndWait(text);
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
