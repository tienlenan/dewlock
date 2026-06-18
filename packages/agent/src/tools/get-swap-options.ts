/**
 * getSwapOptions — read tool returning swap options across all available sources.
 *
 * Returns quotes from both the Cetus Aggregator (multi-DEX best route) and the
 * Aftermath Router (AMM aggregator), plus the best source by highest output.
 * The chosen source is passed to prepareTrade, which re-derives min-out from the
 * SAME source in the Guardian. Read-only — no PTB here.
 *
 * WHY "cetus" source excluded from live options: the legacy Cetus CLMM "direct"
 * SDK is @mysten/sui v1-era and incompatible with the repo's v2.18 pin (it fails
 * to load: "Class extends value undefined"), so it is NOT offered as a source.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fetchAggregatorQuote } from "@dewlock/sui/aggregator-quotes";
import { fetchAftermathQuote } from "@dewlock/sui/aftermath-quotes";
import { COIN_TYPES } from "../allowlist";
import { SWAP_SOURCES } from "../guardian";

const COIN_TYPE_VALUES = Object.values(COIN_TYPES) as [string, ...string[]];

export const getSwapOptions = createTool({
  id: "getSwapOptions",
  description:
    "Compare swap sources (Cetus Aggregator and Aftermath Router) for a pair + amount, " +
    "returning each source's estimated output, min-out, and route, plus the best. " +
    "Call this when the user wants to compare venues before swapping. Read-only.",
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

    const options: Array<{
      source: "cetus" | "aggregator" | "aftermath";
      available: boolean;
      estimatedAmountOut?: string;
      minAmountOut?: string;
      routeProviders?: string[];
      error?: string;
    }> = [];

    let bestSource: "cetus" | "aggregator" | "aftermath" | undefined;
    let bestAmount = 0n;

    // Fetch both sources in parallel for minimum latency.
    const [aggResult, afResult] = await Promise.allSettled([
      fetchAggregatorQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps),
      fetchAftermathQuote(coinTypeIn, coinTypeOut, amountIn, slippageBps),
    ]);

    if (aggResult.status === "fulfilled") {
      const q = aggResult.value;
      options.push({
        source: "aggregator",
        available: true,
        estimatedAmountOut: q.estimatedAmountOut.toString(),
        minAmountOut: q.minAmountOut.toString(),
        routeProviders: q.routeProviders,
      });
      if (q.estimatedAmountOut > bestAmount) {
        bestAmount = q.estimatedAmountOut;
        bestSource = "aggregator";
      }
    } else {
      options.push({
        source: "aggregator",
        available: false,
        error: aggResult.reason instanceof Error ? aggResult.reason.message : String(aggResult.reason),
      });
    }

    if (afResult.status === "fulfilled") {
      const q = afResult.value;
      options.push({
        source: "aftermath",
        available: true,
        estimatedAmountOut: q.estimatedAmountOut.toString(),
        minAmountOut: q.minAmountOut.toString(),
        routeProviders: q.routeProviders,
      });
      if (q.estimatedAmountOut > bestAmount) {
        bestAmount = q.estimatedAmountOut;
        bestSource = "aftermath";
      }
    } else {
      options.push({
        source: "aftermath",
        available: false,
        error: afResult.reason instanceof Error ? afResult.reason.message : String(afResult.reason),
      });
    }

    return { coinTypeIn, coinTypeOut, amountInNative: amountStr, options, best: bestSource };
  },
});
