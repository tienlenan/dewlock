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
 * This component is a thin orchestrator: the header + assurance / action-summary /
 * details-grid / asset-flow / permissions / footer sub-components render the body.
 */

import React from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import type {
  BalanceDeltaDisplay,
  ContractCallDisplay,
  ObjectTouchedDisplay,
} from "./tx-preview-format";
import { TxPreviewHeader } from "./tx-preview-header";
import { TxAssuranceHeader } from "./tx-assurance-header";
import { TxActionSummary } from "./tx-action-summary";
import { TxDetailsGrid } from "./tx-details-grid";
import { TxFlowSection } from "./tx-flow-section";
import { TxPermissionsSection } from "./tx-permissions-section";
import { TxPreviewFooter } from "./tx-preview-footer";

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
  const account = useCurrentAccount();

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
      <TxPreviewHeader preview={preview} />

      {/* ── Body ── */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Security-assurance header — truthful-scoped, surfaces third-party transfers */}
        <TxAssuranceHeader
          estimatedUsdValue={preview.estimatedUsdValue}
          objectsTouched={preview.objectsTouched}
        />

        {/* Swap / transfer / lend headline */}
        <TxActionSummary preview={preview} />

        {/* Details grid — Min received / Slippage cap / Network gas / Coin type */}
        <TxDetailsGrid preview={preview} />

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

        {/* Trust gates + sign affordances */}
        <TxPreviewFooter
          preview={preview}
          isPending={isPending}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
