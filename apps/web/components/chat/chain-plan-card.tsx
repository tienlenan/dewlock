"use client";

/**
 * ChainPlanCard — sequential multi-step intent plan (Track A).
 *
 * Renders an ordered list of steps, each with its own status indicator and
 * a per-step "Sign" affordance. The parent drives the signing cycle:
 *  1. User sees Step 1 as "active" with a prepareTrade result card.
 *  2. User signs Step 1; on receipt, parent confirms the step, computes the
 *     balance delta (pre→post), and resolves Step 2's amount from that delta.
 *  3. Step 2 becomes active with a fresh prepareTrade card for the resolved amount.
 *
 * If any step blocks, the card shows a "chain incomplete" banner explaining
 * which step halted execution and that prior confirmed steps stand.
 *
 * This card is display-only; the signing logic lives in ChatThread via the
 * same useSignAndExecuteTx path as single-step tx-preview cards. The parent
 * passes onStartStep to trigger the next prepareTrade build.
 */

import React from "react";

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
// Main component
// ---------------------------------------------------------------------------

export interface ChainPlanCardProps {
  plan: ChainPlanData;
  /** Called by parent to trigger building the next step (prepareTrade). */
  onStartStep?: (stepIndex: number) => void;
}

export function ChainPlanCard({ plan, onStartStep }: ChainPlanCardProps) {
  const { steps } = plan;

  const hasBlock = steps.some((s) => s.status === "blocked");
  const allDone = steps.every((s) => s.status === "done");

  const activeStep = steps.find((s) => s.status === "active");
  const nextPending = steps.find((s) => s.status === "pending");

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
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
        {allDone && (
          <span style={{ fontSize: 11, color: "#22c55e", marginLeft: "auto" }}>complete</span>
        )}
        {hasBlock && (
          <span style={{ fontSize: 11, color: "var(--destructive)", marginLeft: "auto" }}>
            chain halted
          </span>
        )}
      </div>

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
                    {step.txDigest.slice(0, 12)}…
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
