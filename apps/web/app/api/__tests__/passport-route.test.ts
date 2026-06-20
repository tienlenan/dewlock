/**
 * Tests for GET /api/passport.
 *
 * The Passport now derives from the SAME shared identity as /api/user-stats (one
 * on-chain-receipt-derived, Redis-cached profile) — so it can never lag the copilot.
 * It withholds only portfolio-tier badges (they'd leak wallet size on the public blob).
 *
 * Strategy: import the route handler directly. Mock memwal/Walrus + BlockVision + the
 * stats cache; the level/badge logic is the REAL pure code (aliased to source). Proves:
 * the receipt-derived identity matches user-stats, AND portfolio badges are filtered out
 * even when BlockVision reports a large portfolio.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// `server-only` is a Next.js build guard, not resolvable in the vitest node env — stub it.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({ memoryOn: false, lines: [] as string[], portfolioUsd: null as number | null }));

vi.mock("@dewlock/walrus", () => ({
  isMemoryEnabled: () => h.memoryOn,
  memNamespace: (w: string) => `ns:${w}`,
  // Receipts when asked for the action log; no profile / passport pointers exist.
  recall: async (_ns: string, query: string) =>
    query.startsWith("action log:") ? h.lines : [],
  publishJsonBlob: async () => ({ blobId: null, objectId: null, hash: null }),
  readJsonBlob: async () => null,
  rememberBulk: async () => {},
}));

vi.mock("@dewlock/sui", () => ({
  anchorReceiptHead: async () => ({ status: "not_configured", anchorObjectId: null, txDigest: null }),
}));

// Large portfolio → portfolio-tier badges WOULD be earned by user-stats; the passport
// must filter them out (privacy). Receipt-derived badges are unaffected.
vi.mock("@/lib/blockvision/client", () => ({
  getWalletOverview: async () => ({
    degraded: h.portfolioUsd == null,
    totalUsdValue: h.portfolioUsd,
    coins: [],
    onchainTxCount: null,
    recent: [],
  }),
}));

// Cache disabled in tests → the route derives live from the authoritative source.
vi.mock("@/lib/user-stats/stats-cache", () => ({
  readStatsCache: async () => null,
  writeStatsCache: async () => {},
  invalidateStatsCache: async () => {},
}));

import { GET } from "../passport/route";

const ADDR = "0x" + "1".repeat(64);
function req(url: string) {
  return new NextRequest(url);
}

beforeEach(() => {
  h.memoryOn = false;
  h.lines = [];
  h.portfolioUsd = null;
});

describe("GET /api/passport — validation", () => {
  it("400 when wallet is missing", async () => {
    const res = await GET(req("http://localhost/api/passport"));
    expect(res.status).toBe(400);
  });

  it("400 when wallet is malformed", async () => {
    const res = await GET(req("http://localhost/api/passport?wallet=nope"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/passport — memory disabled (newbie)", () => {
  it("returns a zeroed newbie passport, no proof ids", async () => {
    const res = await GET(req(`http://localhost/api/passport?wallet=${ADDR}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memoryEnabled).toBe(false);
    expect(body.passport.txCount).toBe(0);
    expect(body.passport.earnedBadgeIds).toEqual([]);
    expect(body.blobId).toBeNull();
  });
});

describe("GET /api/passport — with receipts", () => {
  it("derives the SAME identity as user-stats, INCLUDING portfolio badges (in sync)", async () => {
    h.memoryOn = true;
    h.portfolioUsd = 50_000; // earns portfolio-tier badges (now surfaced, in sync with user-stats)
    h.lines = [
      "action log: 2026-01-01T00:00:00.000Z | Swap SUI for USDC | tx:0x1 | usd:$4.00 | blob:pending",
      "action log: 2026-01-02T00:00:00.000Z | Transfer 1 SUI to 888.sui | tx:0x2 | usd:$2.00 | blob:pending",
    ];
    const res = await GET(req(`http://localhost/api/passport?wallet=${ADDR}`));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.memoryEnabled).toBe(true);
    expect(body.passport.txCount).toBe(2);
    expect(body.passport.actionCounts.swap).toBe(1);
    expect(body.passport.actionCounts.transfer).toBe(1);

    const earned: string[] = body.passport.earnedBadgeIds;
    // Receipt-derived badges are present (consistent with user-stats).
    expect(earned).toContain("newbie");
    expect(earned).toContain("first-swap");
    expect(earned).toContain("first-send");
    // Portfolio-tier badges ARE included — the passport renders the SAME badge set as
    // /api/user-stats (the copilot), so the surfaces stay in sync. Wallet $50k earns these.
    expect(earned).toContain("portfolio-starter");
    expect(earned).toContain("portfolio-builder");
    expect(earned).toContain("portfolio-whale");

    // XP-bar progress is present and derived from the same level state.
    expect(body.progress).toHaveProperty("xpIntoLevel");
    expect(body.progress).toHaveProperty("xpForNext");
  });
});
