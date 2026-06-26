"use client";

/**
 * useChainPlanStepper — in-session state machine for sequential multi-step chains.
 *
 * WHY this hook exists separately from useCopilotChat:
 *  - useCopilotChat is already large (~480 lines); chain-stepper state is its own concern.
 *  - The stepper needs access to useSuiClient (from dapp-kit) for balance reads; keeping
 *    it in a dedicated hook avoids threading the Sui client through the chat hook.
 *  - ChatThread / CardSlot can import this directly if needed without touching the chat stream.
 *
 * Lifecycle per chain:
 *  1. A "chain-plan" card appears in the thread (emitted by route.ts). The hook registers
 *     a new PlanStepper + per-step status tracker.
 *  2. User clicks "Prepare Step N" → onStartStep(planId, stepIndex) fires:
 *       a. For step 0 (explicit amount): snapshot coinTypeIn balance, mark step active,
 *          compose command, call sendMessage. The normal intent pipeline runs → tx-preview card.
 *       b. For step k>0 with amountFrom="prev-output": the resolved amount must be known
 *          first (it was computed after step k-1 confirmed). Compose from that resolved amount.
 *  3. Step k's tx confirms via onStepConfirmed(planId, stepIndex, digest, touchedObjIds):
 *       a. Read post-confirm balance of the output coin.
 *       b. Compute delta = resolveStepDelta(preBalance, postBalance).
 *       c. Advance the stepper (confirmStep).
 *       d. Surface resolved amount onto the chain-plan card via updatePlan callback.
 *       e. Step k+1 is now ready for the user to click "Prepare Step k+1".
 *  4. A BLOCK at step k → onStepBlocked: the stepper halts; the card shows chain-halted.
 *
 * DEFERRAL (in scope for this phase):
 *  - In-session only. Cross-refresh persistence is deferred (documented in plan-stepper.ts).
 *  - Balance reads use the Sui RPC client from dapp-kit context. No server-side balance call.
 *
 * STALE-OBJECT WAIT:
 *  - waitForObjectVersions is called before composing step k+1's command (after step k confirms),
 *    gating on the touchedObjectIds from step k so the builder sees up-to-date coin objects.
 */

import { useCallback, useRef } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import {
  PlanStepper,
  resolveStepDelta,
  waitForObjectVersions,
} from "@dewlock/agent/chaining/plan-stepper";
import { POPULAR_TOKENS } from "@dewlock/sui/popular-tokens";
import type { ChainPlanData, ChainPlanStep } from "./chain-plan-card";
import {
  composeChainStepCommand,
  nativeToHuman,
  extractDestinationSymbol,
} from "./chain-step-command-composer";

// ---------------------------------------------------------------------------
// Coin type used for the lend step's output balance read.
// For swap→lend, the output of the swap is the coinTypeOut of step 0.
// We track it at step-confirm time from the tx-preview's coinTypeOut.
// ---------------------------------------------------------------------------

interface ChainEntry {
  stepper: PlanStepper;
  /** Pre-snapshot balance (native bigint) for each step index, keyed by step index. */
  preSnapshots: Map<number, { coinType: string; balance: bigint }>;
  /** Resolved output coin type from step k (to read post-balance for step k+1). */
  outputCoinTypes: Map<number, string>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Callback type for updating the chain-plan card's displayed step states.
 * Called by the stepper after each step confirms / blocks to reflect new status.
 */
export type UpdatePlanFn = (
  planId: string,
  updater: (prev: ChainPlanData) => ChainPlanData,
) => void;

export interface ChainStepperHookReturn {
  /**
   * Register a new chain plan when its card first appears.
   * Idempotent: calling twice for the same planId is a no-op.
   */
  registerPlan: (planId: string, plan: ChainPlanData, walletAddress: string) => void;

  /**
   * Called when the user clicks "Prepare Step N" on the chain-plan card.
   *
   * Snapshots the pre-balance, marks the step active, composes the command,
   * and calls sendMessage. For steps with amountFrom="prev-output", the resolved
   * amount must already be set (from onStepConfirmed of the prior step).
   *
   * @param planId   stable plan identifier (from ChainPlanData key)
   * @param stepIndex 0-based step index
   * @param plan      current plan data (to read step definitions + resolved amounts)
   * @param sendMessage re-submit channel (mirrors the picker-card pattern)
   * @param updatePlan  callback to patch the displayed plan state
   */
  onStartStep: (
    planId: string,
    stepIndex: number,
    plan: ChainPlanData,
    sendMessage: (text: string) => void,
    updatePlan: UpdatePlanFn,
  ) => Promise<void>;

  /**
   * Called by TxPreviewCardWithSigning when a tx that belongs to a chain step confirms.
   *
   * Reads the post-confirm balance, computes the delta, advances the stepper,
   * and surfaces the resolved amount for the next step on the card.
   *
   * @param planId        chain plan identifier
   * @param stepIndex     the step that just confirmed
   * @param txDigest      on-chain tx digest
   * @param touchedObjIds coin object IDs mutated by this step (for stale-object wait)
   * @param outputCoinType coin type produced by this step (e.g. USDC from a swap)
   * @param walletAddress  signer wallet address (for balance read)
   * @param updatePlan    callback to patch the displayed plan state
   */
  onStepConfirmed: (
    planId: string,
    stepIndex: number,
    txDigest: string,
    touchedObjIds: string[],
    outputCoinType: string | null,
    walletAddress: string,
    updatePlan: UpdatePlanFn,
  ) => Promise<void>;

  /**
   * Called when a tx that belongs to a chain step is blocked or sign-rejected.
   * Halts the chain and cancels all subsequent steps.
   */
  onStepBlocked: (
    planId: string,
    stepIndex: number,
    reasons: string[],
    updatePlan: UpdatePlanFn,
  ) => void;

  /**
   * Called when a step's sign failed with a TRANSIENT stale-object error. Resets the
   * step to "pending" (does NOT halt the chain) so the user can re-prepare it for a
   * fresh build via the "Prepare Step N" button.
   */
  onStepStale: (
    planId: string,
    stepIndex: number,
    updatePlan: UpdatePlanFn,
  ) => void;
}

export function useChainPlanStepper(): ChainStepperHookReturn {
  const client = useSuiClient();
  // Keyed by planId (stable per chain-plan card — caller uses plan.originalText as ID).
  const entriesRef = useRef<Map<string, ChainEntry>>(new Map());

  // ---------------------------------------------------------------------------
  // registerPlan
  // ---------------------------------------------------------------------------

  const registerPlan = useCallback(
    (planId: string, plan: ChainPlanData, walletAddress: string) => {
      if (entriesRef.current.has(planId)) return; // already registered — idempotent

      const stepper = new PlanStepper(
        walletAddress,
        plan.steps.map((s) => ({
          category: s.category,
          clause: s.clause,
          amountFrom: s.amountFrom,
        })),
      );

      entriesRef.current.set(planId, {
        stepper,
        preSnapshots: new Map(),
        outputCoinTypes: new Map(),
      });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // onStartStep
  // ---------------------------------------------------------------------------

  const onStartStep = useCallback(
    async (
      planId: string,
      stepIndex: number,
      plan: ChainPlanData,
      sendMessage: (text: string) => void,
      updatePlan: UpdatePlanFn,
    ) => {
      const entry = entriesRef.current.get(planId);
      if (!entry) return; // plan not registered — safety guard

      const step = plan.steps[stepIndex];
      if (!step) return;

      const walletAddress = plan.walletAddress;
      if (!walletAddress) return;

      // Mark step as active in the stepper (enforces ordering: throws if prior not done).
      try {
        entry.stepper.startStep(stepIndex);
      } catch {
        // Step order violated (e.g. user clicked twice) — no-op.
        return;
      }

      // Reflect "active" status on the card immediately so the user sees feedback.
      updatePlan(planId, (prev) => patchStepStatus(prev, stepIndex, "active"));

      // PRE-SNAPSHOT (the delta-safety invariant): if a LATER step consumes this step's
      // output ("swap … then lend it"), we must record the output coin's balance BEFORE
      // this step executes. Otherwise the post-confirm delta would be the wallet's ENTIRE
      // balance of that coin (incl. pre-existing holdings), and "swap 5 SUI→USDC then lend
      // it" would lend the whole balance, not just the ~swap output. The output coin is
      // known here from the swap clause's "to <COIN>" (e.g. USDC) — it does NOT require the
      // Guardian preview. Snapshot it now, before the command is sent.
      const nextStepDef = plan.steps[stepIndex + 1];
      if (nextStepDef && nextStepDef.amountFrom === "prev-output") {
        const outCoinType = resolveOutputCoinType(step.clause);
        if (outCoinType) {
          try {
            const bal = await client.getBalance({ owner: walletAddress, coinType: outCoinType });
            entry.preSnapshots.set(stepIndex, { coinType: outCoinType, balance: BigInt(bal.totalBalance) });
          } catch {
            // RPC read failed — leave the snapshot unset. onStepConfirmed treats a missing
            // snapshot conservatively (delta vs 0), but it surfaces the resolved amount for
            // explicit user re-confirm before any sign, so a stale read can't silently move funds.
          }
        }
      }

      // Stale-object wait: before building step k, wait for objects from step k-1.
      if (stepIndex > 0) {
        const waitIds = entry.stepper.objectsToWaitBeforeStep(stepIndex);
        if (waitIds.length > 0) {
          await waitForObjectVersions(
            waitIds,
            async (id) => {
              const obj = await client.getObject({ id, options: { showContent: false } });
              return { version: obj.data?.version ?? null };
            },
            { maxAttempts: 12, intervalMs: 500 },
          );
        }
      }

      // Compose the command for this step.
      const resolvedAmountHuman = step.resolvedAmount
        ? parseResolvedAmount(step.resolvedAmount)
        : undefined;

      const command = composeChainStepCommand(
        { category: step.category, clause: step.clause, amountFrom: step.amountFrom },
        {
          resolvedAmountHuman,
          symbolOverride: extractSymbolFromResolvedAmount(step.resolvedAmount),
        },
      );

      // Re-submit via the normal chat pipeline (mirrors picker-card pattern).
      sendMessage(command);
    },
    [client],
  );

  // ---------------------------------------------------------------------------
  // onStepConfirmed
  // ---------------------------------------------------------------------------

  const onStepConfirmed = useCallback(
    async (
      planId: string,
      stepIndex: number,
      txDigest: string,
      touchedObjIds: string[],
      outputCoinType: string | null,
      walletAddress: string,
      updatePlan: UpdatePlanFn,
    ) => {
      const entry = entriesRef.current.get(planId);
      if (!entry) return;

      // Record the output coin type from this step so we can snapshot it and read
      // the post-confirm balance for the delta calculation.
      if (outputCoinType) {
        entry.outputCoinTypes.set(stepIndex, outputCoinType);
      }

      // Confirm the step in the stepper (idempotent per digest).
      entry.stepper.confirmStep(stepIndex, {
        txDigest,
        touchedObjectIds: touchedObjIds,
        // Step k+1 (prev-output) is recycled — marks it $0 net external spend.
        isRecycled: stepIndex > 0,
      });

      // Reflect done status on the card.
      updatePlan(planId, (prev) =>
        patchStepStatusAndDigest(prev, stepIndex, "done", txDigest),
      );

      // ---------------------------------------------------------------------------
      // Resolve the amount for the next step if it has amountFrom="prev-output".
      // We read the POST-confirm balance of the output coin and compute the delta
      // vs the PRE-snapshot captured when this step started.
      // ---------------------------------------------------------------------------
      const nextStepIndex = stepIndex + 1;
      const nextStep = entry.stepper.getStepStates()[nextStepIndex];

      if (nextStep && nextStep.step.amountFrom === "prev-output" && outputCoinType) {
        // Read post-confirm balance after the tx is indexed.
        // A brief wait gives the RPC node time to index the effects.
        await sleep(1500);

        let postBalance = 0n;
        try {
          const balResult = await client.getBalance({
            owner: walletAddress,
            coinType: outputCoinType,
          });
          postBalance = BigInt(balResult.totalBalance);
        } catch {
          // RPC error — delta defaults to 0; user will see "resolved: 0 COIN".
        }

        // Pre-snapshot: the output coin's balance captured at this step's START (before it
        // executed) — see onStartStep. The delta = post − pre isolates THIS step's output
        // from any pre-existing holdings, so a chain lends only what the swap produced.
        // If the snapshot is missing or for a different coin (RPC failure at start), fall
        // back to 0; the resolved amount is still surfaced for explicit user re-confirm
        // before signing, so a conservative over-estimate can never sign silently.
        const snap = entry.preSnapshots.get(stepIndex);
        const preBalance = snap?.coinType === outputCoinType ? snap.balance : 0n;

        const delta = resolveStepDelta(preBalance, postBalance);

        // Determine the number of decimals for human-readable formatting.
        // We read from COIN_DECIMALS via nativeToHuman; pass the coinType as the second arg.
        const humanAmount = nativeToHuman(delta, outputCoinType);
        const symbol = coinTypeSymbol(outputCoinType);
        const resolvedLabel = `${humanAmount} ${symbol}`;

        // Surface on the card and unlock the next step for user confirmation.
        // updatePlan closes over a chat.messages snapshot; this runs AFTER the ~1.5s balance
        // read, in a later tick than the "done" patch above, so its base may predate that
        // patch. Re-assert step k = done here (idempotent) so this call cannot clobber it
        // back to "active" — the bug where Step 1 stayed "preparing…" after it confirmed.
        updatePlan(planId, (prev) => {
          const withDone = patchStepStatusAndDigest(prev, stepIndex, "done", txDigest);
          return patchStepResolved(withDone, nextStepIndex, resolvedLabel);
        });
      }

      // If chain is now complete, reflect that. Re-assert this step = done (idempotent)
      // rather than spreading prev — on a stale snapshot a bare {...prev} would revert the
      // just-confirmed last step back to "active" (same clobber class as the resolve patch).
      if (entry.stepper.isComplete()) {
        updatePlan(planId, (prev) => patchStepStatusAndDigest(prev, stepIndex, "done", txDigest));
      }
    },
    [client],
  );

  // ---------------------------------------------------------------------------
  // onStepBlocked
  // ---------------------------------------------------------------------------

  const onStepBlocked = useCallback(
    (
      planId: string,
      stepIndex: number,
      reasons: string[],
      updatePlan: UpdatePlanFn,
    ) => {
      const entry = entriesRef.current.get(planId);
      if (!entry) return;

      entry.stepper.blockStep(stepIndex, reasons);

      // Mark blocked step and cancel all subsequent steps on the card.
      updatePlan(planId, (prev) => {
        let next = patchStepStatus(prev, stepIndex, "blocked");
        // Cancel all steps after the blocked one.
        const blockedIdx = stepIndex;
        next = {
          ...next,
          steps: next.steps.map((s) =>
            s.index > blockedIdx ? { ...s, status: "cancelled" as const } : s,
          ),
        };
        return next;
      });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // onStepStale — transient stale-object failure → reset to re-preparable (no halt)
  // ---------------------------------------------------------------------------

  const onStepStale = useCallback(
    (planId: string, stepIndex: number, updatePlan: UpdatePlanFn) => {
      const entry = entriesRef.current.get(planId);
      if (!entry) return;
      entry.stepper.resetStepToPending(stepIndex);
      // Clear any resolved-amount staleness is unnecessary (the resolved amount stays
      // valid — only the prepared bytes went stale). Just flip the status back so the
      // "Prepare Step N" button reappears for a fresh re-issue.
      updatePlan(planId, (prev) => patchStepStatus(prev, stepIndex, "pending"));
    },
    [],
  );

  return { registerPlan, onStartStep, onStepConfirmed, onStepBlocked, onStepStale };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Produce a new ChainPlanData with a single step's status updated. */
function patchStepStatus(
  plan: ChainPlanData,
  stepIndex: number,
  status: ChainPlanStep["status"],
): ChainPlanData {
  return {
    ...plan,
    steps: plan.steps.map((s) =>
      s.index === stepIndex ? { ...s, status } : s,
    ),
  };
}

function patchStepStatusAndDigest(
  plan: ChainPlanData,
  stepIndex: number,
  status: ChainPlanStep["status"],
  txDigest: string,
): ChainPlanData {
  return {
    ...plan,
    steps: plan.steps.map((s) =>
      s.index === stepIndex ? { ...s, status, txDigest } : s,
    ),
  };
}

function patchStepResolved(
  plan: ChainPlanData,
  stepIndex: number,
  resolvedAmount: string,
): ChainPlanData {
  return {
    ...plan,
    steps: plan.steps.map((s) =>
      s.index === stepIndex ? { ...s, resolvedAmount } : s,
    ),
  };
}

/**
 * Extract numeric part from a resolved amount label like "18.5 USDC".
 * Returns just "18.5" for use in command composition.
 */
function parseResolvedAmount(resolvedAmount: string | undefined): string | undefined {
  if (!resolvedAmount) return undefined;
  // Strip the "(from on-chain delta — re-confirm before signing)" suffix if present.
  const clean = resolvedAmount.replace(/\s*\(.*\)$/, "").trim();
  // Match "<number> <SYMBOL>" and return just the number.
  const m = clean.match(/^([\d.,]+)/);
  return m ? m[1] : clean;
}

/**
 * Extract coin symbol from a resolved amount label like "18.5 USDC".
 * Returns "USDC" for use in composeChainStepCommand's symbolOverride.
 */
function extractSymbolFromResolvedAmount(resolvedAmount: string | undefined): string | undefined {
  if (!resolvedAmount) return undefined;
  const clean = resolvedAmount.replace(/\s*\(.*\)$/, "").trim();
  const m = clean.match(/[\d.,]+\s+([A-Z]{2,6})/);
  return m ? m[1] : undefined;
}

/** Extract a human-readable ticker from a fully-qualified coin type. */
function coinTypeSymbol(coinType: string): string {
  const parts = coinType.split("::");
  return parts[parts.length - 1] ?? coinType;
}

/**
 * Resolve a swap clause's OUTPUT coin type from its "to <SYMBOL>" segment
 * (e.g. "swap 5 SUI to USDC" → the canonical USDC coin type). Returns null when
 * the destination symbol is not a known popular token. The symbol resolves through
 * POPULAR_TOKENS, whose coinType is the same canonical type the Guardian emits as
 * coinTypeOut — so the pre-snapshot coin matches the post-confirm read.
 */
function resolveOutputCoinType(clause: string): string | null {
  const sym = extractDestinationSymbol(clause);
  if (!sym) return null;
  const token = POPULAR_TOKENS.find((t) => t.symbol.toUpperCase() === sym);
  return token?.coinType ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
