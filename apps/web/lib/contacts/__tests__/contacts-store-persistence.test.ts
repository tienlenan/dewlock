/**
 * Tests for the friend-book store: Walrus+memwal round-trip, tombstone clear, and the
 * delete-last → re-add ordering (the pointer must out-date the tombstone even at the same
 * millisecond, via max(now, tombstone+1)). Walrus/memwal is fully mocked — no live services.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  blobs: new Map<string, unknown>(),
  pointers: [] as string[],
  n: 0,
  enabled: true,
}));

vi.mock("@dewlock/walrus", () => ({
  isMemoryEnabled: () => h.enabled,
  memNamespace: (w: string) => `ns:${w}`,
  remember: async (_ns: string, text: string) => { h.pointers.push(text); },
  recall: async (_ns: string, _q: string, topK = 8) => h.pointers.slice(-topK),
  publishJsonBlob: async (_kind: string, value: unknown) => {
    const blobId = `blob-${++h.n}`;
    h.blobs.set(blobId, value);
    return { status: "published", blobId, objectId: null, hash: "x" };
  },
  readJsonBlob: async (id: string) => h.blobs.get(id) ?? null,
}));

import {
  listContacts,
  upsertContact,
  deleteContact,
  clearContacts,
} from "../contacts-store";

const WALLET = "0x" + "1".repeat(64);
const A = "0x" + "a".repeat(64);
const B = "0x" + "b".repeat(64);

beforeEach(() => {
  h.blobs.clear();
  h.pointers = [];
  h.n = 0;
  h.enabled = true;
});

describe("contacts-store", () => {
  it("upserts, lists (alpha), and replaces by case-insensitive name", async () => {
    expect(await upsertContact(WALLET, { name: "Bob", address: B })).toMatchObject({ ok: true });
    expect(await upsertContact(WALLET, { name: "Alice", address: A })).toMatchObject({ ok: true });
    expect((await listContacts(WALLET)).map((c) => c.name)).toEqual(["Alice", "Bob"]);

    // Re-saving the same name (different case) replaces, not duplicates.
    await upsertContact(WALLET, { name: "alice", address: A });
    const list = await listContacts(WALLET);
    expect(list.filter((c) => c.name.toLowerCase() === "alice")).toHaveLength(1);
  });

  it("rejects an invalid address", async () => {
    expect(await upsertContact(WALLET, { name: "X", address: "0xnope" })).toMatchObject({ ok: false });
  });

  it("deletes one contact by name", async () => {
    await upsertContact(WALLET, { name: "Alice", address: A });
    await upsertContact(WALLET, { name: "Bob", address: B });
    expect(await deleteContact(WALLET, "alice")).toBe(true);
    expect((await listContacts(WALLET)).map((c) => c.name)).toEqual(["Bob"]);
  });

  it("delete-last empties the book (tombstone), and a re-add reappears (out-dates the tombstone)", async () => {
    await upsertContact(WALLET, { name: "Alice", address: A });
    expect(await deleteContact(WALLET, "Alice")).toBe(true);
    expect(await listContacts(WALLET)).toEqual([]);

    // Re-add immediately — must reappear even if Date.now() is the same ms as the tombstone.
    expect(await upsertContact(WALLET, { name: "Carol", address: B })).toMatchObject({ ok: true });
    expect((await listContacts(WALLET)).map((c) => c.name)).toEqual(["Carol"]);
  });

  it("clearContacts empties the book", async () => {
    await upsertContact(WALLET, { name: "Alice", address: A });
    await upsertContact(WALLET, { name: "Bob", address: B });
    expect(await clearContacts(WALLET)).toBe(true);
    expect(await listContacts(WALLET)).toEqual([]);
  });

  it("fail-soft when memory is disabled", async () => {
    h.enabled = false;
    expect(await listContacts(WALLET)).toEqual([]);
    expect(await upsertContact(WALLET, { name: "Alice", address: A })).toMatchObject({ ok: false });
    expect(await deleteContact(WALLET, "Alice")).toBe(false);
  });
});
