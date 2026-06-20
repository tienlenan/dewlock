/**
 * getStablecoinYields — discovery marker for "best stablecoin yields on Sui".
 *
 * A THIN marker tool (mirrors getProtocolMetrics): execute does NO network I/O —
 * it just signals the chat to render the yields card, which self-fetches
 * /api/ecosystem/yields server-side (the ~11 MB DefiLlama payload never touches
 * the agent stream). Read-only; no keys, no signing.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getStablecoinYields = createTool({
  id: "getStablecoinYields",
  description:
    "Show the best / highest stablecoin yields (APY) on Sui — top stablecoin " +
    "lending/LP pools ranked by APY, from DefiLlama. Use when the user asks for " +
    "best/highest stablecoin yields, stablecoin APY, or where to earn on " +
    "stablecoins on Sui. Read-only. The ranked list renders in the card.",
  inputSchema: z.object({}),
  outputSchema: z.object({ chain: z.literal("Sui") }),
  execute: async () => ({ chain: "Sui" as const }),
});
