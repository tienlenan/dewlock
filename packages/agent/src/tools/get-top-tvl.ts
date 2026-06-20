/**
 * getTopTvl — discovery marker for "top TVL on Sui / biggest protocols".
 *
 * A THIN marker tool (mirrors getProtocolMetrics): execute does NO network I/O —
 * it signals the chat to render the TVL card, which self-fetches
 * /api/ecosystem/tvl (DefiLlama SDK, server-side). Read-only; no keys, no signing.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getTopTvl = createTool({
  id: "getTopTvl",
  description:
    "Show the top / largest Sui protocols by TVL (total value locked) — the " +
    "biggest protocols on Sui ranked by Sui-chain TVL, from DefiLlama. Use when " +
    "the user asks for top TVL, biggest/largest protocols, or which protocols " +
    "have the most value locked on Sui. Read-only. The ranked list renders in the card.",
  inputSchema: z.object({}),
  outputSchema: z.object({ chain: z.literal("Sui") }),
  execute: async () => ({ chain: "Sui" as const }),
});
