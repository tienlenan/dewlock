"use client";

/**
 * BmOnboardingCard — two-step BalanceManager onboarding for DeepBook.
 *
 * Shown when the Guardian returns gate "onboarding_required" on any
 * DeepBook action (cancel_order, withdraw_settled, limit_order, etc.).
 *
 * Step 1: create a shared BalanceManager object (bm_create).
 *   → reads new BM id from effects.objectChanges; carries it in state.
 * Step 2: fund the BM (bm_deposit) with SUI / USDC / DEEP.
 *   → on success: shows "ready" state.
 *
 * Step panels live in bm-onboarding-step-panels.tsx to stay under 200 LOC.
 */

import { useState } from "react";
import {
  CreateStepPanel,
  FundStepPanel,
} from "@/components/app/bm-onboarding-step-panels";

// ── Types ─────────────────────────────────────────────────────────────────────

type BmStep = "create" | "fund" | "done";

interface BmOnboardingCardProps {
  walletAddress: string;
  /** Skip straight to step 2 if a BM already exists this session. */
  existingBmId?: string;
}

// ── Step pip indicator ────────────────────────────────────────────────────────

function StepPips({ current }: { current: BmStep }) {
  const order: BmStep[] = ["create", "fund", "done"];
  const idx = order.indexOf(current);
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {order.slice(0, 2).map((s, i) => (
        <div
          key={s}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background:
              i < idx
                ? "var(--success)"
                : i === idx
                ? "var(--accent)"
                : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BmOnboardingCard({ walletAddress, existingBmId }: BmOnboardingCardProps) {
  const [step, setStep] = useState<BmStep>(existingBmId ? "fund" : "create");
  const [bmId, setBmId] = useState<string | null>(existingBmId ?? null);

  return (
    <div
      style={{
        maxWidth: 440,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "13px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="split-mono"
          style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-muted)" }}
        >
          DeepBook · trading account setup
        </span>
        <StepPips current={step} />
      </div>

      {/* Body */}
      <div style={{ padding: "16px" }}>
        {step === "done" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "color-mix(in srgb, var(--success) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
                fontSize: 13,
                color: "var(--success)",
                lineHeight: 1.5,
              }}
            >
              Trading account ready. Retry your order.
            </div>
            {bmId && (
              <p
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--fg-faint)",
                  wordBreak: "break-all",
                  margin: 0,
                }}
              >
                BM: {bmId}
              </p>
            )}
          </div>
        )}

        {step === "create" && (
          <CreateStepPanel
            walletAddress={walletAddress}
            existingBmId={bmId}
            onSkipToFund={() => setStep("fund")}
            onCreated={(newBmId) => {
              if (newBmId) setBmId(newBmId);
              setStep("fund");
            }}
          />
        )}

        {step === "fund" && (
          <FundStepPanel
            walletAddress={walletAddress}
            bmId={bmId}
            onFunded={() => setStep("done")}
          />
        )}
      </div>
    </div>
  );
}
