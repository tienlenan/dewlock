/**
 * getLendOptions — read tool that lists the lending protocols a user can supply/
 * repay a given coin on, so the UI can render a protocol PICKER (small cards with
 * live supply APY) instead of a dropdown. Called when the user gave the amount +
 * coin but not yet a protocol (e.g. "lend 1 SUI").
 *
 * Pure + registry-driven: it only returns protocols that are status-active AND
 * have a built adapter AND support the coin. It NEVER builds or signs — the user
 * picks a protocol, which re-enters the chat as a complete command through the
 * Guardian via prepareTrade. Live APY is fetched separately by the card (fail-soft).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getBuiltProtocols } from "@dewlock/sui/protocol-registry";
import { COIN_TYPES } from "../allowlist";

const COIN_TYPE_VALUES = Object.values(COIN_TYPES) as [string, ...string[]];

// Reverse map: coin type → display symbol (verified allowlist only).
const TYPE_TO_SYMBOL = new Map<string, string>(
  Object.entries(COIN_TYPES).map(([sym, type]) => [type, sym]),
);

export const getLendOptions = createTool({
  id: "getLendOptions",
  description:
    "List the lending protocols that support supplying/repaying a given coin, so the " +
    "user can pick one (each card shows live supply APY). Call this when a lend has an " +
    "amount + coin but no protocol yet (e.g. 'lend 1 SUI'). Read-only — never builds a tx.",
  inputSchema: z.object({
    coinType: z.enum(COIN_TYPE_VALUES),
    amountHuman: z.string().optional(),
    verb: z.enum(["deposit", "repay"]).default("deposit"),
  }),
  outputSchema: z.object({
    coinType: z.string(),
    coinSymbol: z.string(),
    amountHuman: z.string().optional(),
    verb: z.enum(["deposit", "repay"]),
    options: z.array(
      z.object({
        protocol: z.string(),
        name: z.string(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const { coinType, amountHuman, verb } = inputData as {
      coinType: string;
      amountHuman?: string;
      verb: "deposit" | "repay";
    };

    // Only built, security-active lending protocols that list this coin qualify.
    const options = getBuiltProtocols()
      .filter((p) => p.category === "lending" && p.coinTypes.includes(coinType))
      .map((p) => ({ protocol: p.id, name: p.name }));

    return {
      coinType,
      coinSymbol: TYPE_TO_SYMBOL.get(coinType) ?? coinType.split("::").pop() ?? coinType,
      amountHuman,
      verb,
      options,
    };
  },
});
