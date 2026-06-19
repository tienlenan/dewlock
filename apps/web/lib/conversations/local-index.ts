"use client";

/**
 * Client half of the conversation SAVE-freshness pair — the mirror of deleted-ids.ts for the
 * save direction.
 *
 * memwal's index pointer is eventually-consistent (~30-43s): a save writes the new pointer via
 * rememberBulk (accept-only, async), but the server's readIndex resolves "latest" by recalling
 * pointers, which only sees INDEXED ones. So right after a save, a refetch can still resolve an
 * OLDER index blob → the reopened thread shows fewer messages than were sent ("not all messages
 * saved"). The in-session optimistic list hides it; a real page reload (cold cache) does not.
 *
 * The client already knows the authoritative newest blobId — the POST returns it. We keep a
 * per-wallet map of each conversation's just-saved index entry in localStorage, hydrate it on
 * load so the freshest blobId is used immediately (the [id] route honors a client blobId fast
 * path), and self-clean an entry once the server pointer catches up. This masks the save reload
 * window the server can't (inherent to memwal). It's a tiny pointer hint — the durable data
 * still lives only in the encrypted Walrus blob, never here.
 */

import type { ConversationIndexEntry } from "./conversation-store";

const KEY = (wallet: string) => `dewlock-recent-convos:${wallet}`;

/**
 * memwal index-pointer lag window. A just-saved entry the server hasn't surfaced yet sits within
 * this window and is bridged; a local entry the server has OMITTED for longer than this is treated
 * as a real deletion/clear (e.g. on another device) and self-cleaned — otherwise it would
 * resurrect a permanent phantom list row the server will never return again. Comfortably above
 * memwal's ~30-43s indexing lag, so a legitimate save is always surfaced before it ages out.
 */
const INDEX_LAG_MS = 60_000;

function readMap(wallet: string): Map<string, ConversationIndexEntry> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(KEY(wallet));
    const arr = raw ? (JSON.parse(raw) as ConversationIndexEntry[]) : [];
    return new Map(arr.map((e) => [e.id, e]));
  } catch {
    return new Map();
  }
}

function persistMap(wallet: string, map: Map<string, ConversationIndexEntry>): void {
  if (typeof window === "undefined") return;
  try {
    if (map.size === 0) window.localStorage.removeItem(KEY(wallet));
    else window.localStorage.setItem(KEY(wallet), JSON.stringify([...map.values()]));
  } catch {
    /* storage unavailable (private mode / quota) — degrade to server-only (pre-fix behavior) */
  }
}

/** Record the just-saved entry — the client has the authoritative newest blobId from the POST. */
export function recordLocalEntry(wallet: string, entry: ConversationIndexEntry): void {
  if (!entry.blobId) return; // no blobId → nothing to fast-path with; skip
  const map = readMap(wallet);
  const prev = map.get(entry.id);
  if (prev && prev.updatedAt >= entry.updatedAt && prev.blobId === entry.blobId) return;
  map.set(entry.id, entry);
  persistMap(wallet, map);
}

/** Drop one id (on delete) so a same-device deletion is never re-surfaced from local. */
export function removeLocalEntry(wallet: string, id: string): void {
  const map = readMap(wallet);
  if (map.delete(id)) persistMap(wallet, map);
}

/** Forget every tracked entry (on clear-all — everything is gone). */
export function clearLocalEntries(wallet: string): void {
  persistMap(wallet, new Map());
}

/** Recorded entries, newest first — for instant hydration before the server list arrives. */
export function readLocalEntries(wallet: string): ConversationIndexEntry[] {
  return [...readMap(wallet).values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Merge the server list with the locally-recorded just-saved entries, newest first:
 *  - self-clean: drop a local entry once the server pointer has caught up (server.updatedAt >=
 *    local.updatedAt), OR once a server-absent entry has aged past the index-lag window (a real
 *    deletion/clear elsewhere) — the server is authoritative again; keeps localStorage bounded.
 *  - bridge: for any id the server hasn't caught up on yet (absent but still fresh, or present
 *    with an older updatedAt), keep the local entry so its fresher blobId wins. Server owns
 *    EXISTENCE: a same-device delete/clear already removed the entry locally, and a cross-device
 *    deletion self-cleans once it ages out — so this never resurrects a permanent phantom row.
 */
export function mergeServerEntries(
  wallet: string,
  server: ConversationIndexEntry[],
): ConversationIndexEntry[] {
  const local = readMap(wallet);
  if (local.size === 0) return [...server].sort((a, b) => b.updatedAt - a.updatedAt);

  const serverById = new Map(server.map((e) => [e.id, e]));
  const now = Date.now();
  let changed = false;
  for (const [id, e] of [...local]) {
    const s = serverById.get(id);
    const caughtUp = s !== undefined && s.updatedAt >= e.updatedAt;
    const agedOutDeletion = s === undefined && now - e.updatedAt > INDEX_LAG_MS;
    if (caughtUp || agedOutDeletion) {
      local.delete(id);
      changed = true;
    }
  }
  if (changed) persistMap(wallet, local);

  const mergedById = new Map(server.map((e) => [e.id, e]));
  for (const [id, e] of local) {
    const s = mergedById.get(id);
    if (!s || e.updatedAt > s.updatedAt) mergedById.set(id, e);
  }
  return [...mergedById.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
