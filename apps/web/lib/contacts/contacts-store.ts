/**
 * Walrus-backed friend address book (server-only).
 *
 * The whole book is ONE Walrus blob (content-addressed); a memwal pointer
 * `contacts-book: <blobId> @ <ts>` names the latest blob, and a tombstone
 * `contacts-cleared: @ <ts>` marks an empty book. The blob is the single source of
 * truth (listable + deletable); memwal holds only the pointer — this IS the
 * "persist to memwal" wiring. We deliberately do NOT write per-contact
 * `contact: <name> = <0x>` recall lines: memwal has no delete, so those would outlive
 * a deleted friend and are still read by /api/memory-recall.
 *
 * Fail-soft everywhere: memwal/Walrus unavailable → readOk:false (so the UI can show
 * "couldn't load" vs "no friends"), writes → {ok:false}. Per-wallet isolation via
 * memNamespace(wallet). Pointer ts uses max(now, latestTombstone+1) so a re-add after a
 * delete-last strictly out-dates the tombstone (semantic recall can't guarantee ordering).
 */

import {
  memNamespace,
  remember,
  recall,
  isMemoryEnabled,
  publishJsonBlob,
  readJsonBlob,
} from "@dewlock/walrus";

export interface BookContact {
  name: string; // display case as the user typed it; compared case-insensitively
  address: string; // 0x-prefixed 64-hex, lowercased
  updatedAt: number;
}
export interface ContactsBook {
  walletAddress: string;
  contacts: BookContact[];
  updatedAt: number;
  schemaVersion: 1;
}

const POINTER_PREFIX = "contacts-book:";
const POINTER_RE = /^contacts-book:\s*(\S+)\s*@\s*(\d+)/;
const CLEAR_PREFIX = "contacts-cleared:";
const CLEAR_RE = /^contacts-cleared:\s*@\s*(\d+)/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;
const MAX_NAME_LEN = 64;

interface Pointers {
  best: { blobId: string; at: number } | null;
  latestClear: number;
}

/** Recall the latest book pointer + clear tombstone for a wallet. */
async function readPointers(ns: string): Promise<Pointers> {
  const [ptrLines, clearLines] = await Promise.all([
    recall(ns, POINTER_PREFIX, 20),
    recall(ns, CLEAR_PREFIX, 8),
  ]);
  let best: { blobId: string; at: number } | null = null;
  for (const line of ptrLines) {
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
  return { best, latestClear };
}

/**
 * Load the book. `readOk` distinguishes a genuine empty/cleared book (true) from an
 * outage where we couldn't read (false) so the UI doesn't show "no friends" on an error.
 */
export async function loadBook(
  wallet: string,
): Promise<{ readOk: boolean; book: ContactsBook | null }> {
  if (!isMemoryEnabled()) return { readOk: false, book: null };
  try {
    const ns = memNamespace(wallet);
    const { best, latestClear } = await readPointers(ns);
    // A clear newer than (or equal to) the latest pointer → empty book (genuine).
    if (latestClear > 0 && (!best || latestClear >= best.at)) {
      return { readOk: true, book: null };
    }
    if (!best) return { readOk: true, book: null }; // never created
    const book = await readJsonBlob<ContactsBook>(best.blobId);
    if (!book) return { readOk: false, book: null }; // aggregator unreachable
    return { readOk: true, book };
  } catch {
    return { readOk: false, book: null };
  }
}

/** List a wallet's contacts (alpha by name). Outage and empty both yield []. */
export async function listContacts(wallet: string): Promise<BookContact[]> {
  const { book } = await loadBook(wallet);
  return (book?.contacts ?? [])
    .slice()
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** Publish a book blob + write a pointer stamped to strictly out-date any tombstone. */
async function writeBook(
  wallet: string,
  contacts: BookContact[],
): Promise<{ ok: boolean; blobId?: string }> {
  const ns = memNamespace(wallet);
  const { best, latestClear } = await readPointers(ns);
  // Strictly out-date BOTH the latest pointer and any tombstone, so "latest wins" holds
  // even for back-to-back writes within the same millisecond (Date.now() can collide).
  const prevAt = Math.max(best?.at ?? 0, latestClear);
  const ts = Math.max(Date.now(), prevAt + 1);
  const book: ContactsBook = {
    walletAddress: wallet,
    contacts,
    updatedAt: ts,
    schemaVersion: 1,
  };
  const ptr = await publishJsonBlob("dewlock-contacts-book", book);
  if (!ptr.blobId) return { ok: false };
  await remember(ns, `${POINTER_PREFIX} ${ptr.blobId} @ ${ts}`);
  return { ok: true, blobId: ptr.blobId };
}

/** Write only a clear tombstone (used when the resulting book is empty). */
async function writeTombstone(wallet: string): Promise<boolean> {
  try {
    const ns = memNamespace(wallet);
    const { best, latestClear } = await readPointers(ns);
    // Strictly out-date the latest pointer too — writeBook may have stamped a pointer ts
    // slightly ahead of the wall clock (same-ms monotonic bump), which a raw Date.now()
    // tombstone wouldn't beat.
    const prevAt = Math.max(best?.at ?? 0, latestClear);
    const ts = Math.max(Date.now(), prevAt + 1);
    await remember(ns, `${CLEAR_PREFIX} @ ${ts}`);
    return true;
  } catch {
    return false;
  }
}

/** Insert/replace a contact (case-insensitive name key). */
export async function upsertContact(
  wallet: string,
  input: { name: string; address: string },
): Promise<{ ok: boolean; blobId?: string }> {
  if (!isMemoryEnabled()) return { ok: false };
  const name = input.name.trim();
  const address = input.address.trim().toLowerCase();
  if (!name || name.length > MAX_NAME_LEN || !ADDRESS_RE.test(address)) {
    return { ok: false };
  }
  try {
    const { book } = await loadBook(wallet);
    const existing = book?.contacts ?? [];
    const key = name.toLowerCase();
    const next: BookContact[] = [
      ...existing.filter((c) => c.name.toLowerCase() !== key),
      { name, address, updatedAt: Date.now() },
    ];
    return await writeBook(wallet, next);
  } catch {
    return { ok: false };
  }
}

/** Remove a contact by case-insensitive name. Empties → tombstone only (no empty pointer). */
export async function deleteContact(wallet: string, name: string): Promise<boolean> {
  if (!isMemoryEnabled()) return false;
  const key = name.trim().toLowerCase();
  if (!key) return false;
  try {
    const { book } = await loadBook(wallet);
    const remaining = (book?.contacts ?? []).filter(
      (c) => c.name.toLowerCase() !== key,
    );
    if (remaining.length === 0) return writeTombstone(wallet);
    const res = await writeBook(wallet, remaining);
    return res.ok;
  } catch {
    return false;
  }
}

/** Clear the whole book in one tombstone write (mirrors clearConversations). */
export async function clearContacts(wallet: string): Promise<boolean> {
  if (!isMemoryEnabled()) return false;
  return writeTombstone(wallet);
}
