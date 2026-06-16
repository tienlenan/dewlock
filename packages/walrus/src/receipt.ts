/**
 * Dewlock action-receipt builder — constructs canonical receipt payloads and
 * publishes them as immutable Walrus blobs.
 *
 * Called AFTER the user has signed a tx (or after a BLOCK verdict).
 * NEVER awaited on the render path — the caller fires-and-forgets.
 *
 * The operational key discipline is inherited from publishJsonBlob (blob.ts):
 * WALRUS_SDK_WALLET_KEY signs blob writes ONLY, never user-fund operations.
 */

import { publishJsonBlob, type WalrusBlobPointer } from "./blob.js";

// ---------------------------------------------------------------------------
// Canonical receipt shape — stable across versions (add fields only at end)
// ---------------------------------------------------------------------------

export interface ActionReceiptPayload {
  /** On-chain tx digest (null for BLOCK receipts — no tx occurred). */
  txDigest: string | null;
  /** Guardian-approved PTB digest (WYSIWYS hash). */
  approvedDigest: string | null;
  /** Action type: "transfer" | "swap" | "limit_order" | "near_miss" */
  action: string;
  /** Structured action arguments (sanitised — no secrets). */
  args: Record<string, unknown>;
  /** Dry-run balance deltas or block reasons. */
  dryRunEffects: unknown;
  /** Guardian verdict: "approved" | "blocked" */
  verdict: "approved" | "blocked";
  /** Guardian block reasons (empty for approved). */
  blockReasons: string[];
  /** Guardian gates that fired (empty for approved). */
  blockGates: string[];
  /** ISO-8601 timestamp of the event. */
  ts: string;
  /** Schema version for forward-compat. */
  schemaVersion: 1;
}

export interface ReceiptPublishResult {
  /** Walrus blob pointer from publishJsonBlob. */
  blob: WalrusBlobPointer;
  /** The receipt payload that was published (for anchor wiring). */
  receipt: ActionReceiptPayload;
}

/**
 * Build the canonical receipt payload, then publish it as a Walrus blob.
 *
 * @param input - receipt fields from the trade/block result
 * @returns blob pointer + the receipt object used (for anchor wiring)
 */
export async function buildAndPublishReceipt(input: {
  txDigest: string | null;
  approvedDigest: string | null;
  action: string;
  args: Record<string, unknown>;
  dryRunEffects: unknown;
  verdict: "approved" | "blocked";
  blockReasons?: string[];
  blockGates?: string[];
}): Promise<ReceiptPublishResult> {
  const receipt: ActionReceiptPayload = {
    txDigest: input.txDigest,
    approvedDigest: input.approvedDigest,
    action: input.action,
    args: input.args,
    dryRunEffects: input.dryRunEffects,
    verdict: input.verdict,
    blockReasons: input.blockReasons ?? [],
    blockGates: input.blockGates ?? [],
    ts: new Date().toISOString(),
    schemaVersion: 1,
  };

  // "action-receipt" kind drives Walrus metadata tagging.
  const blob = await publishJsonBlob("action-receipt", receipt);

  return { blob, receipt };
}
