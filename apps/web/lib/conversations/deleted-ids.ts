"use client";

/**
 * Client half of the conversation soft-delete pair. memwal's index pointer is
 * eventually-consistent (~30-43s), so right after a delete a refetch can still return the
 * just-deleted conversation — making it reappear on a quick reload. We keep a per-wallet set
 * of deleted ids in localStorage, hide them on load, and forget an id once the server stops
 * returning it (durably gone). This masks the reload window the server can't (it's inherent
 * to memwal); the server's own delete tombstone is the other half. This is a tiny UI hint —
 * NOT a copy of conversation data (that lives only in Walrus).
 */

const KEY = (wallet: string) => `dewlock-deleted-convos:${wallet}`;

function read(wallet: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY(wallet));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persist(wallet: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    if (ids.size === 0) window.localStorage.removeItem(KEY(wallet));
    else window.localStorage.setItem(KEY(wallet), JSON.stringify([...ids]));
  } catch {
    /* storage unavailable (private mode / quota) — degrade to server-only */
  }
}

/** Mark an id deleted so it stays hidden across a reload until the server stops returning it. */
export function addDeletedId(wallet: string, id: string): void {
  const ids = read(wallet);
  if (ids.has(id)) return;
  ids.add(id);
  persist(wallet, ids);
}

/** Forget every tracked id for this wallet (used on clear-all — everything is gone). */
export function clearDeletedIds(wallet: string): void {
  persist(wallet, new Set());
}

/**
 * Reconcile against a freshly-fetched list: drop ids the server no longer returns (durably
 * deleted → stop tracking) and return the set still to hide right now. Self-cleaning so the
 * localStorage set can't grow unbounded.
 */
export function reconcileDeletedIds(wallet: string, fetchedIds: Set<string>): Set<string> {
  const tracked = read(wallet);
  if (tracked.size === 0) return tracked;
  const stillPending = new Set([...tracked].filter((id) => fetchedIds.has(id)));
  if (stillPending.size !== tracked.size) persist(wallet, stillPending);
  return stillPending;
}
