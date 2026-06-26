"use client";

/**
 * ChainPlanCard — sequential multi-step intent plan (Track A) with optional atomic mode.
 *
 * TOGGLE — "Run as 1 transaction (atomic)" vs "Step-by-step":
 *   When the user selects atomic, the parent calls onRunAtomic() which builds a COMPOSITE
 *   proposal from the chain steps (recipeId "swap_lend_v1", legs from step definitions)
 *   and fires prepareTrade with actionType "composite" → one tx-preview card → one sign.
 *   When the toggle reverts to step-by-step, the existing sequential flow resumes.
 *   Atomic mode is only shown when the plan has exactly 2 steps matching the swap_lend_v1
 *   recipe (swap step → lend step with navi protocol).
 *
 * PIN — while the chain is IN PROGRESS (any step active/pending and not all done/halted):
 *   The card emits isPinned=true via onPinChange callback. The parent (chat-thread.tsx) uses
 *   this to render the card in a sticky slot above the chat input. When the chain completes
 *   or halts, the card emits isPinned=false and returns to its normal inline position.
 */

import React, { useEffect } from "react";

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export type ChainStepStatus = "pending" | "active" | "done" | "blocked" | "cancelled";

export interface ChainPlanStep {
  index: number;
  category: string;
  clause: string;
  amountFrom: "explicit" | "prev-output";
  status: ChainStepStatus;
  /** Resolved concrete amount (shown after delta is computed post step k-1 confirm). */
  resolvedAmount?: string;
  txDigest?: string;
  blockReasons?: string[];
}

export interface ChainPlanData {
  steps: ChainPlanStep[];
  walletAddress: string | null;
  originalText: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  swap: "Swap",
  lend: "Lend / Deposit",
  send: "Send",
  bridge: "Bridge",
  limit: "Limit Order",
};

const STATUS_COLORS: Record<ChainStepStatus, string> = {
  pending: "var(--fg-faint)",
  active: "var(--accent)",
  done: "#22c55e",
  blocked: "var(--destructive)",
  cancelled: "var(--fg-faint)",
};

const STATUS_LABELS: Record<ChainStepStatus, string> = {
  pending: "pending",
  active: "preparing…",
  done: "signed",
  blocked: "blocked",
  cancelled: "cancelled",
};

function StepDot({ status }: { status: ChainStepStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: status === "pending" || status === "cancelled" ? "transparent" : color,
        border: `2px solid ${color}`,
        flexShrink: 0,
        marginTop: 2,
      }}
    />
  );
}

function ChainConnector({ done }: { done: boolean }) {
  return (
    <div
      style={{
        width: 2,
        height: 20,
        background: done ? "#22c55e" : "var(--border)",
        margin: "2px 0 2px 4px",
        borderRadius: 2,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Pin icon — small indicator shown in header when the card is pinned
// ---------------------------------------------------------------------------

function PinIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      aria-label="Pinned"
      role="img"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M8.5 1.5L10.5 3.5L7.5 6.5L8 9L4 5L7 2L8.5 1.5Z"
        stroke="var(--fg-faint)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <line
        x1="4"
        y1="8"
        x2="2"
        y2="10"
        stroke="var(--fg-faint)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Atomic mode eligibility check
// ---------------------------------------------------------------------------

/**
 * Determine if this plan qualifies for atomic (composite) execution.
 * Currently swap_lend_v1 only: exactly 2 steps where step[0] is "swap" and step[1] is "lend".
 * Only shown when neither step has confirmed/blocked yet (nothing signed yet).
 */
export function isAtomicEligible(plan: ChainPlanData): boolean {
  const { steps } = plan;
  if (steps.length !== 2) return false;
  const [s0, s1] = steps;
  if (s0.category !== "swap") return false;
  if (s1.category !== "lend") return false;
  // Only show the toggle before any step has been signed or blocked.
  const anyConfirmedOrBlocked = steps.some(
    (s) => s.status === "done" || s.status === "blocked" || s.status === "cancelled",
  );
  return !anyConfirmedOrBlocked;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ChainPlanCardProps {
  plan: ChainPlanData;
  /** Called by parent to trigger building the next step (prepareTrade). */
  onStartStep?: (stepIndex: number) => void;
  /**
   * Called when the user clicks "Run as 1 transaction (atomic)".
   * The parent builds a composite proposal and calls prepareTrade with actionType "composite".
   */
  onRunAtomic?: () => void;
  /**
   * Called when the card's pin state changes (in-progress → pinned, done/halted → unpinned).
   * The parent uses this to move the card to a sticky slot above the chat input.
   */
  onPinChange?: (pinned: boolean) => void;
  /** True when this card is currently rendered in the sticky pinned slot. */
  isPinned?: boolean;
}

export function ChainPlanCard({ plan, onStartStep, onRunAtomic, onPinChange, isPinned }: ChainPlanCardProps) {
  const { steps } = plan;

  const hasBlock = steps.some((s) => s.status === "blocked");
  const allDone = steps.every((s) => s.status === "done");
  const isInProgress = !hasBlock && !allDone;

  const activeStep = steps.find((s) => s.status === "active");
  const nextPending = steps.find((s) => s.status === "pending");
  const showAtomicToggle = isAtomicEligible(plan) && !!onRunAtomic;

  // Notify parent when pin state changes. Pin = in progress (any step active/pending,
  // nothing done/blocked). Release = complete or halted.
  useEffect(() => {
    onPinChange?.(isInProgress);
  }, [isInProgress, onPinChange]);

  return (
    <div
      style={{
        borderRadius: 12,
        border: isPinned
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
        background: "var(--bg-sub)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 260,
        maxWidth: 380,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 9.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--fg-faint)",
            fontFamily: "var(--font-mono)",
          }}
        >
          sequential plan · {steps.length} steps
        </span>
        {isPinned && (
          <span
            title="Pinned — in progress"
            style={{ display: "flex", alignItems: "center", gap: 3 }}
          >
            <PinIcon />
          </span>
        )}
        {allDone && (
          <span style={{ fontSize: 11, color: "#22c55e", marginLeft: "auto" }}>complete</span>
        )}
        {hasBlock && (
          <span style={{ fontSize: 11, color: "var(--destructive)", marginLeft: "auto" }}>
            chain halted
          </span>
        )}
      </div>

      {/* Atomic toggle — only when eligible (swap→lend, nothing signed yet) */}
      {showAtomicToggle && (
        <button
          onClick={onRunAtomic}
          title="Sign both steps in one atomic transaction (all-or-nothing)"
          style={{
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 11px",
            borderRadius: 7,
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
            color: "var(--accent)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
          aria-label="Run as 1 transaction (atomic) — one signature for both steps"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 5L4.5 6L6.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Run as 1 transaction (atomic)
        </button>
      )}

      {/* Step list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {steps.map((step, i) => (
          <React.Fragment key={step.index}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <StepDot status={step.status} />
                {i < steps.length - 1 && <ChainConnector done={step.status === "done"} />}
              </div>

              <div style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 8 : 0 }}>
                {/* Category + status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>
                    {CATEGORY_LABELS[step.category] ?? step.category}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: STATUS_COLORS[step.status],
                    }}
                  >
                    {STATUS_LABELS[step.status]}
                  </span>
                </div>

                {/* Clause */}
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--fg-sub)",
                    marginTop: 1,
                    fontStyle: "italic",
                    opacity: step.status === "cancelled" ? 0.4 : 1,
                  }}
                >
                  &ldquo;{step.clause}&rdquo;
                </div>

                {/* Derived amount note */}
                {step.amountFrom === "prev-output" && step.status === "pending" && (
                  <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>
                    Amount resolved after Step {i} confirms
                  </div>
                )}
                {step.resolvedAmount && (
                  <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                    Resolved: {step.resolvedAmount} (from on-chain delta — re-confirm before signing)
                  </div>
                )}

                {/* Block reasons */}
                {step.status === "blocked" && step.blockReasons && (
                  <div style={{ marginTop: 4 }}>
                    {step.blockReasons.map((r, ri) => (
                      <div
                        key={ri}
                        style={{ fontSize: 11, color: "var(--destructive)", marginTop: 1 }}
                      >
                        {r}
                      </div>
                    ))}
                  </div>
                )}

                {/* Signed tx link */}
                {step.txDigest && step.status === "done" && (
                  <a
                    href={`https://suiscan.xyz/mainnet/tx/${step.txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 10,
                      color: "var(--fg-faint)",
                      textDecoration: "underline",
                      marginTop: 2,
                      display: "block",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {step.txDigest.slice(0, 12)}&hellip;
                  </a>
                )}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Chain incomplete banner */}
      {hasBlock && (
        <div
          style={{
            borderRadius: 8,
            background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--destructive) 30%, transparent)",
            padding: "8px 10px",
            fontSize: 11,
            color: "var(--destructive)",
            lineHeight: 1.5,
          }}
        >
          Chain halted — steps already confirmed stand on-chain. The blocked step did not
          execute. You can start a new instruction from this point.
        </div>
      )}

      {/* Start next step button (shown when there's a pending step and nothing active) */}
      {!hasBlock && !allDone && !activeStep && nextPending && onStartStep && (
        <button
          onClick={() => onStartStep(nextPending.index)}
          style={{
            alignSelf: "flex-start",
            padding: "6px 14px",
            borderRadius: 8,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Prepare Step {nextPending.index + 1}: {CATEGORY_LABELS[nextPending.category] ?? nextPending.category}
        </button>
      )}
    </div>
  );
}
