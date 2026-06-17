/**
 * getUserStats — derive a wallet's Dewlock activity stats + earned/locked badges
 * from its immutable receipt log.
 *
 * Pure compute over receipt lines (no memwal import — the agent bundle stays
 * ESM-free; the Next.js route does the memwal recall and passes the lines).
 * Called with no receiptLines (the chat path can't read memwal), it returns the
 * honest empty state (newbie locked) — the /api/user-stats route is the real
 * data path. Read-only: no keys, no signing.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { deriveStats } from "../memory/user-stats";
import { computeBadges } from "../memory/badges";

const badgeShape = z.object({
  id: z.string(),
  name: z.string(),
  blurb: z.string(),
  earned: z.boolean(),
});

export const getUserStats = createTool({
  id: "getUserStats",
  description:
    "Return the connected wallet's Dewlock activity stats (tx count, volume, " +
    "action breakdown) and earned/locked reward badges, derived from the " +
    "immutable receipt log. Read-only — no signing. Use when the user asks for " +
    "their stats, dashboard, badges, rewards, or progress.",
  inputSchema: z.object({
    walletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address"),
    /** Receipt log lines ("action log: …") recalled from memwal by the caller. */
    receiptLines: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    walletAddress: z.string(),
    stats: z.object({
      txCount: z.number(),
      volumeUsd: z.number(),
      actions: z.object({
        transfer: z.number(),
        swap: z.number(),
        lend: z.number(),
        bridge: z.number(),
        limit: z.number(),
      }),
      distinctActions: z.number(),
      firstTs: z.string().nullable(),
    }),
    badges: z.object({ earned: z.array(badgeShape), locked: z.array(badgeShape) }),
  }),
  execute: async (inputData) => {
    const stats = deriveStats(inputData.receiptLines ?? []);
    const badges = computeBadges(stats);
    return { walletAddress: inputData.walletAddress, stats, badges };
  },
});
