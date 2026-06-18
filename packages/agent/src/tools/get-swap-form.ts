/**
 * getSwapForm — read tool that returns the swappable coin set (with logos) so the
 * UI can render a from→to swap picker, instead of asking for the pair in prose.
 * Called when the user types a bare/partial "swap" (no from/to/amount).
 *
 * Pure + allowlist-driven: the coin list is exactly the verified `swappable` tokens
 * (those also in COIN_TYPES). It NEVER builds or signs — the user picks from/to +
 * amount, which re-enters the chat as a complete `swap …` command through the
 * Guardian via prepareTrade. Live estimated-out is fetched separately by the card.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { POPULAR_TOKENS } from "@dewlock/sui/popular-tokens";
import { COIN_TYPES } from "../allowlist";

const COIN_TYPE_VALUES = Object.values(COIN_TYPES) as [string, ...string[]];
const ALLOWLISTED = new Set<string>(Object.values(COIN_TYPES));

// The verified, swappable coin set the picker may offer (symbol + logo + decimals).
const SWAPPABLE_COINS = POPULAR_TOKENS.filter(
  (t) => t.swappable && ALLOWLISTED.has(t.coinType),
).map((t) => ({ symbol: t.symbol, coinType: t.coinType, decimals: t.decimals, logoUrl: t.logoUrl }));

export const getSwapForm = createTool({
  id: "getSwapForm",
  description:
    "Return the swappable coin set so the UI can render a from→to swap picker with a " +
    "live quote. Call this when the user types a bare or partial 'swap' (missing the " +
    "input coin, output coin, or amount). Read-only — never builds a transaction.",
  inputSchema: z.object({
    coinTypeIn: z.enum(COIN_TYPE_VALUES).optional(),
    coinTypeOut: z.enum(COIN_TYPE_VALUES).optional(),
    amountHuman: z.string().optional(),
  }),
  outputSchema: z.object({
    coins: z.array(
      z.object({
        symbol: z.string(),
        coinType: z.string(),
        decimals: z.number(),
        logoUrl: z.string().optional(),
      }),
    ),
    coinTypeIn: z.string().optional(),
    coinTypeOut: z.string().optional(),
    amountHuman: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { coinTypeIn, coinTypeOut, amountHuman } = inputData as {
      coinTypeIn?: string;
      coinTypeOut?: string;
      amountHuman?: string;
    };
    return { coins: SWAPPABLE_COINS, coinTypeIn, coinTypeOut, amountHuman };
  },
});
