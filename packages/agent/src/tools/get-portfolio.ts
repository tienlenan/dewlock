/**
 * getPortfolio — Mastra read tool returning coin balances via live getAllBalances + USD estimates.
 *
 * WHY getAllBalances (one RPC) instead of per-coin getBalance (5 RPCs):
 * A single getAllBalances call returns every coin the wallet holds — faster, cheaper,
 * and shows the user ALL positions (including non-curated coins) rather than only the
 * 5 supported types. Unknown coins get null USD (excluded from total) but are shown.
 *
 * WHY null USD for unknown coins: assigning a fabricated value would be an attack surface
 * (the cap gate uses this same price source). Unknown price → null → excluded from
 * totalEstimatedUsdValue, consistent with the Guardian's "unknown → block" stance.
 *
 * WHY getAllBalances and then per-coin getCoinMetadata: decimals + symbol for unknown types
 * come from on-chain CoinMetadata. A single getCoinMetadata failure degrades only that
 * row (null symbol/decimals fallback), never the whole portfolio (Promise.allSettled).
 *
 * USD value uses the same trusted price source as the Guardian (getTrustedUsdPrice)
 * so the portfolio display is consistent with cap enforcement.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSuiMainnetClient } from "@dewlock/sui";
import { COIN_TYPES, COIN_DECIMALS, getTrustedUsdPrice } from "../allowlist";

// ---------------------------------------------------------------------------
// Ticker reverse-map (coinType → ticker) for display
// ---------------------------------------------------------------------------

const COIN_TYPE_TO_TICKER: Record<string, string> = Object.fromEntries(
  Object.entries(COIN_TYPES).map(([ticker, coinType]) => [coinType, ticker]),
);

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const getPortfolio = createTool({
  id: "getPortfolio",
  description:
    "Fetch the user's on-chain coin balances for ALL held coin types. " +
    "Returns balances in both native units and estimated USD where a trusted price exists. " +
    "Unknown coin prices are null and excluded from the total. " +
    "Call this before answering any balance or portfolio question.",

  inputSchema: z.object({
    walletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address")
      .describe("The user's wallet address to query balances for"),
  }),

  outputSchema: z.object({
    walletAddress: z.string(),
    balances: z.array(
      z.object({
        coinType: z.string(),
        /** Ticker for display only — the coinType above is the authoritative identifier. */
        displayTicker: z.string(),
        /** Balance in native units (e.g. MIST for SUI). */
        nativeBalance: z.string(),
        /** Balance in human-readable decimal units. */
        humanBalance: z.string(),
        /** Estimated USD value (null if no trusted price or unknown coin). */
        estimatedUsdValue: z.number().nullable(),
        decimals: z.number(),
      }),
    ),
    /** Sum of all USD-valued positions (null/unknown excluded). */
    totalEstimatedUsdValue: z.number(),
    /** Network queried. */
    network: z.literal("mainnet"),
    /** True when NEXT_PUBLIC_DEMO_MODE=fixture — balances are canned fixture data. */
    demoFixture: z.boolean(),
  }),

  execute: async (inputData) => {
    const { walletAddress } = inputData;
    const isDemoFixture = process.env.NEXT_PUBLIC_DEMO_MODE === "fixture";

    if (isDemoFixture) {
      return buildFixturePortfolio(walletAddress);
    }

    return fetchLivePortfolio(walletAddress);
  },
});

// ---------------------------------------------------------------------------
// Live portfolio — one getAllBalances call, then per-unknown-coin getCoinMetadata
// ---------------------------------------------------------------------------

async function fetchLivePortfolio(walletAddress: string) {
  const client = getSuiMainnetClient();

  // One RPC to fetch every coin balance the wallet holds.
  // getAllBalances returns CoinBalance[] where totalBalance is a string.
  let rawBalances: Array<{
    coinType: string;
    coinObjectCount: number;
    totalBalance: string;
    lockedBalance?: Record<string, string>;
  }>;
  try {
    rawBalances = await client.getAllBalances({ owner: walletAddress });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // getAllBalances failure → return empty portfolio rather than throwing
    // (portfolio is read-only; partial failure is acceptable per tool contract)
    console.error("[getPortfolio] getAllBalances failed:", msg);
    rawBalances = [];
  }

  // For coins not in the curated COIN_DECIMALS map, fetch metadata from chain.
  // getCoinMetadata is called only for unknown types (fast path for known 5 types).
  const unknownTypes = rawBalances
    .map((b) => b.coinType)
    .filter((t) => COIN_DECIMALS[t] === undefined);

  const metadataResults = await Promise.allSettled(
    unknownTypes.map((coinType) =>
      client.getCoinMetadata({ coinType }).then((meta) => ({ coinType, meta })),
    ),
  );

  // Build a metadata cache for unknown types
  const metadataCache: Record<
    string,
    { decimals: number; symbol: string } | null
  > = {};
  for (const result of metadataResults) {
    if (result.status === "fulfilled" && result.value.meta) {
      const { coinType, meta } = result.value;
      metadataCache[coinType] = {
        decimals: meta.decimals,
        symbol: meta.symbol,
      };
    } else if (result.status === "fulfilled") {
      metadataCache[result.value.coinType] = null;
    }
    // On rejection: leave out of cache → treated as unknown below
  }

  const balances = rawBalances.map((raw) => {
    const { coinType, totalBalance } = raw;
    const nativeBalance = BigInt(totalBalance);

    // Decimals: curated map first, then on-chain metadata, then default 9
    const curatedDecimals = COIN_DECIMALS[coinType];
    const metaDecimals = metadataCache[coinType]?.decimals;
    const decimals = curatedDecimals ?? metaDecimals ?? 9;

    const humanBalance = (Number(nativeBalance) / 10 ** decimals).toFixed(6);

    // Ticker: curated reverse-map first, then on-chain symbol, then shortened coinType
    const curatedTicker = COIN_TYPE_TO_TICKER[coinType];
    const metaSymbol = metadataCache[coinType]?.symbol;
    const displayTicker =
      curatedTicker ?? metaSymbol ?? coinType.split("::").pop() ?? coinType;

    // USD: trusted price for known types; null for unknown (never fabricate)
    const usdPrice = getTrustedUsdPrice(coinType);
    const estimatedUsdValue =
      usdPrice != null
        ? (Number(nativeBalance) / 10 ** decimals) * usdPrice
        : null;

    return {
      coinType,
      displayTicker,
      nativeBalance: nativeBalance.toString(),
      humanBalance,
      estimatedUsdValue,
      decimals,
    };
  });

  // Total excludes null/unknown prices — consistent with Guardian cap enforcement
  const totalEstimatedUsdValue = balances.reduce(
    (sum, b) => sum + (b.estimatedUsdValue ?? 0),
    0,
  );

  return {
    walletAddress,
    balances,
    totalEstimatedUsdValue,
    network: "mainnet" as const,
    demoFixture: false,
  };
}

// ---------------------------------------------------------------------------
// Fixture portfolio — deterministic demo data (5 supported types)
// ---------------------------------------------------------------------------

function buildFixturePortfolio(walletAddress: string) {
  const fixtureData: Array<{ ticker: string; coinType: string; nativeBalance: bigint }> = [
    { ticker: "SUI",  coinType: COIN_TYPES.SUI,  nativeBalance: 5_000_000_000n }, // 5 SUI
    { ticker: "USDC", coinType: COIN_TYPES.USDC, nativeBalance: 10_000_000n },    // 10 USDC
    { ticker: "USDT", coinType: COIN_TYPES.USDT, nativeBalance: 5_000_000n },     // 5 USDT
    { ticker: "WETH", coinType: COIN_TYPES.WETH, nativeBalance: 0n },
    { ticker: "wBTC", coinType: COIN_TYPES.wBTC, nativeBalance: 0n },
  ];

  const balances = fixtureData.map(({ ticker, coinType, nativeBalance }) => {
    const decimals = COIN_DECIMALS[coinType] ?? 9;
    const humanBalance = (Number(nativeBalance) / 10 ** decimals).toFixed(6);
    const usdPrice = getTrustedUsdPrice(coinType);
    const estimatedUsdValue =
      usdPrice != null ? (Number(nativeBalance) / 10 ** decimals) * usdPrice : null;

    return {
      coinType,
      displayTicker: ticker,
      nativeBalance: nativeBalance.toString(),
      humanBalance,
      estimatedUsdValue,
      decimals,
    };
  });

  const totalEstimatedUsdValue = balances.reduce(
    (sum, b) => sum + (b.estimatedUsdValue ?? 0),
    0,
  );

  return {
    walletAddress,
    balances,
    totalEstimatedUsdValue,
    network: "mainnet" as const,
    demoFixture: true,
  };
}
