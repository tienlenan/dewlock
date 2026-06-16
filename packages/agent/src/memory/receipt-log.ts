/**
 * Receipt-on-execute memory log — formats decision log entries for memwal persistence.
 *
 * Architecture: pure functions only — no @dewlock/walrus import.
 * The actual remember() call is made by the caller (Next.js receipt route, ESM)
 * which injects the walrus function. This keeps the agent CJS bundle ESM-free.
 *
 * The receipt blob + Sui anchor are the immutability layer; memwal is mutable
 * memory for recall and legibility — not the source of truth.
 *
 * Log entry format:
 *   "action log: <ISO date> | <actionLabel> | tx:<txDigest> | usd:$<amount> | blob:<blobId>"
 */

export interface DecisionLogEntry {
  /** Human-readable action label (e.g. "Transfer 1 SUI to 888.sui") */
  actionLabel: string;
  /** On-chain transaction digest from the wallet sign result. */
  txDigest: string;
  /** Estimated USD value of the action (from Guardian preview). */
  estimatedUsdValue: number;
  /** Walrus blob ID for the immutable receipt (null if blob write pending/failed). */
  blobId?: string | null;
  /** ISO date string — injected at call time for determinism in tests. */
  timestamp?: string;
}

/**
 * Pure formatter — builds the memory log text without any side effects.
 * Exported for unit testing and for the caller to pass to remember().
 */
export function formatDecisionLogEntry(entry: DecisionLogEntry): string {
  const ts = entry.timestamp ?? new Date().toISOString();
  const blobPart = entry.blobId ? `blob:${entry.blobId}` : "blob:pending";
  return (
    `action log: ${ts} | ${entry.actionLabel} | ` +
    `tx:${entry.txDigest} | usd:$${entry.estimatedUsdValue.toFixed(2)} | ${blobPart}`
  );
}
