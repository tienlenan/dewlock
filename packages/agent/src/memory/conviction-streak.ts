/**
 * Conviction-streak cap memory — persists and recalls the user's committed risk cap.
 *
 * Architecture: pure functions only — no @dewlock/walrus import.
 * Callers (Next.js routes, which are ESM) pass in the walrus remember/recall functions.
 * This keeps the agent CJS bundle free of ESM-only dependencies.
 *
 * The Guardian cap gate is AUTHORITATIVE (reads from TX_USD_CAP / DAILY_USD_CAP env vars).
 * This module makes blocks legible by surfacing the recalled day-1 cap in the block reason.
 *
 * Memory entry format:
 *   "risk cap: $X/tx, $Y/day; risk profile: <label>"
 */

// Regex to extract per-tx cap.
const CAP_TX_REGEX = /risk cap:\s*\$(\d+(?:\.\d+)?)\/tx/i;
// Regex to extract daily cap.
const CAP_DAILY_REGEX = /\$(\d+(?:\.\d+)?)\/day/i;
// Regex to extract risk profile label.
const PROFILE_REGEX = /risk profile:\s*([a-z]+)/i;

export interface CommittedCap {
  txUsd: number;
  dailyUsd: number;
  riskProfile: string;
}

/** Injected walrus functions — callers provide these from @dewlock/walrus. */
export interface MemwalIO {
  remember: (namespace: string, text: string) => Promise<void>;
  recall: (namespace: string, query: string, topK?: number) => Promise<string[]>;
}

/** Build the memory entry text for a committed cap. */
function buildCapEntry(txUsdCap: number, dailyUsdCap: number, riskProfile: string): string {
  return `risk cap: $${txUsdCap}/tx, $${dailyUsdCap}/day; risk profile: ${riskProfile.toLowerCase()}`;
}

/**
 * Persist the user's committed cap to memwal.
 * Caller injects the walrus remember function (ESM-safe: caller is a Next.js route).
 */
export async function rememberCommittedCap(
  io: MemwalIO,
  namespace: string,
  txUsdCap: number,
  dailyUsdCap: number,
  riskProfile: string,
): Promise<void> {
  await io.remember(namespace, buildCapEntry(txUsdCap, dailyUsdCap, riskProfile));
}

/**
 * Recall the user's committed cap from memwal.
 * Returns null when no entry found or parse fails.
 * [needs live-env] requires reachable memwal relayer.
 */
export async function recallCommittedCap(
  io: MemwalIO,
  namespace: string,
): Promise<CommittedCap | null> {
  try {
    const results = await io.recall(namespace, "risk cap", 1);
    const text = results[0];
    if (!text) return null;
    return parseCapFromMemory(text);
  } catch {
    return null;
  }
}

/**
 * Pure parser — extracts CommittedCap from a memory entry string.
 * Exported for unit testing (no memwal required).
 */
export function parseCapFromMemory(text: string): CommittedCap | null {
  const txMatch = CAP_TX_REGEX.exec(text);
  const dailyMatch = CAP_DAILY_REGEX.exec(text);
  const profileMatch = PROFILE_REGEX.exec(text);

  if (!txMatch || !dailyMatch) return null;

  const txUsd = parseFloat(txMatch[1]);
  const dailyUsd = parseFloat(dailyMatch[1]);
  if (isNaN(txUsd) || isNaN(dailyUsd)) return null;

  return {
    txUsd,
    dailyUsd,
    riskProfile: profileMatch?.[1] ?? "unknown",
  };
}

/**
 * Format a Guardian cap-block reason with the recalled day-1 cap for legibility.
 *
 * Example:
 *   "You set a $5/tx cap (risk profile: conservative) — this action is ~$40.00, frozen by your own rule."
 */
export function formatCapBlockWithRecall(
  blockedAmountUsd: number,
  recalled: CommittedCap,
  blockType: "tx_cap" | "daily_cap",
): string {
  const rule =
    blockType === "tx_cap"
      ? `$${recalled.txUsd}/tx`
      : `$${recalled.dailyUsd}/day`;
  return (
    `You set a ${rule} cap (risk profile: ${recalled.riskProfile}) — ` +
    `this action is ~$${blockedAmountUsd.toFixed(2)}, frozen by your own rule.`
  );
}
