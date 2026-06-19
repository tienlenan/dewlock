/**
 * Tests for the save-freshness bridge that masks memwal's ~30-43s index-pointer lag on the
 * READ path. Without it, a reload right after a save resolves an older blob (fewer messages).
 * A minimal localStorage + window stub stands in for the browser (node env). Merge cases use
 * wall-clock-relative timestamps because the bridge self-cleans server-absent entries by age.
 */

import { describe, it, expect, beforeEach } from "vitest";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

import {
  recordLocalEntry,
  removeLocalEntry,
  clearLocalEntries,
  readLocalEntries,
  mergeServerEntries,
} from "../local-index";
import type { ConversationIndexEntry } from "../conversation-store";

const W = "0x" + "a".repeat(64);
const E = (id: string, updatedAt: number, blobId: string): ConversationIndexEntry => ({
  id,
  title: id,
  updatedAt,
  blobId,
});

describe("local-index — save freshness over memwal pointer lag", () => {
  it("records and reads back newest-first", () => {
    recordLocalEntry(W, E("c1", 1000, "b1"));
    recordLocalEntry(W, E("c2", 2000, "b2"));
    expect(readLocalEntries(W).map((e) => e.id)).toEqual(["c2", "c1"]);
  });

  it("keeps the local (fresher) blobId when the server pointer is still stale", () => {
    const now = Date.now();
    recordLocalEntry(W, E("c1", now, "b-new"));
    // The lagged server pointer still resolves the older blob — local must win.
    const merged = mergeServerEntries(W, [E("c1", now - 10_000, "b-old")]);
    expect(merged).toEqual([E("c1", now, "b-new")]);
  });

  it("surfaces a just-saved convo the server pointer hasn't indexed yet (within the lag window)", () => {
    const now = Date.now();
    recordLocalEntry(W, E("c2", now, "b2"));
    const merged = mergeServerEntries(W, [E("c1", now - 5_000, "b1")]);
    expect(merged.map((e) => e.id)).toEqual(["c2", "c1"]);
  });

  it("self-cleans once the server pointer catches up (server.updatedAt >= local)", () => {
    const now = Date.now();
    recordLocalEntry(W, E("c1", now, "b2"));
    const merged = mergeServerEntries(W, [E("c1", now, "b2")]);
    expect(merged).toEqual([E("c1", now, "b2")]);
    expect(readLocalEntries(W)).toEqual([]); // local pruned → server authoritative again
  });

  it("self-cleans a server-absent entry once it ages past the lag window (no permanent phantom)", () => {
    const old = Date.now() - 120_000; // 2 min ago — well past the ~60s lag window
    recordLocalEntry(W, E("c1", old, "b1"));
    // Server permanently omits c1 (deleted/cleared on another device) → aged-out, not resurrected.
    expect(mergeServerEntries(W, [])).toEqual([]);
    expect(readLocalEntries(W)).toEqual([]);
  });

  it("still bridges a freshly-saved entry the server hasn't surfaced (within the window)", () => {
    const now = Date.now();
    recordLocalEntry(W, E("c1", now, "b1"));
    expect(mergeServerEntries(W, []).map((e) => e.id)).toEqual(["c1"]);
  });

  it("does not resurrect a same-device deletion (remove / clear drop local)", () => {
    const now = Date.now();
    recordLocalEntry(W, E("c1", now, "b1"));
    recordLocalEntry(W, E("c2", now, "b2"));
    removeLocalEntry(W, "c1");
    expect(readLocalEntries(W).map((e) => e.id)).toEqual(["c2"]);
    expect(mergeServerEntries(W, [E("c2", now, "b2")]).map((e) => e.id)).toEqual(["c2"]);
    clearLocalEntries(W);
    expect(readLocalEntries(W)).toEqual([]);
  });

  it("skips entries with no blobId (nothing to fast-path with)", () => {
    recordLocalEntry(W, E("c1", 1000, ""));
    expect(readLocalEntries(W)).toEqual([]);
  });

  it("passes the server list straight through when there is no local state", () => {
    const merged = mergeServerEntries(W, [E("c1", 1000, "b1"), E("c2", 2000, "b2")]);
    expect(merged.map((e) => e.id)).toEqual(["c2", "c1"]);
  });
});
