/**
 * Tests for the durable profile store. Walrus/memwal mocked — no live services.
 * Proves the round-trip persists, the merge stays monotonic across reads, and it
 * fails soft (returns the derived merge) when memory is disabled.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ blobs: new Map<string, unknown>(), pointers: [] as string[], n: 0, enabled: true }));

vi.mock("@dewlock/walrus", () => ({
  isMemoryEnabled: () => h.enabled,
  memNamespace: (w: string) => `ns:${w}`,
  remember: async (_ns: string, text: string) => { h.pointers.push(text); },
  rememberBulk: async (_ns: string, texts: string[]) => { h.pointers.push(...texts); return { jobIds: [], total: texts.length }; },
  recall: async () => h.pointers.slice(-8),
  publishJsonBlob: async (_kind: string, value: unknown) => {
    const blobId = `blob-${++h.n}`;
    h.blobs.set(blobId, value);
    return { status: "published", blobId, objectId: null, hash: "x" };
  },
  readJsonBlob: async (id: string) => h.blobs.get(id) ?? null,
}));

import { mergeAndPersistProfile, readProfile } from "../profile-store";

const ADDR = "0x" + "1".repeat(64);

beforeEach(() => {
  h.blobs.clear();
  h.pointers = [];
  h.n = 0;
  h.enabled = true;
});

describe("profile-store", () => {
  it("persists then reads back the durable profile", async () => {
    await mergeAndPersistProfile({ walletAddress: ADDR, level: 3, xp: 300, earnedBadgeIds: ["newbie", "first-swap"] }, "2026-06-01T00:00:00.000Z");
    const got = await readProfile(ADDR);
    expect(got?.level).toBe(3);
    expect(got?.earnedBadges.map((b) => b.id).sort()).toEqual(["first-swap", "newbie"]);
  });

  it("stays monotonic across a weaker later derive (no un-earn / no downgrade)", async () => {
    await mergeAndPersistProfile({ walletAddress: ADDR, level: 8, xp: 1200, earnedBadgeIds: ["degen", "first-bridge"] }, "2026-06-01T00:00:00.000Z");
    const merged = await mergeAndPersistProfile({ walletAddress: ADDR, level: 2, xp: 100, earnedBadgeIds: ["newbie"] }, "2026-06-17T00:00:00.000Z");
    expect(merged.level).toBe(8);
    expect(merged.xp).toBe(1200);
    expect(merged.earnedBadges.map((b) => b.id).sort()).toEqual(["degen", "first-bridge", "newbie"]);
  });

  it("fails soft when memory is disabled — returns the derived merge, persists nothing", async () => {
    h.enabled = false;
    const merged = await mergeAndPersistProfile({ walletAddress: ADDR, level: 4, xp: 400, earnedBadgeIds: ["newbie"] }, "2026-06-17T00:00:00.000Z");
    expect(merged.level).toBe(4);
    expect(await readProfile(ADDR)).toBeNull();
  });
});
