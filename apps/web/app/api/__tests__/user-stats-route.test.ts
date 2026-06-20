/**
 * Tests for GET /api/user-stats.
 *
 * Strategy: import the route handler directly. Mock @dewlock/walrus (memory) and
 * the BlockVision client (no live API). The badge/stats logic is the REAL pure
 * code (aliased to source). Proves: input validation, the memory-disabled empty
 * (newbie) state, and the receipts-present path that earns badges.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// `server-only` is a Next.js build guard, not resolvable in the vitest node env — stub it.
// (The shared build-user-stats module imports it.)
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({ memoryOn: false, lines: [] as string[] }));

vi.mock("@dewlock/walrus", () => ({
  isMemoryEnabled: () => h.memoryOn,
  memNamespace: (w: string) => `ns:${w}`,
  recall: async () => h.lines,
}));

vi.mock("@/lib/blockvision/client", () => ({
  getWalletOverview: async () => ({
    degraded: true,
    totalUsdValue: null,
    coins: [],
    onchainTxCount: null,
    recent: [],
  }),
}));

// Cache disabled in tests → the route derives live exactly as before (no Redis / server-only).
vi.mock("@/lib/user-stats/stats-cache", () => ({
  readStatsCache: async () => null,
  writeStatsCache: async () => {},
  invalidateStatsCache: async () => {},
}));

import { GET } from "../user-stats/route";

const ADDR = "0x" + "1".repeat(64);
function req(url: string) {
  return new NextRequest(url);
}

beforeEach(() => {
  h.memoryOn = false;
  h.lines = [];
});

describe("GET /api/user-stats — validation", () => {
  it("400 when wallet is missing", async () => {
    const res = await GET(req("http://localhost/api/user-stats"));
    expect(res.status).toBe(400);
  });

  it("400 when wallet is malformed", async () => {
    const res = await GET(req("http://localhost/api/user-stats?wallet=not-an-address"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/user-stats — memory disabled (empty state)", () => {
  it("returns 200 with a zeroed newbie state", async () => {
    const res = await GET(req(`http://localhost/api/user-stats?wallet=${ADDR}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.txCount).toBe(0);
    expect(body.badges.earned).toEqual([]);
    expect(body.badges.locked.some((b: { id: string }) => b.id === "newbie")).toBe(true);
    expect(body.memoryEnabled).toBe(false);
    expect(body.wallet.degraded).toBe(true);
  });
});

describe("GET /api/user-stats — with receipts", () => {
  it("derives stats + earns badges from recalled receipt lines", async () => {
    h.memoryOn = true;
    h.lines = [
      "action log: 2026-01-01T00:00:00.000Z | Swap SUI for USDC | tx:0x1 | usd:$4.00 | blob:pending",
      "action log: 2026-01-02T00:00:00.000Z | Transfer 1 SUI to 888.sui | tx:0x2 | usd:$2.00 | blob:pending",
    ];
    const res = await GET(req(`http://localhost/api/user-stats?wallet=${ADDR}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.txCount).toBe(2);
    expect(body.stats.actions.swap).toBe(1);
    expect(body.stats.actions.transfer).toBe(1);
    const earned = body.badges.earned.map((b: { id: string }) => b.id);
    expect(earned).toContain("newbie");
    expect(earned).toContain("first-swap");
    expect(body.memoryEnabled).toBe(true);
    // Recent receipts surfaced newest-first; daily usage present.
    expect(body.recentReceipts).toHaveLength(2);
    expect(body.recentReceipts[0].actionLabel).toBe("Transfer 1 SUI to 888.sui"); // 01-02 newest
    expect(body.dailyUsage).toHaveProperty("usedUsd");
    expect(body.dailyUsage).toHaveProperty("capUsd");
  });
});
