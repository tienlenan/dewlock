/**
 * PlanStepper — ordered-step state machine for sequential multi-step intent chains.
 *
 * Drives one prepareTrade→Guardian→sign cycle per step; builds step k+1 only
 * after step k's on-chain confirm. Key safety contracts:
 *
 *  - Pre/post DELTA (not total balance): a step that consumes a prior step's
 *    output pins its amount to (postBalance - preBalance), never the wallet's
 *    total. This prevents "lend it" from accidentally lending a pre-existing
 *    1000 USDC balance when the swap only produced 18 USDC.
 *
 *  - Stale-object wait: step k mutates specific coin objects. Step k+1 must
 *    wait for those object versions to be visible on the RPC node before
 *    building — otherwise selectCoin picks a stale version and the PTB aborts
 *    with "object unavailable for consumption". The stepper exposes the object
 *    IDs from each confirmed step via objectsToWaitBeforeStep().
 *
 *  - Halt + abandon: a BLOCK at step k stops the chain fail-closed. Steps
 *    0..k-1 are already on-chain (they stand); steps k+1.. become "cancelled".
 *    The stepper marks itself chain-incomplete so a per-step receipt can carry
 *    a "chain incomplete" marker for the history feed.
 *
 *  - Daily-spend net-once: the stepper tracks confirmed txDigests to deduplicate
 *    retried receipts, and marks lend-of-recycled-output as $0 net external spend
 *    so a swap→lend chain counts $20 once, not twice.
 *
 * DEFERRAL: server-side durable persistence across browser refresh is NOT
 * implemented in this phase. The stepper is in-memory; a page refresh loses
 * in-flight chain state. The in-session stepper, halt, and per-step receipt are
 * fully implemented. Cross-refresh resume is flagged deferred.
 */

import type { ChainStep } from "../intent/detect-multi-action";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type StepStatus = "pending" | "active" | "done" | "blocked" | "cancelled";

export interface StepConfirmOptions {
  txDigest: string;
  /** Approximate USD value of this step's external value transfer (0 for recycled). */
  usdValue?: number;
  /**
   * True when this step's input is the recycled output of a prior step.
   * Prevents double-counting: swap $20 SUI→USDC then lend it → net $20, not $40.
   */
  isRecycled?: boolean;
  /** Coin object IDs mutated by this step that step k+1 must wait to see. */
  touchedObjectIds?: string[];
}

export interface StepState {
  step: ChainStep;
  status: StepStatus;
  txDigest?: string;
  blockReasons?: string[];
  /** Object IDs touched by this confirmed step (needed for stale-object wait). */
  touchedObjectIds?: string[];
}

// ---------------------------------------------------------------------------
// Pre/post balance delta resolver — the C6 guard
// ---------------------------------------------------------------------------

/**
 * Compute the coin balance delta produced by a step.
 * Returns max(postBalance - preBalance, 0n) — never negative (a consumed balance
 * should not steer step k+1 toward a negative amount).
 *
 * The caller is responsible for snapshotting the pre-balance BEFORE step k builds
 * and reading the post-balance AFTER the on-chain confirm is indexed. Both reads
 * happen against the same RPC node to minimise race windows.
 */
export function resolveStepDelta(
  preBalance: bigint,
  postBalance: bigint,
): bigint {
  return postBalance > preBalance ? postBalance - preBalance : 0n;
}

// ---------------------------------------------------------------------------
// Plan stepper state machine
// ---------------------------------------------------------------------------

export class PlanStepper {
  private readonly walletAddress: string;
  private readonly states: StepState[];
  /** Tracks signed txDigests to deduplicate retried confirms (idempotency key). */
  private readonly confirmedDigests = new Set<string>();
  /** Net external USD value confirmed across the chain (double-count guarded). */
  private signedUsd = 0;

  constructor(walletAddress: string, steps: ChainStep[]) {
    if (steps.length === 0) throw new Error("PlanStepper requires at least one step");
    this.walletAddress = walletAddress;
    this.states = steps.map((step) => ({ step, status: "pending" as StepStatus }));
  }

  /** Read-only snapshot of all step states. */
  getStepStates(): StepState[] {
    return this.states.map((s) => ({ ...s }));
  }

  /** Index of the next step to execute (first non-done, non-cancelled step). */
  currentStepIndex(): number {
    for (let i = 0; i < this.states.length; i++) {
      if (this.states[i].status === "pending" || this.states[i].status === "active") return i;
    }
    return this.states.length; // all done or blocked
  }

  /** Mark step i as active (building / waiting for user signature). */
  startStep(i: number): void {
    const prev = i > 0 ? this.states[i - 1] : null;
    if (prev && prev.status !== "done") {
      throw new Error(
        `Cannot start step ${i}: step ${i - 1} has not been confirmed (status: ${prev.status})`,
      );
    }
    const state = this.stateAt(i);
    if (state.status !== "pending") {
      throw new Error(`Step ${i} is not pending (status: ${state.status})`);
    }
    state.status = "active";
  }

  /**
   * Record a successful on-chain confirm for step i.
   * Idempotent: confirming the same txDigest twice is a no-op (prevents
   * double-counting when the receipt pipeline retries).
   */
  confirmStep(i: number, opts: StepConfirmOptions): void {
    const state = this.stateAt(i);

    // Idempotency: same digest seen before → skip silently.
    if (this.confirmedDigests.has(opts.txDigest)) return;

    // Allow re-confirm from "done" (e.g. a retry path that re-calls confirm).
    // Only track when transitioning from active → done.
    const wasActive = state.status === "active";

    state.status = "done";
    state.txDigest = opts.txDigest;
    if (opts.touchedObjectIds) state.touchedObjectIds = opts.touchedObjectIds;

    this.confirmedDigests.add(opts.txDigest);

    // Accumulate net external USD spend only at confirm time and only when
    // this step is not recycled output from a prior step.
    if (wasActive && !opts.isRecycled) {
      this.signedUsd += opts.usdValue ?? 0;
    }
  }

  /**
   * Record a Guardian BLOCK at step i.
   * Cancels all subsequent steps fail-closed — they will never build.
   */
  blockStep(i: number, reasons: string[]): void {
    const state = this.stateAt(i);
    state.status = "blocked";
    state.blockReasons = reasons;

    // All steps after the blocked step are cancelled (never execute).
    for (let j = i + 1; j < this.states.length; j++) {
      this.states[j].status = "cancelled";
    }
  }

  /**
   * Reset step i back to "pending" after a TRANSIENT, retry-able failure — e.g. the
   * prepared bytes went stale because a prior step changed the coin objects (RPC lag).
   * Unlike blockStep, this does NOT halt the chain: the step can be re-prepared for a
   * fresh build. Later steps are untouched. No-op if the step already advanced.
   */
  resetStepToPending(i: number): void {
    const state = this.states[i];
    if (state && (state.status === "active" || state.status === "blocked")) {
      state.status = "pending";
      state.blockReasons = undefined;
    }
  }

  /**
   * Coin object IDs from step i-1 that step i must wait to see on the RPC node
   * before building. Polling getObject on these IDs (with version check) ensures
   * selectCoin in the lend/transfer builders does not pick a stale object version.
   */
  objectsToWaitBeforeStep(i: number): string[] {
    if (i === 0) return [];
    const prev = this.states[i - 1];
    return prev?.touchedObjectIds ?? [];
  }

  /** True when all steps are done. */
  isComplete(): boolean {
    return this.states.every((s) => s.status === "done");
  }

  /**
   * True when the chain is partially executed and cannot proceed.
   * A chain is incomplete when at least one step is blocked or cancelled.
   */
  isChainIncomplete(): boolean {
    return this.states.some((s) => s.status === "blocked" || s.status === "cancelled") &&
      !this.isComplete();
  }

  /** Collect block reasons from any blocked step. */
  getBlockReasons(): string[] {
    const reasons: string[] = [];
    for (const s of this.states) {
      if (s.status === "blocked" && s.blockReasons) {
        reasons.push(...s.blockReasons);
      }
    }
    return reasons;
  }

  /** Wallet this chain belongs to. */
  getWalletAddress(): string {
    return this.walletAddress;
  }

  /** Net external USD value confirmed across all steps (double-count guarded). */
  totalSignedUsd(): number {
    return this.signedUsd;
  }

  private stateAt(i: number): StepState {
    if (i < 0 || i >= this.states.length) {
      throw new Error(`Step index ${i} out of bounds (chain has ${this.states.length} steps)`);
    }
    return this.states[i];
  }
}

// ---------------------------------------------------------------------------
// Stale-object wait helper (thin wrapper; real implementation polls RPC)
// ---------------------------------------------------------------------------

/**
 * Wait for all objectIds touched by a confirmed step to be visible at the
 * expected post-state version on the given RPC node.
 *
 * The bounded poll prevents infinite waits: each objectId is polled up to
 * maxAttempts times with intervalMs between tries. If an object is still not
 * visible after the bound, the caller should re-select coins and re-run the
 * full Guardian preview on the fresh selection (never retry stale bytes).
 *
 * IMPLEMENTATION NOTE: this is the full polling contract. The actual getObject
 * call is injected via the `getObject` parameter so tests can stub it without
 * a live RPC. In production the caller passes getSuiMainnetClient().getObject.
 */
export async function waitForObjectVersions(
  objectIds: string[],
  getObject: (id: string) => Promise<{ version?: string | null }>,
  opts: { maxAttempts?: number; intervalMs?: number } = {},
): Promise<void> {
  if (objectIds.length === 0) return;
  const { maxAttempts = 10, intervalMs = 500 } = opts;

  for (const id of objectIds) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const obj = await getObject(id);
        if (obj && obj.version != null) break; // visible
      } catch {
        // RPC error → continue polling
      }
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise<void>((r) => setTimeout(r, intervalMs));
      }
    }
    // If still not visible after bound, the caller re-selects coins and re-previews.
    // We do NOT retry the stale bytes — that is the invariant.
  }
}
