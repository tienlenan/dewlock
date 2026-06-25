/**
 * getHistory — read-only history feed built from the wallet's immutable receipt log.
 *
 * WHY memwal "action log:" lines (not on-chain enumeration): the receipt enumeration
 * path is the wallet's memwal recall — the same path as build-user-stats.ts uses via
 * recallReceipts(). This avoids a new on-chain getOwnedObjects scan (N+1 / serverless
 * timeout risk) and reuses the already-indexed data. See STEP-0 resolution in the plan.
 *
 * WHY no P&L: the receipt schema stores no entry-USD baseline, and getTrustedUsdPrice
 * is spot-only (no historical price). Cost basis cannot be determined → P&L column is
 * deliberately absent. Showing a fabricated P&L would violate the zero-fabricated-numbers
 * rule. The feed shows usdValue (the Guardian-computed USD at action time, stored in the
 * action log line) — this is the recorded amount, not profit/loss.
 *
 * WHY "block log:" lines: blocked actions produce a Walrus receipt blob but are NOT
 * written to the "action log:" in memwal (stepLogAction skips them — no on-chain tx).
 * When the caller provides blockLines (a separate recall path), we include them in the
 * feed with verdict:"blocked" so the user can see the Guardian's blocking history.
 *
 * Pure compute: no @dewlock/walrus import here — the agent bundle stays CJS/ESM-free.
 * The caller (Next.js API route or the tool itself via receiptLines input) supplies the
 * already-recalled lines.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { parseReceiptLine } from "../memory/user-stats";

// ---------------------------------------------------------------------------
// Block-log line parser
// Format: "block log: <ISO ts> | <label> | tx:<key> | usd:$<amount> | reasons:<reasons>"
// ---------------------------------------------------------------------------

const BLOCK_LINE_RE =
  /^block log:\s*(?<ts>[^|]+?)\s*\|\s*(?<label>.+?)\s*\|\s*tx:(?<tx>[^|]+?)\s*\|\s*usd:\$(?<usd>[\d.]+)(?:\s*\|\s*reasons:(?<reasons>.+))?/;

interface ParsedBlockEntry {
  timestamp: string;
  actionLabel: string;
  txDigest: string;
  usdValue: number;
  blockReasons: string[];
  verdict: "blocked";
}

function parseBlockLine(line: string): ParsedBlockEntry | null {
  const m = BLOCK_LINE_RE.exec(line.trim());
  if (!m?.groups) return null;
  const usd = parseFloat(m.groups.usd);
  return {
    timestamp: m.groups.ts.trim(),
    actionLabel: m.groups.label.trim(),
    txDigest: m.groups.tx.trim(),
    usdValue: Number.isFinite(usd) ? usd : 0,
    blockReasons: m.groups.reasons ? m.groups.reasons.split(",").map((r) => r.trim()) : [],
    verdict: "blocked",
  };
}

// ---------------------------------------------------------------------------
// Unified history entry type
// ---------------------------------------------------------------------------

interface HistoryEntry {
  timestamp: string;
  actionLabel: string;
  txDigest: string;
  usdValue: number;
  verdict: "approved" | "blocked";
  blockReasons?: string[];
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

const historyEntrySchema = z.object({
  timestamp: z.string(),
  actionLabel: z.string(),
  txDigest: z.string(),
  usdValue: z.number(),
  /** Guardian verdict: "approved" (on-chain) or "blocked" (Guardian refused). */
  verdict: z.enum(["approved", "blocked"]),
  /**
   * Guardian gate identifiers that fired on blocked entries.
   * Absent on approved entries (the action went through).
   */
  blockReasons: z.array(z.string()).optional(),
  /**
   * Sui explorer link for approved entries (direct tx lookup).
   * Absent for blocked entries (no on-chain tx was created).
   */
  explorerUrl: z.string().optional(),
});

export const getHistory = createTool({
  id: "getHistory",
  description:
    "Show the wallet's action history — a reverse-chronological feed of executed " +
    "(approved) and Guardian-blocked actions, built from the immutable receipt log. " +
    "Each row shows the action, recorded USD value, verdict, timestamp, and an " +
    "explorer link for approved actions. No P&L or cost-basis — amounts are the " +
    "values recorded at action time, not profit/loss. Read-only — no signing. " +
    "Use when the user asks for 'my history', 'show my receipts', 'my activity', " +
    "or 'transaction history'.",
  inputSchema: z.object({
    walletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address"),
    /**
     * Approved action log lines ("action log: …") recalled from memwal by the caller.
     * Same format as getUserStats.receiptLines — the caller recalls them from the same
     * "action log:" prefix. When absent (chat path), the feed shows an empty state.
     */
    receiptLines: z.array(z.string()).optional(),
    /**
     * Blocked action log lines ("block log: …") if the caller recalled them.
     * Optional — when absent, only approved entries appear in the feed.
     */
    blockLines: z.array(z.string()).optional(),
    /** Maximum entries to return (default 20 — enough for a visible feed). */
    limit: z.number().int().positive().max(100).default(20),
  }),
  outputSchema: z.object({
    walletAddress: z.string(),
    feed: z.array(historyEntrySchema),
    /** Total approved entries parsed (before limit). */
    totalApproved: z.number(),
    /** Total blocked entries parsed (before limit). */
    totalBlocked: z.number(),
  }),
  execute: async (inputData) => {
    const { walletAddress, receiptLines = [], blockLines = [], limit } = inputData as {
      walletAddress: string;
      receiptLines?: string[];
      blockLines?: string[];
      limit: number;
    };

    // Parse approved "action log:" entries
    const approved: HistoryEntry[] = [];
    for (const line of receiptLines) {
      if (!line.trim().startsWith("action log:")) continue;
      const parsed = parseReceiptLine(line);
      if (!parsed) continue;
      approved.push({
        timestamp: parsed.timestamp,
        actionLabel: parsed.actionLabel,
        txDigest: parsed.txDigest,
        usdValue: parsed.usdValue,
        verdict: "approved",
        explorerUrl: `https://suiscan.xyz/mainnet/tx/${parsed.txDigest}`,
      } as HistoryEntry & { explorerUrl: string });
    }

    // Parse blocked "block log:" entries (separate source — not in action log)
    const blocked: HistoryEntry[] = [];
    for (const line of blockLines) {
      if (!line.trim().startsWith("block log:")) continue;
      const parsed = parseBlockLine(line);
      if (!parsed) continue;
      blocked.push({
        timestamp: parsed.timestamp,
        actionLabel: parsed.actionLabel,
        txDigest: parsed.txDigest,
        usdValue: parsed.usdValue,
        verdict: "blocked",
        blockReasons: parsed.blockReasons,
      });
    }

    // Merge approved + blocked, sort newest first
    const all = [...approved, ...blocked].sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0,
    );

    return {
      walletAddress,
      feed: all.slice(0, limit),
      totalApproved: approved.length,
      totalBlocked: blocked.length,
    };
  },
});
