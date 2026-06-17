/**
 * Unit tests for the receipt-derived user stats + badge catalog.
 *
 * Strategy: build receipt lines with the REAL formatDecisionLogEntry formatter
 * (proving the formatter ↔ parser round-trip), then assert deriveStats and
 * computeBadges produce correct values at every threshold boundary. Pure — no
 * mocks, no network.
 */

import { describe, it, expect } from "vitest";
import { formatDecisionLogEntry } from "../memory/receipt-log";
import {
  parseReceiptLine,
  classifyAction,
  deriveStats,
  parseReceipts,
  sumVolumeForDate,
} from "../memory/user-stats";
import { computeBadges, BADGES } from "../memory/badges";

function line(actionLabel: string, usd: number, ts: string, tx = "0xabc"): string {
  return formatDecisionLogEntry({ actionLabel, txDigest: tx, estimatedUsdValue: usd, timestamp: ts });
}

describe("parseReceiptLine", () => {
  it("parses a formatted receipt line", () => {
    const l = line("Swap 1 SUI for USDC", 4.2, "2026-01-01T00:00:00.000Z", "0xdeadbeef");
    const r = parseReceiptLine(l);
    expect(r).not.toBeNull();
    expect(r!.actionLabel).toBe("Swap 1 SUI for USDC");
    expect(r!.usdValue).toBeCloseTo(4.2);
    expect(r!.txDigest).toBe("0xdeadbeef");
    expect(r!.timestamp).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns null for non-receipt lines", () => {
    expect(parseReceiptLine("risk cap committed: $5")).toBeNull();
    expect(parseReceiptLine("")).toBeNull();
    expect(parseReceiptLine("contact: binance = 0x123")).toBeNull();
  });
});

describe("classifyAction", () => {
  it("classifies by keyword", () => {
    expect(classifyAction("Bridge redeem from Ethereum")).toBe("bridge");
    expect(classifyAction("Limit order POST_ONLY")).toBe("limit");
    expect(classifyAction("Lend deposit to NAVI")).toBe("lend");
    expect(classifyAction("Repay on Suilend")).toBe("lend");
    expect(classifyAction("Swap SUI for USDC")).toBe("swap");
    expect(classifyAction("Transfer 1 SUI to 888.sui")).toBe("transfer");
    expect(classifyAction("something unknown")).toBeNull();
  });
});

describe("deriveStats", () => {
  it("returns an empty (newbie) state for no receipts", () => {
    const s = deriveStats([]);
    expect(s.txCount).toBe(0);
    expect(s.volumeUsd).toBe(0);
    expect(s.distinctActions).toBe(0);
    expect(s.firstTs).toBeNull();
  });

  it("aggregates count, volume, action breakdown, and earliest timestamp", () => {
    const lines = [
      line("Transfer 1 SUI to 888.sui", 2, "2026-02-01T00:00:00.000Z"),
      line("Swap SUI for USDC", 3.5, "2026-01-15T00:00:00.000Z"),
      line("Lend deposit to NAVI", 10, "2026-03-01T00:00:00.000Z"),
      "garbage line that should be ignored",
    ];
    const s = deriveStats(lines);
    expect(s.txCount).toBe(3);
    expect(s.volumeUsd).toBeCloseTo(15.5);
    expect(s.actions.transfer).toBe(1);
    expect(s.actions.swap).toBe(1);
    expect(s.actions.lend).toBe(1);
    expect(s.distinctActions).toBe(3);
    expect(s.firstTs).toBe("2026-01-15T00:00:00.000Z"); // earliest
  });
});

describe("parseReceipts + sumVolumeForDate", () => {
  const lines = [
    line("Swap A", 4, "2026-06-17T08:00:00.000Z"),
    line("Transfer B", 2, "2026-06-17T02:00:00.000Z"),
    line("Lend C", 10, "2026-06-16T23:00:00.000Z"),
    "not a receipt",
  ];

  it("parses valid receipts newest-first", () => {
    const r = parseReceipts(lines);
    expect(r).toHaveLength(3);
    expect(r[0].actionLabel).toBe("Swap A"); // 08:00 newest
    expect(r[2].actionLabel).toBe("Lend C"); // prior day, oldest
  });

  it("sums only the requested day's volume", () => {
    const r = parseReceipts(lines);
    expect(sumVolumeForDate(r, "2026-06-17")).toBeCloseTo(6); // 4 + 2
    expect(sumVolumeForDate(r, "2026-06-16")).toBeCloseTo(10);
    expect(sumVolumeForDate(r, "2026-01-01")).toBe(0);
  });
});

describe("computeBadges", () => {
  function statsWith(over: Partial<ReturnType<typeof deriveStats>>) {
    return { txCount: 0, volumeUsd: 0, actions: { transfer: 0, swap: 0, lend: 0, bridge: 0, limit: 0 }, distinctActions: 0, firstTs: null, ...over };
  }
  function earnedIds(stats: ReturnType<typeof deriveStats>): string[] {
    return computeBadges(stats).earned.map((b) => b.id);
  }

  it("earns nothing at zero transactions", () => {
    expect(earnedIds(statsWith({}))).toEqual([]);
  });

  it("earns the count-tier badges at each boundary", () => {
    expect(earnedIds(statsWith({ txCount: 1 }))).toContain("newbie");
    expect(earnedIds(statsWith({ txCount: 1 }))).not.toContain("getting-started");
    expect(earnedIds(statsWith({ txCount: 5 }))).toContain("getting-started");
    expect(earnedIds(statsWith({ txCount: 10 }))).toContain("regular");
    expect(earnedIds(statsWith({ txCount: 25 }))).toContain("degen");
    expect(earnedIds(statsWith({ txCount: 100 }))).toContain("centurion");
  });

  it("earns first-action badges from the action breakdown", () => {
    expect(earnedIds(statsWith({ txCount: 1, actions: { transfer: 0, swap: 1, lend: 0, bridge: 0, limit: 0 } }))).toContain("first-swap");
    expect(earnedIds(statsWith({ txCount: 1, actions: { transfer: 0, swap: 0, lend: 1, bridge: 0, limit: 0 } }))).toContain("first-lend");
    expect(earnedIds(statsWith({ txCount: 1, actions: { transfer: 0, swap: 0, lend: 0, bridge: 0, limit: 1 } }))).toContain("first-limit");
    expect(earnedIds(statsWith({ txCount: 1, actions: { transfer: 0, swap: 0, lend: 0, bridge: 1, limit: 0 } }))).toContain("first-bridge");
  });

  it("earns multi-tool at 3 distinct actions and high-roller at $100", () => {
    expect(earnedIds(statsWith({ txCount: 3, distinctActions: 3 }))).toContain("multi-tool");
    expect(earnedIds(statsWith({ txCount: 2, distinctActions: 2 }))).not.toContain("multi-tool");
    expect(earnedIds(statsWith({ txCount: 1, volumeUsd: 100 }))).toContain("high-roller");
    expect(earnedIds(statsWith({ txCount: 1, volumeUsd: 99.99 }))).not.toContain("high-roller");
  });

  it("partitions every badge into earned XOR locked with fun names present", () => {
    const { earned, locked } = computeBadges(statsWith({ txCount: 1 }));
    expect(earned.length + locked.length).toBe(BADGES.length);
    const names = [...earned, ...locked].map((b) => b.name);
    expect(names).toContain("Newbie");
    expect(names).toContain("Degen");
  });
});
