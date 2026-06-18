/**
 * Tests for the XP/level model + the expanded ~50-badge catalog.
 * Pure — no mocks, no network. Covers XP weighting, level boundaries, the new
 * badge categories (gated on injected fields), and deriveBadgeInput derivation.
 */

import { describe, it, expect } from "vitest";
import { formatDecisionLogEntry } from "../memory/receipt-log";
import { deriveBadgeInput, type BadgeInput } from "../memory/user-stats";
import { xpFromInput, computeLevel, XP_WEIGHTS, LEVELS } from "../memory/level";
import { BADGES, computeBadges } from "../memory/badges";

function input(over: Partial<BadgeInput> = {}): BadgeInput {
  return {
    txCount: 0,
    volumeUsd: 0,
    actions: { transfer: 0, swap: 0, lend: 0, bridge: 0, limit: 0 },
    distinctActions: 0,
    firstTs: null,
    ...over,
  };
}

describe("xpFromInput / computeLevel", () => {
  it("weights actions per type and sums volume + bonuses", () => {
    const xp = xpFromInput(
      input({ actions: { transfer: 1, swap: 1, lend: 1, bridge: 1, limit: 1 }, volumeUsd: 100, convictionDays: 2 }),
    );
    // 10+20+30+50+25 = 135 actions; volume floor(100*0.1)=10; conviction 2*5=10 → 155
    expect(xp).toBe(135 + 10 + 10);
    expect(XP_WEIGHTS.bridge).toBe(50);
  });

  it("starts at level 1 / 0 XP and climbs the curve", () => {
    const l0 = computeLevel(input({}));
    expect(l0.level).toBe(1);
    expect(l0.xp).toBe(0);
    expect(l0.title).toBe("Novice");
    expect(l0.xpForNext).toBe(LEVELS[1].minXp);

    const hi = computeLevel(input({ actions: { transfer: 0, swap: 100, lend: 0, bridge: 0, limit: 0 }, volumeUsd: 50_000 }));
    expect(hi.level).toBeGreaterThan(5);
    expect(hi.xp).toBe(xpFromInput(input({ actions: { transfer: 0, swap: 100, lend: 0, bridge: 0, limit: 0 }, volumeUsd: 50_000 })));
  });

  it("level never exceeds the table and xpForNext is null at max", () => {
    const max = computeLevel(input({ volumeUsd: 100_000_000, actions: { transfer: 9999, swap: 9999, lend: 9999, bridge: 9999, limit: 9999 } }));
    expect(max.level).toBe(LEVELS[LEVELS.length - 1].level);
    expect(max.xpForNext).toBeNull();
  });
});

describe("expanded badge catalog (~50)", () => {
  it("has ~50 badges across all 12 categories with stable existing ids", () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(48);
    const cats = new Set(BADGES.map((b) => b.category));
    expect(cats.size).toBe(13);
    const ids = new Set(BADGES.map((b) => b.id));
    for (const keep of ["newbie", "degen", "centurion", "first-swap", "first-lend", "first-limit", "first-bridge", "multi-tool", "high-roller"]) {
      expect(ids.has(keep)).toBe(true);
    }
  });

  it("gates injected-field badges: locked without data, earned with it", () => {
    const earnedIds = (s: BadgeInput) => computeBadges(s).earned.map((b) => b.id);
    // No injected fields → portfolio/loyalty/conviction/security/level badges locked.
    const bare = earnedIds(input({ txCount: 1 }));
    expect(bare).toContain("newbie");
    expect(bare).toContain("sealed-signer");
    expect(bare).not.toContain("portfolio-starter");
    expect(bare).not.toContain("week-one");
    expect(bare).not.toContain("level-5");
    // With injected fields → earned.
    const rich = earnedIds(input({ txCount: 1, portfolioUsd: 1500, daysActive: 8, convictionDays: 8, blocksHeeded: 1, level: 10 }));
    expect(rich).toContain("portfolio-starter");
    expect(rich).toContain("portfolio-builder");
    expect(rich).toContain("week-one");
    expect(rich).toContain("conviction");
    expect(rich).toContain("close-call");
    expect(rich).toContain("level-5");
    expect(rich).toContain("level-10");
    expect(rich).not.toContain("level-25");
  });

  it("per-action-type progressions are independent", () => {
    const ids = computeBadges(input({ txCount: 60, actions: { transfer: 0, swap: 60, lend: 0, bridge: 0, limit: 0 } })).earned.map((b) => b.id);
    expect(ids).toContain("swap-savant"); // 50+ swaps
    expect(ids).not.toContain("dispatcher"); // 0 transfers
  });
});

describe("deriveBadgeInput", () => {
  it("derives protocolsUsed + daysActive from receipts and merges injected fields", () => {
    const lines = [
      formatDecisionLogEntry({ actionLabel: "Swap SUI for USDC via Cetus", txDigest: "0x1", estimatedUsdValue: 10, timestamp: "2026-06-01T00:00:00.000Z" }),
      formatDecisionLogEntry({ actionLabel: "Deposit to NAVI", txDigest: "0x2", estimatedUsdValue: 5, timestamp: "2026-06-10T00:00:00.000Z" }),
    ];
    const now = Date.parse("2026-06-17T00:00:00.000Z");
    const bi = deriveBadgeInput(lines, { portfolioUsd: 999 }, now);
    expect(bi.txCount).toBe(2);
    expect(bi.protocolsUsed).toBe(2); // cetus + navi
    expect(bi.daysActive).toBe(16); // 2026-06-01 → 2026-06-17
    expect(bi.portfolioUsd).toBe(999);
  });
});
