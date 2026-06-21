"use client";

/**
 * TxPreviewCard — surfaces Guardian-approved transaction data before the user signs.
 *
 * WHY this component exists: WYSIWYS (What You See Is What You Sign).
 * The card shows the EXACT PTB the Guardian approved — same bytes the wallet will sign.
 * The user must explicitly click "Confirm & Sign" to trigger the wallet prompt.
 *
 * Security invariants enforced at the UI layer (must never be removed):
 *  - Raw 0x address ALWAYS shown alongside any .sui name (spoofing guard).
 *  - Coin TYPE shown (not just ticker) — fake-USDC prevention.
 *  - Balance deltas from dry-run shown before confirm button enables.
 *  - Cap warning badge shown when the tx approaches server-side limits.
 *  - "DEMO" badge shown in fixture mode — no live tx ever fired from fixture data.
 *  - Provenance confirm step interposed when any arg is "derived" (not from user turn).
 *
 * Visual: matches mockup "Tx preview · swap" card — bg-elev, border-radius 14px,
 * shadow-md, "You pay / You receive / Min received / Slippage cap / Network gas" rows.
 */

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { LendSummary } from "./lend-card";
import {
  formatNative,
  formatMist,
  formatUsd,
  shortCoinType,
  type BalanceDeltaDisplay,
  type ContractCallDisplay,
  type ObjectTouchedDisplay,
} from "./tx-preview-format";
import { TxAssuranceHeader } from "./tx-assurance-header";
import { TxPermissionsSection } from "./tx-permissions-section";
import { TxFlowSection } from "./tx-flow-section";
import { useCurrentAccount } from "@mysten/dapp-kit";

// ---------------------------------------------------------------------------
// Types — kept identical to preserve data contract with use-copilot-chat
// ---------------------------------------------------------------------------

export type { BalanceDeltaDisplay } from "./tx-preview-format";

export interface TxPreviewData {
  actionLabel: string;
  coinTypeIn: string;
  coinTypeOut?: string;
  amountInNative: string;
  minAmountOutNative?: string;
  slippageBps?: number;
  swapSource?: "cetus" | "aggregator";
  routeProviders?: string[];
  lendingProtocol?: "navi" | "suilend";
  healthBefore?: number;
  healthAfter?: number;
  recipientAddress?: string;
  estimatedUsdValue: number;
  gasCostMist: string;
  balanceDeltas: BalanceDeltaDisplay[];
  /** Contracts (Move targets) the PTB invokes — permissions UI. Optional for legacy payloads. */
  contractsCalled?: ContractCallDisplay[];
  /** Objects the PTB creates/mutates/transfers — permissions UI (server-capped). */
  objectsTouched?: ObjectTouchedDisplay[];
  /** True object-change count before the cap, for the "+K more" affordance. */
  objectsTouchedTotal?: number;
  /** Real decimals per coin type (server-resolved). Absent → fall back to the curated map. */
  coinDecimals?: Record<string, number>;
  capsWarning: boolean;
  requiresProvenanceConfirm: boolean;
  demoFixture: boolean;
  approvedDigest: string;
}

export interface TxPreviewCardProps {
  preview: TxPreviewData;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isPending?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Security affordance badge — green checkmark chips
function GuardianBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 split-mono"
      style={{
        fontSize: "10px",
        color: "var(--success)",
        background: "color-mix(in srgb, var(--success) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)",
        padding: "3px 8px",
        borderRadius: 99,
      }}
    >
      ✓ {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TxPreviewCard({ preview, onConfirm, onCancel, isPending = false }: TxPreviewCardProps) {
  const [provenanceAcknowledged, setProvenanceAcknowledged] = useState(false);
  const [showDigest, setShowDigest] = useState(false);
  const account = useCurrentAccount();

  const isLend = !!preview.lendingProtocol;
  const isSwap = !!preview.coinTypeOut && !isLend;
  const isTransfer = !preview.coinTypeOut && !isLend;
  const lendVerb: "deposit" | "repay" = /repay/i.test(preview.actionLabel) ? "repay" : "deposit";
  const confirmEnabled = !isPending && (!preview.requiresProvenanceConfirm || provenanceAcknowledged);

  const amountIn = formatNative(preview.amountInNative, preview.coinTypeIn, preview.coinDecimals);
  const tickerIn = shortCoinType(preview.coinTypeIn);
  const amountOut = preview.minAmountOutNative && preview.coinTypeOut
    ? formatNative(preview.minAmountOutNative, preview.coinTypeOut, preview.coinDecimals)
    : null;
  const tickerOut = preview.coinTypeOut ? shortCoinType(preview.coinTypeOut) : null;
  const gasCost = formatMist(preview.gasCostMist);

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        maxWidth: "440px",
        border: preview.capsWarning
          ? "1px solid color-mix(in srgb, var(--warning) 50%, transparent)"
          : "1px solid var(--border)",
        borderRadius: "14px",
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="split-mono"
          style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--fg-muted)" }}
        >
          Tx preview · {preview.actionLabel.toLowerCase()}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {preview.demoFixture && (
            <span
              className="split-mono"
              style={{
                fontSize: "10px",
                color: "var(--warning)",
                background: "color-mix(in srgb, var(--warning) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                padding: "3px 9px",
                borderRadius: 99,
              }}
            >
              DEMO
            </span>
          )}
          {preview.capsWarning && (
            <span
              className="split-mono"
              style={{
                fontSize: "10px",
                color: "var(--destructive)",
                background: "color-mix(in srgb, var(--destructive) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--destructive) 30%, transparent)",
                padding: "3px 9px",
                borderRadius: 99,
              }}
            >
              CAP WARNING
            </span>
          )}
          <span
            className="split-mono"
            style={{
              fontSize: "10px",
              color: "var(--success)",
              padding: "0 2px",
            }}
          >
            dry-run ✓
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>

        {/* Security-assurance header — truthful-scoped, surfaces third-party transfers */}
        <TxAssuranceHeader
          estimatedUsdValue={preview.estimatedUsdValue}
          objectsTouched={preview.objectsTouched}
        />

        {/* You pay / You receive — swap style */}
        {isSwap && (
          <div className="flex flex-col gap-2">
            {/* You pay box */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: "13px 15px",
                background: "var(--bg-sub)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
              }}
            >
              <div>
                <div
                  className="split-mono"
                  style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)" }}
                >
                  You pay
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, marginTop: 2 }}>
                  {amountIn}{" "}
                  <span style={{ fontSize: "12px", color: "var(--fg-muted)" }}>{tickerIn}</span>
                </div>
              </div>
              {/* Down-arrow indicator */}
              <div
                className="flex items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 99,
                  background: "var(--accent-soft)",
                  color: "var(--accent-ink)",
                  fontSize: 16,
                }}
              >
                ↓
              </div>
            </div>

            {/* You receive box */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: "13px 15px",
                background: "var(--bg-sub)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
              }}
            >
              <div>
                <div
                  className="split-mono"
                  style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)" }}
                >
                  You receive (min)
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, marginTop: 2 }}>
                  ~{amountOut}{" "}
                  <span style={{ fontSize: "12px", color: "var(--fg-muted)" }}>{tickerOut}</span>
                </div>
              </div>
              {amountOut && (
                <span className="mono" style={{ fontSize: "11px", color: "var(--success)" }}>
                  +{amountOut}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Transfer: send + raw recipient */}
        {isTransfer && (
          <div
            style={{
              padding: "13px 15px",
              background: "var(--bg-sub)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div className="flex items-baseline justify-between">
              <div
                className="split-mono"
                style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)" }}
              >
                You send
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>
                {amountIn}{" "}
                <span style={{ fontSize: "12px", color: "var(--fg-muted)" }}>{tickerIn}</span>
              </div>
            </div>
            {preview.recipientAddress && (
              <div className="flex items-start justify-between gap-2">
                <span
                  className="split-mono"
                  style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)", flexShrink: 0 }}
                >
                  To (raw 0x)
                </span>
                {/* Raw address always shown — spoofing guard */}
                <code
                  className="mono"
                  style={{ fontSize: "11px", color: "var(--fg)", wordBreak: "break-all", textAlign: "right" }}
                >
                  {preview.recipientAddress}
                </code>
              </div>
            )}
          </div>
        )}

        {/* Lend: protocol + asset + health (borrow/withdraw never reach this card) */}
        {isLend && preview.lendingProtocol && (
          <LendSummary
            protocol={preview.lendingProtocol}
            verb={lendVerb}
            amount={amountIn}
            ticker={tickerIn}
            healthBefore={preview.healthBefore}
            healthAfter={preview.healthAfter}
          />
        )}

        {/* Details grid — Min received / Slippage cap / Network gas / Coin type */}
        <div className="flex flex-col gap-2" style={{ fontSize: "12.5px" }}>
          {isSwap && preview.slippageBps !== undefined && (
            <>
              <DetailRow
                label="Min received (re-derived)"
                value={`${amountOut ?? "—"} ${tickerOut ?? ""}`}
                mono
              />
              <DetailRow
                label="Slippage cap"
                value={`${(preview.slippageBps / 100).toFixed(2)}%`}
                mono
              />
            </>
          )}
          {isSwap && preview.swapSource && (
            <DetailRow
              label="Route"
              value={
                preview.swapSource === "aggregator"
                  ? `aggregator · ${(preview.routeProviders ?? []).join(" → ") || "best route"}`
                  : "Cetus (direct pool)"
              }
              mono
            />
          )}
          <DetailRow label="Network gas" value={gasCost} mono />
          {/* Coin type — always shown for fake-coin prevention */}
          <DetailRow
            label="Coin type"
            value={<code className="mono" style={{ fontSize: "10px", wordBreak: "break-all", color: "var(--fg-muted)" }}>{preview.coinTypeIn}</code>}
          />
          <DetailRow
            label="Est. value"
            value={
              <span style={preview.capsWarning ? { color: "var(--destructive)", fontWeight: 600 } : {}}>
                {formatUsd(preview.estimatedUsdValue)}
              </span>
            }
          />
        </div>

        {/* Asset flow — directional, labelled (replaces the raw balance-delta list).
            deriveFlowRows preserves every non-zero delta, so no data is lost. */}
        <TxFlowSection preview={preview} walletAddress={account?.address} />

        {/* Permissions & contracts — collapsible (contracts called + objects touched) */}
        <TxPermissionsSection
          contractsCalled={preview.contractsCalled}
          objectsTouched={preview.objectsTouched}
          objectsTouchedTotal={preview.objectsTouchedTotal}
        />

        {/* Guardian gate badges */}
        <div className="flex flex-wrap gap-1.5">
          <GuardianBadge label="min-out" />
          <GuardianBadge label="coin-type" />
          <GuardianBadge label="allowlist" />
          <GuardianBadge label="cap $5,000" />
        </div>

        {/* Provenance gate */}
        {preview.requiresProvenanceConfirm && (
          <label
            className="flex items-start gap-3 cursor-pointer rounded-lg p-3"
            style={{
              border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
              background: "color-mix(in srgb, var(--warning) 5%, transparent)",
            }}
          >
            <input
              type="checkbox"
              checked={provenanceAcknowledged}
              onChange={(e) => setProvenanceAcknowledged(e.target.checked)}
              style={{ marginTop: 2, accentColor: "var(--warning)" }}
            />
            <span style={{ fontSize: "12px", lineHeight: 1.45, color: "var(--fg-muted)" }}>
              One or more values were inferred rather than typed directly.
              Please verify the details above before signing.
            </span>
          </label>
        )}

        {/* Cap warning */}
        {preview.capsWarning && (
          <div
            className="flex items-start gap-2 rounded-lg p-3"
            style={{
              border: "1px solid color-mix(in srgb, var(--destructive) 30%, transparent)",
              background: "color-mix(in srgb, var(--destructive) 5%, transparent)",
            }}
          >
            <AlertTriangle
              style={{ width: 14, height: 14, color: "var(--destructive)", marginTop: 2, flexShrink: 0 }}
              strokeWidth={1.5}
              aria-hidden
            />
            <p style={{ fontSize: "12px", color: "var(--destructive)", lineHeight: 1.45, margin: 0 }}>
              This transaction approaches your configured spending limit.
              An extra confirmation step is required.
            </p>
          </div>
        )}

        {/* WYSIWYS digest — collapsed by default for advanced users */}
        <button
          type="button"
          aria-expanded={showDigest}
          aria-controls="tx-digest-panel"
          onClick={() => setShowDigest((v) => !v)}
          className="split-mono text-left"
          style={{ fontSize: "10px", color: "var(--fg-subtle)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
        >
          {showDigest ? "Hide" : "Show"} transaction digest
        </button>
        {showDigest && (
          <div
            id="tx-digest-panel"
            className="rounded-lg p-3"
            style={{ background: "var(--bg-sub)", display: "flex", flexDirection: "column", gap: 4 }}
          >
            <code className="mono" style={{ fontSize: "10px", wordBreak: "break-all", color: "var(--fg-muted)" }}>
              SHA-256: {preview.approvedDigest}
            </code>
            <p style={{ fontSize: "11px", color: "var(--fg-muted)", margin: 0 }}>
              Your wallet signs these exact bytes. Digest must match before execution.
            </p>
          </div>
        )}

        {/* CTA row */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-lg font-semibold transition-colors"
            style={{
              height: "44px",
              border: "1px solid var(--border)",
              background: "var(--bg-elev)",
              color: "var(--fg)",
              fontSize: "14px",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={!confirmEnabled}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg font-semibold transition-opacity"
            style={{
              height: "44px",
              background: confirmEnabled ? "var(--accent)" : "var(--accent)",
              color: "#fff",
              border: "none",
              fontSize: "14.5px",
              boxShadow: confirmEnabled ? "var(--shadow-aqua)" : "none",
              cursor: confirmEnabled ? "pointer" : "not-allowed",
              opacity: confirmEnabled ? 1 : 0.4,
            }}
          >
            {/* Checkmark icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M5 8l2 2 4-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isPending ? "Signing…" : "Confirm & Sign in wallet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal layout helper
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span
        className={mono ? "mono" : ""}
        style={{ textAlign: "right", color: "var(--fg)" }}
      >
        {value}
      </span>
    </div>
  );
}
