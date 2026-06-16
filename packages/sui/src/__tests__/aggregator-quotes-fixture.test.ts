/**
 * Tests: Cetus-Aggregator fixture quote — deterministic best-execution edge.
 *
 * The aggregator fixture must (a) follow the same SwapQuote contract as the Cetus
 * source so the Guardian can re-derive uniformly, and (b) quote a slightly better
 * output than the single-pool Cetus fixture so the best-route selection is
 * demonstrable and deterministic in demo mode.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { COIN_TYPES } from "../allowlist";
import { fetchSwapQuote } from "../quotes-source";
import { fetchAggregatorQuote } from "../aggregator-quotes";

describe("aggregator fixture quote", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture"));
  afterEach(() => vi.unstubAllEnvs());

  it("follows the SwapQuote contract with a stable best-execution edge over Cetus", async () => {
    const amountIn = 1_000_000_000n; // 1 SUI
    const cetus = await fetchSwapQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, amountIn, 50);
    const agg = await fetchAggregatorQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, amountIn, 50);

    expect(agg.source).toBe("fixture");
    expect(agg.coinTypeIn).toBe(COIN_TYPES.SUI);
    expect(agg.coinTypeOut).toBe(COIN_TYPES.USDC);
    // +0.3% edge over the single-pool Cetus fixture (3_000_000 → 3_009_000).
    expect(agg.estimatedAmountOut).toBe(3_009_000n);
    expect(agg.estimatedAmountOut).toBeGreaterThan(cetus.estimatedAmountOut);
    // min-out applies slippage to the estimate.
    expect(agg.minAmountOut).toBe((3_009_000n * 9_950n) / 10_000n);
    expect(agg.routeProviders).toContain("CETUS");
  });

  it("best-route (max estimatedAmountOut) selects the aggregator on the demo pair", async () => {
    const amountIn = 1_000_000_000n;
    const cetus = await fetchSwapQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, amountIn, 50);
    const agg = await fetchAggregatorQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, amountIn, 50);
    const best = agg.estimatedAmountOut > cetus.estimatedAmountOut ? "aggregator" : "cetus";
    expect(best).toBe("aggregator");
  });
});
