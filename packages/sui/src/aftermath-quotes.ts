/**
 * Aftermath Router quote source — best-execution route across Aftermath AMM pools.
 *
 * WHY this is Guardian-friendly: getCompleteTradeRouteGivenAmountIn returns
 * coinOut.amount (estimated output), from which the Guardian re-derives min-out
 * independently when aftermath is the chosen source (never crossing an Aftermath
 * quote with a Cetus PTB). Same SwapQuote contract as the Cetus/aggregator sources.
 *
 * WHY dynamic import via esmImport wrapper: the aftermath-ts-sdk is ESM-only
 * (no CJS export). This package compiles to CommonJS so a plain `await import(pkg)`
 * is downleveled by tsc to require() and fails on an ESM-only package. Wrapping in
 * a Function keeps it a TRUE native dynamic import at runtime — opaque to tsc AND
 * to the bundler — so Node's ESM loader handles it. Identical pattern to build-lend.ts.
 *
 * WHY no provider pooling: the Aftermath SDK's Aftermath instance is cheap to
 * construct and the router is stateless across calls, so we construct per-call
 * to avoid shared-state issues in serverless runtimes.
 */

import { COIN_TYPES, COIN_DECIMALS } from "./allowlist";
import { isFixtureMode, QuoteFetchError, type SwapQuote } from "./quotes-source";

// esmImport: keeps the native dynamic import opaque to tsc so it is NOT downleveled
// to require() (which would break ESM-only packages). Same pattern as build-lend.ts.
const esmImport = new Function("s", "return import(s)") as <T = unknown>(s: string) => Promise<T>;

type AftermathSdk = typeof import("aftermath-ts-sdk");

async function loadAftermathSdk(): Promise<AftermathSdk> {
  return esmImport<AftermathSdk>("aftermath-ts-sdk");
}

/**
 * Fetch an Aftermath router quote, or a deterministic fixture.
 * THROWS QuoteFetchError on any live failure — callers treat throw as BLOCK
 * (never falls through to fixture; that would be fail-open).
 */
export async function fetchAftermathQuote(
  coinTypeIn: string,
  coinTypeOut: string,
  amountIn: bigint,
  slippageBps: number,
): Promise<SwapQuote> {
  if (isFixtureMode()) {
    return buildFixtureAftermathQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps);
  }
  return fetchLiveAftermathQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps);
}

async function fetchLiveAftermathQuote(
  coinTypeIn: string,
  coinTypeOut: string,
  amountIn: bigint,
  slippageBps: number,
): Promise<SwapQuote> {
  let mod: AftermathSdk;
  try {
    mod = await loadAftermathSdk();
  } catch (err) {
    throw new QuoteFetchError(
      `Failed to load Aftermath SDK: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let estimatedAmountOut: bigint;
  let routeSpotPrice: number | undefined;
  try {
    const af = new mod.Aftermath("MAINNET");
    const router = af.Router();
    const route = await router.getCompleteTradeRouteGivenAmountIn({
      coinInType: coinTypeIn,
      coinOutType: coinTypeOut,
      coinInAmount: amountIn,
    });

    // The route's coinOut.amount is the estimated output in native units.
    // It may come back as a bigint or a string depending on SDK version — normalise.
    const rawOut = (route as { coinOut?: { amount?: bigint | string } }).coinOut?.amount;
    if (rawOut == null) {
      throw new QuoteFetchError(
        "Aftermath router returned no coinOut.amount — route unverifiable, blocking.",
      );
    }
    estimatedAmountOut = typeof rawOut === "bigint" ? rawOut : BigInt(String(rawOut));
    if (estimatedAmountOut <= 0n) {
      throw new QuoteFetchError(
        "Aftermath router returned zero estimated output — route unverifiable, blocking.",
      );
    }

    // spotPrice may be on the route for display; not used in security checks.
    routeSpotPrice = (route as { spotPrice?: number }).spotPrice;
    void routeSpotPrice;
  } catch (err) {
    if (err instanceof QuoteFetchError) throw err;
    throw new QuoteFetchError(
      `Aftermath getCompleteTradeRouteGivenAmountIn failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const minAmountOut = (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
  void COIN_DECIMALS; // decimals cross-check is the Guardian's job, not the quote's

  return {
    coinTypeIn,
    coinTypeOut,
    amountIn,
    estimatedAmountOut,
    minAmountOut,
    slippageFraction: slippageBps / 10_000,
    poolId: "aftermath",
    source: "live",
    routeProviders: ["AFTERMATH"],
  };
}

/**
 * Deterministic fixture quote for Aftermath.
 * Slightly different rate from Cetus fixture (+0.2% vs Cetus, -0.1% vs Cetus aggregator)
 * so source comparison tests show realistic differentiation.
 */
function buildFixtureAftermathQuote(
  coinTypeIn: string,
  coinTypeOut: string,
  amountIn: bigint,
  slippageBps: number,
): SwapQuote {
  const SUI_USDC_RATE = 3_000_000n; // 1 SUI → 3 USDC (6 dec), same anchor as other fixtures
  let base: bigint;
  if (coinTypeIn === COIN_TYPES.SUI) {
    base = (amountIn * SUI_USDC_RATE) / 1_000_000_000n;
  } else {
    base = (amountIn * 1_000_000_000n) / SUI_USDC_RATE;
  }
  // +0.2% edge vs Cetus direct (gives a meaningful but stable comparison in tests).
  const estimatedAmountOut = (base * 1002n) / 1000n;
  const minAmountOut = (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;

  return {
    coinTypeIn,
    coinTypeOut,
    amountIn,
    estimatedAmountOut,
    minAmountOut,
    slippageFraction: slippageBps / 10_000,
    poolId: "aftermath",
    source: "fixture",
    routeProviders: ["AFTERMATH"],
  };
}
