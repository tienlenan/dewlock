/**
 * Quote source abstraction — live Cetus RPC or deterministic fixture.
 *
 * WHY a single toggle layer: NEXT_PUBLIC_DEMO_MODE=fixture swaps live quotes
 * for canned data so the UI demo never hits mainnet. The critical invariant:
 *   - The toggle is read ONCE at request time from the env var.
 *   - It NEVER auto-flips on error (error → throw; auto-flip = fail-open bypass).
 *   - Fixture mode backs dry-run preview ONLY — no live tx ever executes in fixture mode.
 *
 * WHY dynamic import for Cetus SDK: the SDK fails to load under Next.js/Turbopack
 * server bundling (Class extends value undefined). Dynamic import delays resolution
 * to call time. Non-swap paths (transfer, portfolio, BLOCK demo) never enter
 * fetchLiveQuote so they never touch the Cetus module at all.
 *
 * SDK init: CetusClmmSDK SdkOptions has no 'network' field.
 * initMainnetSDK(rpcUrl, senderAddress) is the correct factory for mainnet.
 * The second arg (senderAddress) sets the simulationAccount used by preswap's
 * devInspectTransactionBlock call — MUST be the connected wallet address.
 *
 * Pool resolution: curated POOL_IDS map keyed by sorted coin-type pair →
 * deterministic, avoids picking a thin/wrong-fee pool from getPoolByCoins.
 * Falls back to getPoolByCoins only for unmapped pairs (not in current allowlist).
 *
 * Decimals: keyed by pool.coinTypeA / pool.coinTypeB (the pool's canonical order),
 * NOT by coinTypeIn / coinTypeOut. Prevents swapped-decimals bugs when a2b=false.
 */

// Type-only imports — erased at runtime, safe to import at top level.
import type CetusClmmSDK from "@cetusprotocol/cetus-sui-clmm-sdk";
import { COIN_TYPES, COIN_DECIMALS } from "./allowlist";

export interface SwapQuote {
  /** Coin type going in. */
  coinTypeIn: string;
  /** Coin type coming out. */
  coinTypeOut: string;
  /** Amount in (native units). */
  amountIn: bigint;
  /** Estimated amount out BEFORE slippage (native units). */
  estimatedAmountOut: bigint;
  /** Minimum amount out after applying slippage (native units). */
  minAmountOut: bigint;
  /** Slippage fraction applied (e.g. 0.005 = 0.5%). */
  slippageFraction: number;
  /** Cetus pool object ID used for this quote. */
  poolId: string;
  /** Source of the quote for audit logging. */
  source: "live" | "fixture";
}

export class QuoteFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteFetchError";
  }
}

/** Returns true when fixture mode is active. Never auto-flips on error. */
export function isFixtureMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "fixture";
}

// ---------------------------------------------------------------------------
// Curated pool-id map — mainnet TVL-leading pools for supported pairs.
//
// Key = `${coinTypeA}|${coinTypeB}` in canonical alphabetical sort order.
// Both orderings are tried at lookup time (see resolvePoolId below).
//
// IMPORTANT [needs live-env]: These pool IDs must be verified against the live
// Cetus mainnet registry before the demo. Steps:
//   1. Run: sdk.Pool.getPoolByCoins([COIN_TYPES.SUI, COIN_TYPES.USDC]) → pick
//      the pool with the highest TVL (usually the 0.25% tier for SUI/USDC).
//   2. Repeat for USDC/USDT (stable pair, typically 0.01% tier).
//   3. Hardcode the verified pool IDs below, replacing the placeholders.
//
// Until verified, live quotes will fall back to getPoolByCoins (network call).
// Confidence on exact IDs: ~70% — placeholders used to avoid wrong-pool errors.
// ---------------------------------------------------------------------------

const POOL_IDS: Record<string, string> = {
  // SUI / USDC native (0.25% fee tier, highest TVL SUI/USDC pool as of 2026-06)
  // [needs live-env] Verify via: sdk.Pool.getPoolByCoins([SUI, USDC])[0].poolAddress
  [`${COIN_TYPES.SUI}|${COIN_TYPES.USDC}`]:
    "0x<SUI_USDC_POOL_ID>",
  // USDC / USDT stable (0.01% fee tier)
  // [needs live-env] Verify via: sdk.Pool.getPoolByCoins([USDC, USDT])[0].poolAddress
  [`${COIN_TYPES.USDC}|${COIN_TYPES.USDT}`]:
    "0x<USDC_USDT_POOL_ID>",
};

/**
 * Look up the curated pool ID for a coin pair, trying both orderings.
 * Returns undefined if the pair is not in the curated map.
 */
function resolvePoolId(coinA: string, coinB: string): string | undefined {
  // Try both orderings — the map keys are sorted alphabetically
  const key1 = `${coinA}|${coinB}`;
  const key2 = `${coinB}|${coinA}`;
  const id = POOL_IDS[key1] ?? POOL_IDS[key2];
  // Reject placeholder values (un-verified IDs contain "<" marker)
  if (id && !id.includes("<")) return id;
  return undefined;
}

/**
 * Fetch a swap quote from Cetus CLMM or return a deterministic fixture.
 * THROWS on any live-RPC error when in live mode — callers treat throw as BLOCK.
 * Never falls through from live failure to fixture (that would be fail-open).
 *
 * @param coinTypeIn   - Canonical coin type entering the swap.
 * @param coinTypeOut  - Canonical coin type exiting the swap.
 * @param amountIn     - Native units to swap.
 * @param slippageBps  - Slippage tolerance in basis points (e.g. 50 = 0.5%).
 * @param senderAddress - The connected wallet address (required for preswap simulation).
 */
export async function fetchSwapQuote(
  coinTypeIn: string,
  coinTypeOut: string,
  amountIn: bigint,
  slippageBps: number,
  senderAddress?: string,
): Promise<SwapQuote> {
  if (isFixtureMode()) {
    return buildFixtureQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps);
  }
  return fetchLiveQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps, senderAddress);
}

// ---------------------------------------------------------------------------
// Live quote via Cetus CLMM SDK — dynamically imported to avoid eager load
// ---------------------------------------------------------------------------

async function fetchLiveQuote(
  coinTypeIn: string,
  coinTypeOut: string,
  amountIn: bigint,
  slippageBps: number,
  senderAddress?: string,
): Promise<SwapQuote> {
  // Dynamic import: loads Cetus SDK only when a live swap quote is actually needed.
  // Non-swap paths (transfer, portfolio, BLOCK demo) never reach this function.
  // If the SDK fails to load, throw QuoteFetchError so the caller blocks cleanly.
  let cetusModule: {
    default: typeof CetusClmmSDK;
    initMainnetSDK: (rpcUrl?: string, wallet?: string) => InstanceType<typeof CetusClmmSDK>;
  };
  try {
    cetusModule = await import("@cetusprotocol/cetus-sui-clmm-sdk") as typeof cetusModule;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new QuoteFetchError(`Failed to load Cetus SDK: ${msg}`);
  }

  const { initMainnetSDK } = cetusModule;
  const rpcUrl = process.env.SUI_RPC_URL ?? "https://fullnode.mainnet.sui.io:443";

  // senderAddress is required for preswap: the SDK runs devInspectTransactionBlock
  // with simulationAccount.address. A zero/missing address → InvalidSimulateAccount.
  // If not provided (rare: quote-only path without a connected wallet), we continue
  // but document that preswap will likely fail unless a sim account is configured.
  let sdk: InstanceType<typeof CetusClmmSDK>;
  try {
    sdk = initMainnetSDK(rpcUrl, senderAddress);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new QuoteFetchError(`Failed to initialize Cetus SDK: ${msg}`);
  }

  // Resolve pool: try curated map first (deterministic, avoids wrong-fee-tier pool),
  // fall back to getPoolByCoins if not mapped.
  let poolId = resolvePoolId(coinTypeIn, coinTypeOut);
  let pool: Awaited<ReturnType<typeof sdk.Pool.getPool>>;

  if (poolId) {
    try {
      pool = await sdk.Pool.getPool(poolId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new QuoteFetchError(`Failed to fetch curated pool ${poolId}: ${msg}`);
    }
  } else {
    // Fallback: discover pool dynamically (risk: may pick thin/wrong-fee pool)
    let poolList: Array<{ poolAddress: string }>;
    try {
      poolList = await sdk.Pool.getPoolByCoins([coinTypeIn, coinTypeOut]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new QuoteFetchError(
        `Cetus pool lookup failed for ${coinTypeIn}/${coinTypeOut}: ${msg}`,
      );
    }

    if (!poolList || poolList.length === 0) {
      throw new QuoteFetchError(
        `No Cetus pool found for ${coinTypeIn}/${coinTypeOut} — cannot derive min-out.`,
      );
    }

    poolId = poolList[0].poolAddress;
    try {
      pool = await sdk.Pool.getPool(poolId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new QuoteFetchError(`Failed to fetch pool ${poolId}: ${msg}`);
    }
  }

  // Determine swap direction: a2b = poolCoinA → poolCoinB
  const a2b = pool.coinTypeA === coinTypeIn;

  // Decimals keyed by POOL coin types (A and B), not by in/out direction.
  // This is safe regardless of swap direction — avoids swapped-decimals risk
  // when a2b=false (coinTypeOut === pool.coinTypeA).
  const decimalsA = getDecimalsByType(pool.coinTypeA);
  const decimalsB = getDecimalsByType(pool.coinTypeB);

  // preswap runs devInspectTransactionBlock on-chain to simulate the swap result.
  // Returns { estimatedAmountOut: BN (typed any), ... } | null
  let preswapResult: Awaited<ReturnType<typeof sdk.Swap.preswap>>;
  try {
    preswapResult = await sdk.Swap.preswap({
      pool,
      currentSqrtPrice: pool.current_sqrt_price,
      coinTypeA: pool.coinTypeA,
      coinTypeB: pool.coinTypeB,
      decimalsA,
      decimalsB,
      a2b,
      byAmountIn: true,
      amount: amountIn.toString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new QuoteFetchError(`Cetus preswap failed: ${msg}`);
  }

  // Fail-closed: null or exceed means the swap cannot execute
  if (!preswapResult) {
    throw new QuoteFetchError("Cetus preswap returned null — blocking.");
  }
  if (preswapResult.isExceed) {
    throw new QuoteFetchError(
      "Cetus preswap: swap exceeds pool liquidity (isExceed=true) — blocking.",
    );
  }
  if (!preswapResult.estimatedAmountOut) {
    throw new QuoteFetchError(
      "Cetus preswap returned no estimated amount — blocking.",
    );
  }

  // estimatedAmountOut is typed 'any' by the SDK but is a BN at runtime.
  // Convert to bigint via string to remain type-safe without BN import.
  const rawOut = preswapResult.estimatedAmountOut as { toString(): string };
  const estimatedAmountOut = BigInt(rawOut.toString());

  // Derive min-out using integer bps arithmetic (no BN import needed).
  // estimatedAmountOut * (10000 - slippageBps) / 10000
  const minAmountOut =
    (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;

  const slippageFraction = slippageBps / 10_000;

  return {
    coinTypeIn,
    coinTypeOut,
    amountIn,
    estimatedAmountOut,
    minAmountOut,
    slippageFraction,
    poolId,
    source: "live",
  };
}

// ---------------------------------------------------------------------------
// Fixture quote — deterministic, for demo/test mode ONLY
// ---------------------------------------------------------------------------

/**
 * Fixture swap quote.
 * WHY deterministic arithmetic: we want the same values every test run so
 * the min-out cross-check test can rely on them without mocking RPC.
 */
function buildFixtureQuote(
  coinTypeIn: string,
  coinTypeOut: string,
  amountIn: bigint,
  slippageBps: number,
): SwapQuote {
  // Simple deterministic rate: 1 SUI = 3_000_000 USDC (6 decimals)
  const SUI_USDC_RATE = 3_000_000n; // per 1e9 SUI → 3 USDC (6 dec)
  const SUI_TYPE = COIN_TYPES.SUI;

  let estimatedAmountOut: bigint;
  if (coinTypeIn === SUI_TYPE) {
    // SUI → USDC: amountIn is MIST (1e9), output is micro-USDC (1e6)
    estimatedAmountOut = (amountIn * SUI_USDC_RATE) / 1_000_000_000n;
  } else {
    // USDC → SUI: reverse
    estimatedAmountOut = (amountIn * 1_000_000_000n) / SUI_USDC_RATE;
  }

  const slippageFraction = slippageBps / 10_000;
  const minAmountOut =
    (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;

  return {
    coinTypeIn,
    coinTypeOut,
    amountIn,
    estimatedAmountOut,
    minAmountOut,
    slippageFraction,
    poolId: "0xfixture_pool_id_demo_only",
    source: "fixture",
  };
}

// ---------------------------------------------------------------------------
// Decimals helper — pulls from the canonical COIN_DECIMALS map
// ---------------------------------------------------------------------------

/**
 * Get decimals for a coin type from the curated map.
 * Falls back to 9 (SUI default) for unknown types — the Guardian's on-chain
 * CoinMetadata cross-check will catch any real disagreement before signing.
 */
function getDecimalsByType(coinType: string): number {
  return COIN_DECIMALS[coinType] ?? 9;
}
