/**
 * getStakeOptions — read tool that returns available LST staking options so the
 * UI can render a picker card (protocol name, live APY, exchange-rate).
 *
 * Called when the user said "stake X SUI" without specifying a protocol.
 * Currently only Aftermath Finance (afSUI) is built; the registry is queried so
 * future LST adapters (haSUI, vSUI) surface automatically once their buildState
 * is set to "built".
 *
 * Pure + registry-driven: read-only, never builds or signs a PTB.
 * Live APY / exchange-rate are returned as opaque metadata so the UI card can
 * display them — the values come from the Aftermath SDK at read time (fail-soft).
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

export const getStakeOptions = createTool({
  id: "getStakeOptions",
  description:
    "List the liquid staking protocols available for a given coin (e.g. SUI → afSUI). " +
    "Returns each option with protocol id, name, and metadata slot for live APY. " +
    "Call this when the user says 'stake X SUI' without specifying a protocol. " +
    "Read-only — never builds a tx. The user picks a protocol and resubmits.",
  inputSchema: z.object({
    coinType: z.enum(COIN_TYPE_VALUES),
    amountHuman: z.string().optional(),
    verb: z.enum(["stake", "unstake"]).default("stake"),
  }),
  outputSchema: z.object({
    coinType: z.string(),
    coinSymbol: z.string(),
    amountHuman: z.string().optional(),
    verb: z.enum(["stake", "unstake"]),
    options: z.array(
      z.object({
        protocol: z.string(),
        name: z.string(),
        /** Informational slug; the UI fetches live APY separately (fail-soft). */
        lstCoinType: z.string().optional(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const { coinType, amountHuman, verb } = inputData as {
      coinType: string;
      amountHuman?: string;
      verb: "stake" | "unstake";
    };

    // Only built, security-active LST protocols qualify.
    // For "stake": the source coin (SUI) must be in the protocol's coinTypes.
    // For "unstake": the LST coin (afSUI, etc.) must be in the protocol's coinTypes.
    const options = getBuiltProtocols()
      .filter((p) => p.category === "lst" && p.coinTypes.includes(coinType))
      .map((p) => {
        // Expose the LST output coin type for stake (= the non-input coin in the pair).
        const lstCoinType =
          verb === "stake"
            ? p.coinTypes.find((ct) => ct !== coinType)
            : p.coinTypes.find((ct) => ct !== COIN_TYPES.SUI);
        return {
          protocol: p.id,
          name: p.name,
          lstCoinType,
        };
      });

    return {
      coinType,
      coinSymbol: TYPE_TO_SYMBOL.get(coinType) ?? coinType.split("::").pop() ?? coinType,
      amountHuman,
      verb,
      options,
    };
  },
});
