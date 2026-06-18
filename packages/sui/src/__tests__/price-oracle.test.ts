/**
 * price-oracle (CoinGecko) + getTrustedUsdPrice safety tests.
 *
 * Locks the red-team-critical invariant: the live price feeds the Guardian USD cap,
 * where UNDER-valuing is the dangerous direction — so a low/stale price must only ever
 * clamp UP to the conservative floor (`max(price, floor)`), never below. Network is
 * mocked; each test gets a fresh module (empty cache).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// CoinGecko ids used by the oracle. WETH→ethereum, wBTC→bitcoin.
const ETH_ID = "ethereum";
const BTC_ID = "bitcoin";

function cgPayload(id: string, priceUsd: number, opts: { ageS?: number } = {}) {
  // CoinGecko /simple/price?include_last_updated_at=true shape: { <id>: { usd, last_updated_at } }.
  const last_updated_at = Math.floor(Date.now() / 1000) - (opts.ageS ?? 0);
  return { [id]: { usd: priceUsd, last_updated_at } };
}

function mockFetch(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => payload }) as Response));
}

async function freshModules() {
  vi.resetModules();
  const oracle = await import("../price-oracle");
  const pc = await import("../protocol-constants");
  return { oracle, pc };
}

describe("price-oracle — parse + validation", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllGlobals());

  it("a fresh price populates the cache", async () => {
    mockFetch(cgPayload(ETH_ID, 1733.5));
    const { oracle, pc } = await freshModules();
    await oracle.refreshUsdPrices();
    expect(oracle.getCachedUsdPrice(pc.COIN_TYPES.WETH)).toBeCloseTo(1733.5, 1);
  });

  it("a stale price is rejected (treated as missing)", async () => {
    mockFetch(cgPayload(ETH_ID, 1733, { ageS: 1200 })); // 20 min old > 10 min bound
    const { oracle, pc } = await freshModules();
    await oracle.refreshUsdPrices();
    expect(oracle.getCachedUsdPrice(pc.COIN_TYPES.WETH)).toBeUndefined();
  });

  it("a non-positive / malformed price is rejected", async () => {
    mockFetch({ [ETH_ID]: { usd: 0 } });
    const { oracle, pc } = await freshModules();
    await oracle.refreshUsdPrices();
    expect(oracle.getCachedUsdPrice(pc.COIN_TYPES.WETH)).toBeUndefined();
  });
});

describe("getTrustedUsdPrice — cap-safety (max(price, floor))", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllGlobals());

  it("a glitch-LOW price clamps UP to the floor (never below) — the cap stays safe", async () => {
    mockFetch(cgPayload(ETH_ID, 5)); // ETH "crashes" to $5 (a feed glitch)
    const { oracle, pc } = await freshModules();
    await oracle.refreshUsdPrices();
    // max($5, $800 floor) = $800 — the cap values WETH at the floor, not the glitch.
    expect(pc.getTrustedUsdPrice(pc.COIN_TYPES.WETH)).toBe(800);
  });

  it("a healthy HIGH price is used as-is (tighter than the floor)", async () => {
    mockFetch(cgPayload(ETH_ID, 3000));
    const { oracle, pc } = await freshModules();
    await oracle.refreshUsdPrices();
    expect(pc.getTrustedUsdPrice(pc.COIN_TYPES.WETH)).toBeCloseTo(3000, 0);
  });

  it("cold cache → conservative floor, not a block (WETH/wBTC swappable)", async () => {
    mockFetch({}); // no prices returned
    const { pc } = await freshModules();
    expect(pc.getTrustedUsdPrice(pc.COIN_TYPES.WETH)).toBe(800);
    expect(pc.getTrustedUsdPrice(pc.COIN_TYPES.wBTC)).toBe(15000);
  });

  it("an unpriced coin (no feed, no floor) stays undefined → Guardian blocks", async () => {
    mockFetch({});
    const { pc } = await freshModules();
    expect(pc.getTrustedUsdPrice("0xdead::fake::FAKE")).toBeUndefined();
  });

  it("a healthy BTC price flows through to wBTC", async () => {
    mockFetch(cgPayload(BTC_ID, 64000));
    const { oracle, pc } = await freshModules();
    await oracle.refreshUsdPrices();
    expect(pc.getTrustedUsdPrice(pc.COIN_TYPES.wBTC)).toBeCloseTo(64000, 0);
  });
});
