/**
 * listProtocols — read tool returning the protocol registry posture for a card.
 *
 * Read-only: surfaces the SAME registry the Guardian enforces (active+built vs
 * deferred vs hacked/off-model). It never builds or signs anything — the value
 * path stays in prepareTrade / prepareBridgeRedeem.
 *
 * Mirrors the /api/protocols DTO so the chat card and the route share one shape.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getActiveProtocols, getExcludedProtocols, type ProtocolEntry } from "../allowlist";

const incidentSchema = z
  .object({
    date: z.string(),
    amountUsd: z.number().optional(),
    rootCauseClass: z.string().optional(),
    summary: z.string().optional(),
  })
  .optional();

const protocolDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  status: z.enum(["active", "listed-excluded", "hacked"]),
  buildState: z.enum(["built", "deferred", "excluded"]),
  sdkPackage: z.string().optional(),
  lastIncident: incidentSchema,
  guardianNotes: z.string().optional(),
  targetCount: z.number(),
});

function toDto(p: ProtocolEntry) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    status: p.status,
    buildState: p.buildState,
    sdkPackage: p.sdkPackage,
    lastIncident: p.lastIncident,
    guardianNotes: p.guardianNotes,
    targetCount: p.allowlistedTargets.length,
  };
}

export const listProtocols = createTool({
  id: "listProtocols",
  description:
    "List the Sui DeFi protocols Dewlock knows about and their security posture " +
    "(active+built, recognized-but-not-yet-built, or listed-but-excluded/hacked). " +
    "Call this when the user asks which protocols are supported.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    active: z.array(protocolDtoSchema),
    excluded: z.array(protocolDtoSchema),
  }),
  execute: async () => ({
    active: getActiveProtocols().map(toDto),
    excluded: getExcludedProtocols().map(toDto),
  }),
});
