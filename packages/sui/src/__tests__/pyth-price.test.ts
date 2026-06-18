/**
 * pyth-price + getTrustedUsdPrice safety tests.
 *
 * Locks the red-team-critical invariant: the Pyth price feeds the Guardian USD cap,
 * where UNDER-valuing is the dangerous direction — so a low/stale/wide-confidence feed
 * must only ever clamp UP to the conservative floor (`max(pyth, floor)`), never below.
 * Network is mocked; each test gets a fresh module (empty cache).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ETH_FEED = "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

function hermesPayload(priceUsd: number, opts: { conf?: number; ageS?: number } = {}) {
  // Hermes returns integer price + expo; encode the human price at expo -8.
  const expo = -8;
  const price = Math.round(priceUsd * 10 ** -expo).toString();
  const conf = Math.round((opts.conf ?? 0) * 10 ** -expo).toString();
  const publish_time = Math.floor(Date.now() / 1000) - (opts.ageS ?? 0);
  return { parsed: [{ id: ETH_FEED, price: { price, expo, conf, publish_time } }] };
}

function mockFetch(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => payload }) as Response));
}

async function freshModules() {
  vi.resetModules();
  const pyth = await import("../pyth-price");
  const pc = await import("../protocol-constants");
  return { pyth, pc };
}

describe("pyth-price — parse + validation", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllGlobals());

  it("a fresh, tight-confidence feed populates the cache", async () => {
    mockFetch(hermesPayload(1733.5, { conf: 1.0 }));
    const { pyth, pc } = await freshModules();
    await pyth.refreshPythPrices();
    expect(pyth.getCachedPythPrice(pc.COIN_TYPES.WETH)).toBeCloseTo(1733.5, 1);
  });

  it("a wide-confidence feed is rejected (treated as missing)", async () => {
    mockFetch(hermesPayload(1733, { conf: 200 })); // 200/1733 ≈ 11.5% > 2% band
    const { pyth, pc } = await freshModules();
    await pyth.refreshPythPrices();
    expect(pyth.getCachedPythPrice(pc.COIN_TYPES.WETH)).toBeUndefined();
  });

  it("a stale feed is rejected (treated as missing)", async () => {
    mockFetch(hermesPayload(1733, { ageS: 600 })); // 10 min old > 90s
    const { pyth, pc } = await freshModules();
    await pyth.refreshPythPrices();
    expect(pyth.getCachedPythPrice(pc.COIN_TYPES.WETH)).toBeUndefined();
  });
});

describe("getTrustedUsdPrice — cap-safety (max(pyth, floor))", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllGlobals());

  it("a glitch-LOW Pyth price clamps UP to the floor (never below) — the cap stays safe", async () => {
    mockFetch(hermesPayload(5, { conf: 0.01 })); // ETH "crashes" to $5 (a feed glitch)
    const { pyth, pc } = await freshModules();
    await pyth.refreshPythPrices();
    // max($5, $800 floor) = $800 — the cap values WETH at the floor, not the glitch.
    expect(pc.getTrustedUsdPrice(pc.COIN_TYPES.WETH)).toBe(800);
  });

  it("a healthy HIGH Pyth price is used as-is (tighter than the floor)", async () => {
    mockFetch(hermesPayload(3000, { conf: 1.0 }));
    const { pyth, pc } = await freshModules();
    await pyth.refreshPythPrices();
    expect(pc.getTrustedUsdPrice(pc.COIN_TYPES.WETH)).toBeCloseTo(3000, 0);
  });

  it("cold cache → conservative floor, not a block (WETH swappable)", async () => {
    mockFetch({ parsed: [] }); // no feeds returned
    const { pc } = await freshModules();
    expect(pc.getTrustedUsdPrice(pc.COIN_TYPES.WETH)).toBe(800);
    expect(pc.getTrustedUsdPrice(pc.COIN_TYPES.wBTC)).toBe(15000);
  });

  it("an unpriced coin (no feed, no floor) stays undefined → Guardian blocks", async () => {
    mockFetch({ parsed: [] });
    const { pc } = await freshModules();
    expect(pc.getTrustedUsdPrice("0xdead::fake::FAKE")).toBeUndefined();
  });
});
