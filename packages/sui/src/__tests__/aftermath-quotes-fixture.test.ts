/**
 * Tests: Aftermath Router fixture quote — deterministic contract validation.
 *
 * The Aftermath fixture must (a) follow the same SwapQuote contract as the
 * aggregator source so the Guardian can re-derive min-out uniformly regardless
 * of which source is chosen, and (b) quote a distinct stable output (+0.2% over
 * the Cetus single-pool fixture) for best-source comparison in demo mode.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { COIN_TYPES } from "../allowlist";
import { fetchSwapQuote } from "../quotes-source";
import { fetchAggregatorQuote } from "../aggregator-quotes";
import { fetchAftermathQuote } from "../aftermath-quotes";

describe("aftermath fixture quote", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture"));
  afterEach(() => vi.unstubAllEnvs());

  it("follows the SwapQuote contract with a stable +0.2% edge over Cetus fixture", async () => {
    const amountIn = 1_000_000_000n; // 1 SUI
    const cetus = await fetchSwapQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, amountIn, 50);
    const af = await fetchAftermathQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, amountIn, 50);

    expect(af.source).toBe("fixture");
    expect(af.coinTypeIn).toBe(COIN_TYPES.SUI);
    expect(af.coinTypeOut).toBe(COIN_TYPES.USDC);
    // Cetus fixture = 3_000_000; Aftermath fixture = +0.2% = 3_006_000.
    expect(af.estimatedAmountOut).toBe(3_006_000n);
    expect(af.estimatedAmountOut).toBeGreaterThan(cetus.estimatedAmountOut);
    // min-out applies slippage (50 bps = 9950/10000) to the estimate.
    expect(af.minAmountOut).toBe((3_006_000n * 9_950n) / 10_000n);
    expect(af.routeProviders).toContain("AFTERMATH");
  });

  it("aggregator quotes higher than aftermath in fixture mode (agg gets +0.3%, af +0.2%)", async () => {
    const amountIn = 1_000_000_000n;
    const agg = await fetchAggregatorQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, amountIn, 50);
    const af = await fetchAftermathQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, amountIn, 50);
    // Both beat Cetus; aggregator wins in fixture (3_009_000 > 3_006_000).
    expect(agg.estimatedAmountOut).toBeGreaterThan(af.estimatedAmountOut);
  });

  it("returns a valid SwapQuote shape (all required fields present)", async () => {
    const af = await fetchAftermathQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, 1_000_000_000n, 50);
    expect(typeof af.coinTypeIn).toBe("string");
    expect(typeof af.coinTypeOut).toBe("string");
    expect(typeof af.estimatedAmountOut).toBe("bigint");
    expect(typeof af.minAmountOut).toBe("bigint");
    expect(af.minAmountOut).toBeLessThanOrEqual(af.estimatedAmountOut);
    expect(Array.isArray(af.routeProviders)).toBe(true);
  });
});
