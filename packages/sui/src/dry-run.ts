/**
 * Fail-closed dry-run wrapper around dryRunTransactionBlock.
 *
 * WHY fail-closed: a naive implementation that catches dryRun errors and
 * proceeds anyway is a bypass — if the simulation can't run, we cannot
 * verify what the tx actually does, so we must block, not approve.
 *
 * This is the single chokepoint; callers that don't use this wrapper
 * violate the security invariant. The Guardian always calls this.
 */

import type { SuiJsonRpcClient, DryRunTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import { extractObjectChanges, type ObjectChange } from "./dry-run-object-changes";

export { capObjectsForPreview } from "./dry-run-object-changes";
export type { ObjectChange, ObjectOwnerKind } from "./dry-run-object-changes";

// Server-side SuiClient type — SuiJsonRpcClient is the v2.x successor to the
// old SuiClient class; both expose dryRunTransactionBlock with the same signature.
type SuiClient = SuiJsonRpcClient;

/** Balance delta for a single coin type extracted from dry-run effects. */
export interface BalanceDelta {
  coinType: string;
  /** Signed change in native units (negative = outflow). */
  amount: bigint;
  owner: string;
}

/** Structured result from a successful dry-run simulation. */
export interface DryRunResult {
  effects: DryRunTransactionBlockResponse["effects"];
  /** Per-owner net coin deltas parsed from balanceChanges. */
  balanceDeltas: BalanceDelta[];
  /** Estimated gas in MIST. */
  gasCostMist: bigint;
  /**
   * Per-object changes parsed from objectChanges (created/mutated/transferred/…).
   * Optional: a required field would break the many hand-built mock DryRunResults
   * in the guardian test suite. Absent when not requested / not parseable.
   */
  objectChanges?: ObjectChange[];
}

/**
 * Execute a dry-run and return structured effects.
 * THROWS on ANY error or missing effects — callers must treat a throw as BLOCK.
 * Never returns a partial or undefined result; callers must not catch silently.
 *
 * @param client - Server-side SuiClient instance.
 * @param txBytes - Base64-encoded serialized transaction bytes.
 * @param senderAddress - Optional tx sender; used only to classify object-change
 *   ownership ("you" vs "third-party"). Omitting it never affects the gate decision,
 *   only the preview's ownerKind labels.
 * @param recipientAddress - Optional INTENDED transfer recipient; an object landing here
 *   is classified "recipient" (expected) rather than "third-party" (the unexpected-outflow
 *   alarm). Display-only — never affects the gate decision.
 */
export async function dryRunTransaction(
  client: SuiClient,
  txBytes: string,
  senderAddress?: string,
  recipientAddress?: string,
): Promise<DryRunResult> {
  let response: DryRunTransactionBlockResponse;

  try {
    response = await client.dryRunTransactionBlock({ transactionBlock: txBytes });
  } catch (err) {
    // Any RPC error — network, timeout, parse, etc. — is a block signal.
    // Do NOT swallow and proceed; that is the fail-open bypass we prevent here.
    const message = err instanceof Error ? err.message : String(err);
    throw new DryRunFailedError(
      `Dry-run RPC call failed — cannot verify transaction safety: ${message}`,
    );
  }

  // Missing effects means the node couldn't simulate — same as an RPC error.
  if (!response.effects) {
    throw new DryRunFailedError(
      "Dry-run returned no effects — cannot verify transaction safety.",
    );
  }

  // A dry-run that produces a failure status means the tx WOULD revert.
  // Surface this as a blocking error rather than letting the guardian approve.
  const status = response.effects.status?.status;
  if (status !== "success") {
    const errMsg = response.effects.status?.error ?? "unknown revert reason";
    throw new DryRunFailedError(toUserRevertMessage(errMsg));
  }

  const gasCostMist = extractGasCost(response);
  const balanceDeltas = extractBalanceDeltas(response);
  const objectChanges = extractObjectChanges(response, senderAddress, recipientAddress);

  return {
    effects: response.effects,
    balanceDeltas,
    gasCostMist,
    objectChanges,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Typed error so callers can distinguish dry-run failures from other errors. */
export class DryRunFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DryRunFailedError";
  }
}

/**
 * Translate a raw on-chain revert status into a plain, actionable message. Known codes get a
 * human explanation; the raw code is retained in parentheses for diagnostics. Unknown codes keep
 * the raw reason verbatim so we never hide a real failure behind vague copy.
 */
function toUserRevertMessage(raw: string): string {
  if (/InsufficientGas/i.test(raw)) {
    return (
      "This transaction can't be completed: not enough SUI to cover network gas. " +
      "If you're swapping or sending SUI, leave a little SUI for gas (or consolidate your SUI " +
      "into one coin), then try again. (InsufficientGas)"
    );
  }
  return `This transaction would fail on-chain and was not signed: ${raw}`;
}

function extractGasCost(response: DryRunTransactionBlockResponse): bigint {
  const gas = response.effects?.gasUsed;
  if (!gas) return 0n;
  const computeCost = BigInt(gas.computationCost ?? 0);
  const storageCost = BigInt(gas.storageCost ?? 0);
  const storageRebate = BigInt(gas.storageRebate ?? 0);
  return computeCost + storageCost - storageRebate;
}

/** Shape of a single balance-change entry from the dry-run response. */
interface BalanceChangeEntry {
  coinType: string;
  amount: string;
  owner: unknown;
}

/**
 * Extract balance deltas from balanceChanges array in the dry-run response.
 * balanceChanges gives the net delta per (owner, coinType) pair — ideal for preview.
 */
function extractBalanceDeltas(
  response: DryRunTransactionBlockResponse,
): BalanceDelta[] {
  const changes = (response.balanceChanges ?? []) as BalanceChangeEntry[];
  return changes.map((change) => ({
    coinType: change.coinType,
    amount: BigInt(change.amount),
    owner:
      typeof change.owner === "object" &&
      change.owner !== null &&
      "AddressOwner" in change.owner
        ? (change.owner as { AddressOwner: string }).AddressOwner
        : String(change.owner),
  }));
}
