/**
 * Tests for the durable wallet-profile monotonic merge + the earned-id badge
 * rebuild. Pure — no IO. Locks the key invariant: a badge once earned is never
 * lost and level/xp never decrease, even if a later derive returns less.
 */

import { describe, it, expect } from "vitest";
import { monotonicMerge, profileChanged, type WalletProfile } from "../memory/wallet-profile";
import { badgesFromEarnedIds, BADGES } from "../memory/badges";

const NOW1 = "2026-06-01T00:00:00.000Z";
const NOW2 = "2026-06-17T00:00:00.000Z";
const ADDR = "0x" + "1".repeat(64);

describe("monotonicMerge", () => {
  it("seeds a profile from a fresh derive when none persisted", () => {
    const m = monotonicMerge(null, { walletAddress: ADDR, level: 3, xp: 300, earnedBadgeIds: ["newbie", "first-swap"] }, NOW1);
    expect(m.level).toBe(3);
    expect(m.xp).toBe(300);
    expect(m.earnedBadges.map((b) => b.id).sort()).toEqual(["first-swap", "newbie"]);
    expect(m.earnedBadges.every((b) => b.earnedAt === NOW1)).toBe(true);
    expect(m.version).toBe(1);
  });

  it("is MONOTONIC: never un-earns a badge or lowers level/xp", () => {
    const persisted: WalletProfile = {
      walletAddress: ADDR,
      level: 8,
      xp: 1200,
      earnedBadges: [{ id: "degen", earnedAt: NOW1 }, { id: "first-bridge", earnedAt: NOW1 }],
      updatedAt: NOW1,
      version: 4,
    };
    // A weaker derive (fewer badges, lower level) — e.g. receipts aged out.
    const m = monotonicMerge(persisted, { walletAddress: ADDR, level: 2, xp: 100, earnedBadgeIds: ["newbie"] }, NOW2);
    expect(m.level).toBe(8); // not lowered
    expect(m.xp).toBe(1200); // not lowered
    const ids = m.earnedBadges.map((b) => b.id).sort();
    expect(ids).toEqual(["degen", "first-bridge", "newbie"]); // union, nothing dropped
    // earliest earnedAt preserved for previously-earned badges
    expect(m.earnedBadges.find((b) => b.id === "degen")?.earnedAt).toBe(NOW1);
    expect(m.earnedBadges.find((b) => b.id === "newbie")?.earnedAt).toBe(NOW2);
    expect(m.version).toBe(5);
  });

  it("grows level/xp + adds new badges on a stronger derive", () => {
    const persisted: WalletProfile = { walletAddress: ADDR, level: 2, xp: 100, earnedBadges: [{ id: "newbie", earnedAt: NOW1 }], updatedAt: NOW1, version: 1 };
    const m = monotonicMerge(persisted, { walletAddress: ADDR, level: 5, xp: 600, earnedBadgeIds: ["newbie", "swapper"] }, NOW2);
    expect(m.level).toBe(5);
    expect(m.xp).toBe(600);
    expect(m.earnedBadges.map((b) => b.id).sort()).toEqual(["newbie", "swapper"]);
  });
});

describe("profileChanged", () => {
  const base: WalletProfile = { walletAddress: ADDR, level: 3, xp: 300, earnedBadges: [{ id: "newbie", earnedAt: NOW1 }], updatedAt: NOW1, version: 1 };
  it("detects a new badge / level change", () => {
    expect(profileChanged(base, { ...base, level: 4, version: 2 })).toBe(true);
    expect(profileChanged(base, { ...base, earnedBadges: [...base.earnedBadges, { id: "first-swap", earnedAt: NOW2 }], version: 2 })).toBe(true);
  });
  it("returns false for an identical merge", () => {
    expect(profileChanged(base, { ...base, updatedAt: NOW2, version: 2 })).toBe(false);
  });
});

describe("badgesFromEarnedIds", () => {
  it("splits the catalog by an explicit earned-id set", () => {
    const { earned, locked } = badgesFromEarnedIds(["newbie", "degen"]);
    expect(earned.map((b) => b.id).sort()).toEqual(["degen", "newbie"]);
    expect(earned.length + locked.length).toBe(BADGES.length);
    expect(locked.some((b) => b.id === "newbie")).toBe(false);
  });
});
