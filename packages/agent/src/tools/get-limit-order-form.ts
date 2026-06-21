/**
 * getLimitOrderForm — read tool that returns the whitelisted DeepBook pools (with
 * base/quote coin metadata + logos) so the UI can render a limit-order picker,
 * instead of asking for the pair/side/price/quantity in prose. Called when the
 * user types a bare/partial "place limit order" (missing any of those fields).
 *
 * Pure + allowlist-driven: pools are exactly DEEPBOOK_POOLS (the 3 cancelable/
 * buildable pools). It NEVER builds or signs — the user picks pair + side + price +
 * quantity, which re-enters the chat as a complete `limit …` command (carrying a
 * deterministic [[limit:…]] marker) and goes through the Guardian via prepareTrade.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { POPULAR_TOKENS } from "@dewlock/sui/popular-tokens";
import { COIN_TYPES, COIN_DECIMALS, DEEPBOOK_POOLS } from "../allowlist";

// Pool → { base, quote } coin types (matches DeepBook mainnet pool configuration,
// mirrors POOL_COIN_TYPES in @dewlock/sui/build-limit-order).
const POOL_COIN_TYPES: Record<string, { base: string; quote: string }> = {
  DEEP_USDC: { base: COIN_TYPES.DEEP, quote: COIN_TYPES.USDC },
  SUI_USDC: { base: COIN_TYPES.SUI, quote: COIN_TYPES.USDC },
  DEEP_SUI: { base: COIN_TYPES.DEEP, quote: COIN_TYPES.SUI },
};

const TOKEN_BY_TYPE = new Map(POPULAR_TOKENS.map((t) => [t.coinType, t]));

function coinMeta(coinType: string) {
  const t = TOKEN_BY_TYPE.get(coinType);
  return {
    symbol: t?.symbol ?? "?",
    coinType,
    decimals: t?.decimals ?? COIN_DECIMALS[coinType] ?? 9,
    logoUrl: t?.logoUrl,
  };
}

// One descriptor per whitelisted pool — base + quote metadata for the picker.
const POOLS = Object.keys(DEEPBOOK_POOLS)
  .filter((poolKey) => POOL_COIN_TYPES[poolKey])
  .map((poolKey) => {
    const { base, quote } = POOL_COIN_TYPES[poolKey];
    return { poolKey, base: coinMeta(base), quote: coinMeta(quote) };
  });

const POOL_KEYS = Object.keys(DEEPBOOK_POOLS) as [string, ...string[]];

export const getLimitOrderForm = createTool({
  id: "getLimitOrderForm",
  description:
    "Return the whitelisted DeepBook pools (pair + side + price + quantity inputs) so the " +
    "UI can render a limit-order form. Call this when the user types a bare or partial " +
    "'place limit order' (missing the pair, side, price, or quantity). Read-only — never " +
    "builds a transaction; the form re-submits a complete order through the Guardian.",
  inputSchema: z.object({
    poolKey: z.enum(POOL_KEYS).optional().describe("Pre-select a pool if the user named a pair"),
    side: z.enum(["BUY", "SELL"]).optional().describe("Pre-select a side if the user said buy/sell"),
  }),
  outputSchema: z.object({
    pools: z.array(
      z.object({
        poolKey: z.string(),
        base: z.object({ symbol: z.string(), coinType: z.string(), decimals: z.number(), logoUrl: z.string().optional() }),
        quote: z.object({ symbol: z.string(), coinType: z.string(), decimals: z.number(), logoUrl: z.string().optional() }),
      }),
    ),
    defaultExpiryDays: z.number(),
    poolKey: z.string().optional(),
    side: z.enum(["BUY", "SELL"]).optional(),
  }),
  execute: async (inputData) => {
    const { poolKey, side } = inputData as { poolKey?: string; side?: "BUY" | "SELL" };
    return { pools: POOLS, defaultExpiryDays: 7, poolKey, side };
  },
});
