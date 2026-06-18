/**
 * requestContactPicker — emit a CONTACT-PICKER card when a friend name matches 2+ saved
 * contacts (e.g. "send 1 SUI to Thomas" with two Thomases). The routing directive (built
 * server-side from the user's authoritative address book) tells the copilot exactly when to
 * call this and supplies the candidates. The user picks one; the card re-enters the chat
 * with the chosen 0x address → prepareTrade → Guardian → sign.
 *
 * Pure: it only shapes the directive-supplied candidates into a card spec — it NEVER reads
 * memory, builds, or signs anything, and the copilot must NOT invent an address (it uses the
 * exact candidates the directive provides; addresses are route-authoritative).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

export const requestContactPicker = createTool({
  id: "requestContactPicker",
  description:
    "Render a contact-picker card when a friend name matches 2+ saved contacts. Call this " +
    "ONLY when the routing directive says so, passing the candidates it provides. The user " +
    "picks one and the card re-submits a send to that exact address. Never invent an address.",
  inputSchema: z.object({
    query: z.string().min(1).describe("The name the user typed, e.g. 'thomas'"),
    amountHuman: z.string().min(1).describe("Pending send amount in human units (or 'all')"),
    coinSymbol: z.string().min(1).describe("Pending coin symbol, e.g. 'SUI'"),
    candidates: z
      .array(z.object({ name: z.string(), address: z.string().regex(ADDRESS_RE) }))
      .min(2)
      .max(10)
      .describe("Matching contacts from the directive — copy verbatim, never invent"),
  }),
  outputSchema: z.object({
    query: z.string(),
    amountHuman: z.string(),
    coinSymbol: z.string(),
    candidates: z.array(z.object({ name: z.string(), address: z.string() })),
    title: z.string(),
  }),
  execute: async (inputData) => {
    const { query, amountHuman, coinSymbol, candidates } = inputData as {
      query: string;
      amountHuman: string;
      coinSymbol: string;
      candidates: { name: string; address: string }[];
    };
    return {
      query,
      amountHuman,
      coinSymbol,
      candidates,
      title: `${candidates.length} friends match “${query}”`,
    };
  },
});
