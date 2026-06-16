/**
 * Cetus Aggregator quote source — best-execution route across activated venues.
 *
 * WHY this is Guardian-friendly: findRouters() returns a decomposed route with a
 * concrete amountOut, so the Guardian can re-derive min-out from an INDEPENDENT
 * aggregator quote of the SAME source (never crossing a Cetus quote with an
 * aggregator PTB). Same `SwapQuote` contract as the Cetus source.
 *
 * WHY routing is constrained to activated venues: the aggregator wraps each DEX
 * as `<AGG_PKG>::<dex>::swap`. We only allowlist the wrappers for activated
 * protocols (Cetus + DeepBook), and we ask the router to only consider those
 * providers — so a route can never depend on an excluded/unvetted DEX.
 *
 * WHY dynamic import: same rationale as the Cetus SDK — keep the heavy SDK out of
 * non-swap bundles; resolve it only when a live aggregator quote is needed.
 */

import { COIN_TYPES, COIN_DECIMALS } from "./allowlist";
import { isFixtureMode, QuoteFetchError, type SwapQuote } from "./quotes-source";

// Only providers whose on-chain venue Dewlock has activated + allowlisted.
// Expanding this list requires activating that protocol in the registry first.
export const AGGREGATOR_ACTIVE_PROVIDERS = ["CETUS", "DEEPBOOK"] as const;

const ROUTER_ENDPOINT =
  process.env.CETUS_AGGREGATOR_ENDPOINT ?? "https://api-sui.cetus.zone/router_v3";

/**
 * Fetch a best-execution aggregator quote, or a deterministic fixture.
 * THROWS QuoteFetchError on any live failure — callers treat throw as BLOCK
 * (never falls through to fixture; that would be fail-open).
 */
export async function fetchAggregatorQuote(
  coinTypeIn: string,
  coinTypeOut: string,
  amountIn: bigint,
  slippageBps: number,
  senderAddress?: string,
): Promise<SwapQuote> {
  if (isFixtureMode()) {
    return buildFixtureAggregatorQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps);
  }
  return fetchLiveAggregatorQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps, senderAddress);
}

async function fetchLiveAggregatorQuote(
  coinTypeIn: string,
  coinTypeOut: string,
  amountIn: bigint,
  slippageBps: number,
  senderAddress?: string,
): Promise<SwapQuote> {
  let mod: typeof import("@cetusprotocol/aggregator-sdk");
  try {
    mod = await import("@cetusprotocol/aggregator-sdk");
  } catch (err) {
    throw new QuoteFetchError(
      `Failed to load Cetus aggregator SDK: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let router: Awaited<ReturnType<InstanceType<typeof mod.AggregatorClient>["findRouters"]>>;
  try {
    const client = new mod.AggregatorClient({
      endpoint: ROUTER_ENDPOINT,
      signer: senderAddress,
      env: mod.Env.Mainnet,
    });
    router = await client.findRouters({
      from: coinTypeIn,
      target: coinTypeOut,
      amount: amountIn.toString(),
      byAmountIn: true,
      providers: [...AGGREGATOR_ACTIVE_PROVIDERS],
    });
  } catch (err) {
    throw new QuoteFetchError(
      `Aggregator findRouters failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Fail-closed: no route / no decomposed output ⇒ min-out is unverifiable ⇒ BLOCK.
  if (!router || router.amountOut == null) {
    throw new QuoteFetchError(
      "Aggregator returned no route (or no amountOut) — min-out unverifiable, blocking.",
    );
  }

  const estimatedAmountOut = BigInt(router.amountOut.toString());
  const minAmountOut = (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
  const routeProviders = extractProviders(router);

  return {
    coinTypeIn,
    coinTypeOut,
    amountIn,
    estimatedAmountOut,
    minAmountOut,
    slippageFraction: slippageBps / 10_000,
    poolId: "aggregator",
    source: "live",
    routeProviders,
  };
}

/** Pull the venue names out of a router result for the preview card. */
function extractProviders(router: unknown): string[] {
  const paths = (router as { paths?: Array<{ provider?: string }> })?.paths ?? [];
  return [...new Set(paths.map((p) => p.provider).filter((p): p is string => !!p))];
}

/**
 * Deterministic fixture aggregator quote.
 * Uses the same SUI/USDC rate as the Cetus fixture but with a small best-execution
 * edge (+0.3%) so the "best route" selection is demonstrable and tests are stable.
 */
function buildFixtureAggregatorQuote(
  coinTypeIn: string,
  coinTypeOut: string,
  amountIn: bigint,
  slippageBps: number,
): SwapQuote {
  const SUI_USDC_RATE = 3_000_000n; // 1 SUI → 3 USDC (6 dec), matches the Cetus fixture
  let base: bigint;
  if (coinTypeIn === COIN_TYPES.SUI) {
    base = (amountIn * SUI_USDC_RATE) / 1_000_000_000n;
  } else {
    base = (amountIn * 1_000_000_000n) / SUI_USDC_RATE;
  }
  // +0.3% best-execution edge over the single-pool Cetus fixture.
  const estimatedAmountOut = (base * 1003n) / 1000n;
  const minAmountOut = (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
  void COIN_DECIMALS; // decimals cross-check is the Guardian's job, not the quote's

  return {
    coinTypeIn,
    coinTypeOut,
    amountIn,
    estimatedAmountOut,
    minAmountOut,
    slippageFraction: slippageBps / 10_000,
    poolId: "aggregator",
    source: "fixture",
    routeProviders: ["CETUS", "DEEPBOOK"],
  };
}
