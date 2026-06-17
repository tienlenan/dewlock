/**
 * getSwapOptions — read tool comparing swap sources before a build.
 *
 * Returns the per-source quote (Cetus direct vs the Cetus aggregator best-route)
 * so the user can pick a venue; the chosen source is then passed to prepareTrade
 * (which re-derives min-out from the SAME source in the Guardian). Read-only —
 * no PTB is built here.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fetchSwapQuote } from "@dewlock/sui/quotes-source";
import { fetchAggregatorQuote } from "@dewlock/sui/aggregator-quotes";
import { COIN_TYPES } from "../allowlist";
import { SWAP_SOURCES } from "../guardian";

const COIN_TYPE_VALUES = Object.values(COIN_TYPES) as [string, ...string[]];

export const getSwapOptions = createTool({
  id: "getSwapOptions",
  description:
    "Compare swap sources (Cetus direct vs the multi-DEX aggregator) for a pair + amount, " +
    "returning each source's estimated output, min-out, and route, plus the best. " +
    "Call this when the user wants to choose a swap venue before swapping. Read-only.",
  inputSchema: z.object({
    coinTypeIn: z.enum(COIN_TYPE_VALUES),
    coinTypeOut: z.enum(COIN_TYPE_VALUES),
    amountInNative: z.string().regex(/^\d+$/, "native units as an integer string"),
    slippageBps: z.number().int().min(0).max(5000).optional().default(50),
  }),
  outputSchema: z.object({
    coinTypeIn: z.string(),
    coinTypeOut: z.string(),
    amountInNative: z.string(),
    options: z.array(
      z.object({
        source: z.enum(SWAP_SOURCES),
        available: z.boolean(),
        estimatedAmountOut: z.string().optional(),
        minAmountOut: z.string().optional(),
        routeProviders: z.array(z.string()).optional(),
        error: z.string().optional(),
      }),
    ),
    /** The source with the highest estimated output among available options. */
    best: z.enum(SWAP_SOURCES).optional(),
  }),
  execute: async (inputData) => {
    const { coinTypeIn, coinTypeOut, amountInNative: amountStr, slippageBps = 50 } = inputData;
    const amountIn = BigInt(amountStr);

    const [cetus, agg] = await Promise.allSettled([
      fetchSwapQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps),
      fetchAggregatorQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps),
    ]);

    const options: Array<{
      source: "cetus" | "aggregator";
      available: boolean;
      estimatedAmountOut?: string;
      minAmountOut?: string;
      routeProviders?: string[];
      error?: string;
    }> = [];

    let bestSource: "cetus" | "aggregator" | undefined;
    let bestOut = -1n;

    const add = (source: "cetus" | "aggregator", r: PromiseSettledResult<Awaited<ReturnType<typeof fetchSwapQuote>>>) => {
      if (r.status === "fulfilled") {
        const q = r.value;
        options.push({
          source,
          available: true,
          estimatedAmountOut: q.estimatedAmountOut.toString(),
          minAmountOut: q.minAmountOut.toString(),
          routeProviders: q.routeProviders,
        });
        if (q.estimatedAmountOut > bestOut) {
          bestOut = q.estimatedAmountOut;
          bestSource = source;
        }
      } else {
        options.push({
          source,
          available: false,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    };

    add("cetus", cetus);
    add("aggregator", agg);

    return { coinTypeIn, coinTypeOut, amountInNative: amountStr, options, best: bestSource };
  },
});
