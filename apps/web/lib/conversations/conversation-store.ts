/**
 * Walrus-backed conversation persistence (server-only).
 *
 * Each conversation is a Walrus blob (immutable, content-addressed). A per-wallet
 * INDEX blob lists {id, title, updatedAt, blobId}; the latest index blobId is
 * pointed to by a memwal entry. The index blob is the source of truth for
 * enumeration (deterministic); memwal holds only the pointer (one recall).
 *
 * Fail-soft everywhere: when memwal/Walrus is unavailable, list→[], get→null,
 * upsert→{ok:false} — the app stays usable as an ephemeral single conversation.
 * Per-wallet isolation via memNamespace(wallet).
 */

import { memNamespace, remember, recall, isMemoryEnabled } from "@dewlock/walrus";
import { publishJsonBlob, readJsonBlob } from "@dewlock/walrus";
import type { SerializableMessage } from "./serialize";

export interface ConversationIndexEntry {
  id: string;
  title: string;
  updatedAt: number;
  blobId: string;
}
export interface ConversationIndex {
  walletAddress: string;
  conversations: ConversationIndexEntry[];
  updatedAt: number;
}
export interface ConversationRecord {
  id: string;
  walletAddress: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: SerializableMessage[];
}

const POINTER_PREFIX = "conversation-index:";
const POINTER_RE = /^conversation-index:\s*(\S+)\s*@\s*(\d+)/;
// "Clear all" tombstone. memwal has no delete + the index-pointer recall is semantic
// and capped, so an empty-index pointer didn't reliably win. A tombstone (few entries,
// reliably recalled) newer than the latest index pointer means "everything cleared".
const CLEAR_PREFIX = "conversation-cleared:";
const CLEAR_RE = /^conversation-cleared:\s*@\s*(\d+)/;

/** Read the latest index blob for a wallet (null when none / unavailable). */
export async function readIndex(wallet: string): Promise<ConversationIndex | null> {
  if (!isMemoryEnabled()) return null;
  try {
    const ns = memNamespace(wallet);
    // Generous limits: pointers are append-only (one per save), so the newest
    // must be inside the returned set for "latest by timestamp" to be correct.
    const [idxLines, clearLines] = await Promise.all([
      recall(ns, POINTER_PREFIX, 50),
      recall(ns, CLEAR_PREFIX, 25),
    ]);
    let best: { blobId: string; at: number } | null = null;
    for (const line of idxLines) {
      const m = POINTER_RE.exec(line.trim());
      if (!m) continue;
      const at = Number(m[2]);
      if (!best || at > best.at) best = { blobId: m[1], at };
    }
    let latestClear = 0;
    for (const line of clearLines) {
      const m = CLEAR_RE.exec(line.trim());
      if (m) latestClear = Math.max(latestClear, Number(m[1]));
    }
    // A clear newer than (or equal to) the latest index pointer wins → empty.
    if (latestClear > 0 && (!best || latestClear >= best.at)) {
      return { walletAddress: wallet, conversations: [], updatedAt: latestClear };
    }
    if (!best) return null;
    return await readJsonBlob<ConversationIndex>(best.blobId);
  } catch {
    return null;
  }
}

/** Publish a new index blob + update the memwal pointer. Returns ok. */
async function writeIndex(wallet: string, index: ConversationIndex): Promise<boolean> {
  if (!isMemoryEnabled()) return false;
  try {
    const ptr = await publishJsonBlob("dewlock-conversation-index", index);
    if (!ptr.blobId) return false;
    await remember(memNamespace(wallet), `${POINTER_PREFIX} ${ptr.blobId} @ ${index.updatedAt}`);
    return true;
  } catch {
    return false;
  }
}

/** List a wallet's conversations (newest first). */
export async function listConversations(wallet: string): Promise<ConversationIndexEntry[]> {
  const index = await readIndex(wallet);
  return (index?.conversations ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Read a full conversation by id (null when missing / unavailable). */
export async function getConversation(wallet: string, id: string): Promise<ConversationRecord | null> {
  const index = await readIndex(wallet);
  const entry = index?.conversations.find((c) => c.id === id);
  if (!entry) return null;
  try {
    return await readJsonBlob<ConversationRecord>(entry.blobId);
  } catch {
    return null;
  }
}

/**
 * Fast path: read a conversation directly from a known blobId, skipping the index
 * recall (the client already has the blobId from the list). Verifies the record
 * belongs to the wallet (defense against a forged blobId pointing at another wallet's
 * conversation). Falls back to null on any mismatch/failure → caller can retry by id.
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

/** Persist (insert/replace) a conversation. Returns the blob id when written. */
export async function upsertConversation(
  record: ConversationRecord,
): Promise<{ ok: boolean; blobId?: string }> {
  if (!isMemoryEnabled()) return { ok: false };
  try {
    const ptr = await publishJsonBlob("dewlock-conversation", record);
    if (!ptr.blobId) return { ok: false };
    const index = (await readIndex(record.walletAddress)) ?? {
      walletAddress: record.walletAddress,
      conversations: [],
      updatedAt: record.updatedAt,
    };
    const entry: ConversationIndexEntry = {
      id: record.id,
      title: record.title,
      updatedAt: record.updatedAt,
      blobId: ptr.blobId,
    };
    index.conversations = [entry, ...index.conversations.filter((c) => c.id !== record.id)];
    // record.updatedAt is the save time (the client stamps Date.now() on save), so
    // the index pointer naturally out-dates a prior clear tombstone — a genuine
    // save after a clear reappears, while the clear suppresses everything older.
    index.updatedAt = record.updatedAt;
    await writeIndex(record.walletAddress, index);
    return { ok: true, blobId: ptr.blobId };
  } catch {
    return { ok: false };
  }
}

/** Drop a conversation from the index (the blob stays immutably on Walrus). */
export async function removeConversation(wallet: string, id: string): Promise<boolean> {
  const index = await readIndex(wallet);
  if (!index) return false;
  index.conversations = index.conversations.filter((c) => c.id !== id);
  index.updatedAt = Date.now();
  return writeIndex(wallet, index);
}

/**
 * Drop ALL conversations in a SINGLE index write. Deleting one-by-one in parallel
 * would race on the shared index blob (each read-modify-write clobbers the others,
 * last-writer-wins), so "clear all" must be one atomic empty-index write.
 */
export async function clearConversations(wallet: string): Promise<boolean> {
  if (!isMemoryEnabled()) return false;
  try {
    // Tombstone strictly newer than every index pointer. readIndex returns [] while
    // the latest tombstone out-dates the latest index pointer — robust against the
    // capped/semantic pointer recall (an empty-index pointer alone wasn't winning).
    await remember(memNamespace(wallet), `${CLEAR_PREFIX} @ ${Date.now()}`);
    return true;
  } catch {
    return false;
  }
}
