/**
 * Passport builder + monotonic merge. Pure (no walrus/chain). Asserts the red-team
 * invariants: no cap/risk/volume leak, level/xp/badges monotonic, counts NON-monotonic.
 */

import { describe, it, expect } from "vitest";
import { buildPassport, monotonicMergePassport, passportIdentityChanged } from "../memory/passport";

const WALLET = "0x" + "a".repeat(64);
const NOW = Date.parse("2026-06-18T00:00:00.000Z");

function log(ts: string, label: string): string {
  return `action log: ${ts} | ${label} | tx:0x${"1".repeat(8)} | usd:$0.00 | blob:x`;
}

const LINES = [
  log("2026-06-01T00:00:00.000Z", "Swap 1 SUI to USDC"),
  log("2026-06-02T00:00:00.000Z", "Swap 2 SUI to USDC"),
  log("2026-06-03T00:00:00.000Z", "Send 1 SUI to alice.sui"),
];

describe("buildPassport", () => {
  it("derives counts + memberSince from the action log", () => {
    const p = buildPassport(WALLET, LINES, NOW);
    expect(p.txCount).toBe(3);
    expect(p.actionCounts.swap).toBe(2);
    expect(p.actionCounts.transfer).toBe(1);
    expect(p.memberSince).toBe("2026-06-01T00:00:00.000Z");
    expect(p.level).toBeGreaterThanOrEqual(1);
  });

  it("empty log → newbie passport (no throw, no fabrication)", () => {
    const p = buildPassport(WALLET, [], NOW);
    expect(p.txCount).toBe(0);
    expect(p.earnedBadgeIds).toEqual(expect.arrayContaining([]));
    expect(p.memberSince).toBeNull();
  });

  it("NEVER includes cap / riskProfile / volumeUsd (privacy + no-fabrication)", () => {
    const p = buildPassport(WALLET, LINES, NOW) as Record<string, unknown>;
    expect(p.cap).toBeUndefined();
    expect(p.riskProfile).toBeUndefined();
    expect(p.volumeUsd).toBeUndefined();
  });
});

describe("monotonicMergePassport", () => {
  it("level/xp never regress; badges union; counts take the live snapshot (NOT max)", () => {
    const prev = buildPassport(WALLET, LINES, NOW); // 3 actions
    const partial = buildPassport(WALLET, LINES.slice(0, 1), NOW); // partial recall: 1 action
    const merged = monotonicMergePassport(prev, partial);
    // level/xp don't regress on a partial re-derive
    expect(merged.level).toBe(prev.level);
    expect(merged.xp).toBe(prev.xp);
    // badges union (never un-earn)
    expect(merged.earnedBadgeIds.length).toBeGreaterThanOrEqual(prev.earnedBadgeIds.length);
    // counts are the live snapshot — NOT max-locked to the prior higher count
    expect(merged.txCount).toBe(partial.txCount);
  });

  it("null prev → returns derived", () => {
    const d = buildPassport(WALLET, LINES, NOW);
    expect(monotonicMergePassport(null, d)).toEqual(d);
  });

  it("memberSince keeps the earliest", () => {
    const a = buildPassport(WALLET, LINES, NOW); // since 06-01
    const later = buildPassport(WALLET, [log("2026-06-10T00:00:00.000Z", "Swap 1 SUI to USDC")], NOW);
    expect(monotonicMergePassport(a, later).memberSince).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("passportIdentityChanged (diff-guard for blob publish)", () => {
  it("true on first (null prev) + on level change; false when identity is stable", () => {
    const p = buildPassport(WALLET, LINES, NOW);
    expect(passportIdentityChanged(null, p)).toBe(true);
    expect(passportIdentityChanged(p, p)).toBe(false);
    expect(passportIdentityChanged(p, { ...p, level: p.level + 1 })).toBe(true);
    expect(passportIdentityChanged(p, { ...p, earnedBadgeIds: [...p.earnedBadgeIds, "x"] })).toBe(true);
    // a count-only change must NOT trigger a republish
    expect(passportIdentityChanged(p, { ...p, txCount: p.txCount + 1 })).toBe(false);
  });
});
