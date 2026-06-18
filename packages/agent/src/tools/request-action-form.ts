/**
 * requestActionForm — emit an interactive INPUT FORM card when an actionable intent
 * is missing required args (amount, recipient, protocol). The copilot calls this
 * INSTEAD of asking in prose, so the user gets a real form to fill in (e.g. typing
 * "sell SUI" → a form to enter the SUI amount) rather than a dead-end text reply.
 *
 * Pure: it only normalizes args into a form spec for the UI — it NEVER builds or
 * signs anything. The form's submit re-enters the chat with a complete command, so
 * the Guardian still gates the resulting value move via prepareTrade.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { COIN_TYPES } from "../allowlist";

// Reverse map: coin type → display symbol (verified allowlist only).
const TYPE_TO_SYMBOL = new Map<string, string>(
  Object.entries(COIN_TYPES).map(([sym, type]) => [type, sym]),
);

const FORM_FIELDS = ["amount", "recipient", "protocol", "coin"] as const;

export const requestActionForm = createTool({
  id: "requestActionForm",
  description:
    "Render an interactive input form when the user's action is missing required " +
    "details (amount/recipient/protocol). Call this INSTEAD of asking in text. " +
    "The form collects the details and re-submits a complete command.",
  inputSchema: z.object({
    formAction: z.enum(["swap", "send", "lend"]),
    coinTypeIn: z.string().optional(),
    coinTypeOut: z.string().optional(),
    lendVerb: z.enum(["deposit", "repay"]).optional(),
    /** Pre-filled amount (human units) if the user already gave one. */
    amountHuman: z.string().optional(),
    /** Which fields the form must collect. */
    needs: z.array(z.enum(FORM_FIELDS)).min(1),
  }),
  outputSchema: z.object({
    formAction: z.enum(["swap", "send", "lend"]),
    coinInSymbol: z.string().optional(),
    coinOutSymbol: z.string().optional(),
    lendVerb: z.string().optional(),
    amountHuman: z.string().optional(),
    needs: z.array(z.string()),
    title: z.string(),
  }),
  execute: async (inputData) => {
    const { formAction, coinTypeIn, coinTypeOut, lendVerb, amountHuman, needs } = inputData as {
      formAction: "swap" | "send" | "lend";
      coinTypeIn?: string;
      coinTypeOut?: string;
      lendVerb?: "deposit" | "repay";
      amountHuman?: string;
      needs: string[];
    };
    const coinInSymbol = coinTypeIn ? TYPE_TO_SYMBOL.get(coinTypeIn) : undefined;
    const coinOutSymbol = coinTypeOut ? TYPE_TO_SYMBOL.get(coinTypeOut) : undefined;
    const title =
      formAction === "swap"
        ? `Swap ${coinInSymbol ?? "token"} → ${coinOutSymbol ?? "token"}`
        : formAction === "send"
          ? `Send ${coinInSymbol ?? "token"}`
          : `${(lendVerb ?? "deposit") === "repay" ? "Repay" : "Deposit"} (lending)`;
    return { formAction, coinInSymbol, coinOutSymbol, lendVerb, amountHuman, needs, title };
  },
});
