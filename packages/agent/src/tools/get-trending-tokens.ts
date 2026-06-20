/**
 * getTrendingTokens — discovery marker for "memes / trending tokens on Sui".
 *
 * A THIN marker tool (mirrors getProtocolMetrics): execute does NO network I/O —
 * it signals the chat to render the trending-tokens card, which self-fetches
 * /api/ecosystem/tokens (CoinGecko + GeckoTerminal, server-side). Read-only;
 * no keys, no signing.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getTrendingTokens = createTool({
  id: "getTrendingTokens",
  description:
    "Show trending / hot meme tokens on Sui — top Sui meme/ecosystem tokens " +
    "ranked by market cap with price and 24h change, from CoinGecko. Use when " +
    "the user asks about memes, meme coins/tokens, trending or hot tokens/coins " +
    "on Sui. Read-only. The ranked list renders in the card.",
  inputSchema: z.object({}),
  outputSchema: z.object({ chain: z.literal("Sui") }),
  execute: async () => ({ chain: "Sui" as const }),
});
