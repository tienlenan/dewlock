/**
 * getProtocolMetrics — protocol-wide summary from the REAL protocol registry:
 * how many protocols Dewlock supports, how many are enforced (built adapters),
 * and how many are excluded (hacked / off-model). All counts are real + static.
 *
 * Live TVL is NOT fetched here (keeps the agent bundle lean + avoids burning
 * external calls); the protocol-metrics CHAT CARD self-fetches /api/metrics for
 * live DefiLlama TVL. This tool gives the model the real counts to speak to and
 * triggers that card. Read-only — no keys, no signing.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  getActiveProtocols,
  getExcludedProtocols,
  getBuiltProtocols,
} from "@dewlock/sui/protocol-registry";

export const getProtocolMetrics = createTool({
  id: "getProtocolMetrics",
  description:
    "Return a protocol-wide summary — supported protocol count, how many are " +
    "enforced (built adapters), and how many are excluded (hacked/off-model) — " +
    "from the real protocol registry. Use when the user asks about TVL, the " +
    "protocol dashboard, supported-protocol stats, or how many protocols Dewlock " +
    "covers. Live TVL renders in the card. Read-only.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    supportedProtocols: z.number(),
    enforcedProtocols: z.number(),
    excludedProtocols: z.number(),
    perProtocol: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        status: z.string(),
        buildState: z.string(),
        targetCount: z.number(),
      }),
    ),
  }),
  execute: async () => {
    const active = getActiveProtocols();
    const excluded = getExcludedProtocols();
    const built = getBuiltProtocols();
    const perProtocol = [...active, ...excluded].map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      status: p.status,
      buildState: p.buildState,
      targetCount: p.allowlistedTargets.length,
    }));
    return {
      supportedProtocols: active.length,
      enforcedProtocols: built.length,
      excludedProtocols: excluded.length,
      perProtocol,
    };
  },
});
