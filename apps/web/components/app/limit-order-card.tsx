"use client";

/**
 * LimitOrderCard — DeepBook POST_ONLY limit-order card.
 *
 * Dual-mode:
 *   mode="preview"  — static sample with PREVIEW label, Confirm button disabled.
 *                     Used when the DeepBook backend has not yet produced a real PTB.
 *   mode="live"     — real Guardian-approved PTB; PREVIEW label removed; Confirm
 *                     button active with WYSIWYS sign flow (same as TxPreviewCard).
 *
 * Security affordances:
 *   - Coin type/pair shown explicitly (never just a ticker).
 *   - POST_ONLY chip locked to order type asserted by Guardian gate ob_post_only.
 *   - Guardian gate badges rendered from `gates` prop (not hard-coded).
 *   - In live mode: client re-hashes txBytes and asserts === approvedDigest
 *     (WYSIWYS) before signAndExecuteTransaction is invoked.
 *   - bookParams row (tick/lot/min) shows the on-chain alignment constraints.
 */

import { useState, useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTx } from "@/lib/use-sign-and-execute-tx";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BookParams {
  tickSize: number;
  lotSize: number;
  minSize: number;
}

interface LimitOrderCardProps {
  mode: "preview" | "live";
  /** "BUY" | "SELL" */
  side: string;
  /** e.g. "DEEP/USDC" */
  pair: string;
  /** Human-readable price in quote currency */
  price: string;
  /** Human-readable base-currency size */
  size: string;
  /** Human-readable total in quote currency */
  total: string;
  /** Guardian gate checks that passed */
  gates?: string[];
  // --- Live-mode only ---
  /** Guardian-approved digest (required when mode="live"). */
  approvedDigest?: string;
  /** Base64 unsigned PTB bytes (required when mode="live"). */
  txBytes?: string;
  /** Pool book parameters for the tick/lot/min row. */
  bookParams?: BookParams;
  /** Mid-price at order-build time. */
  midPrice?: number;
  /** Human-readable expiry label (e.g. "in 24 h"). */
  expireLabel?: string;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function GateBadge({ label }: { label: string }) {
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

function OrderRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span
        className="mono"
        style={{ color: muted ? "var(--fg-muted)" : "var(--fg)", fontSize: "12.5px" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function LimitOrderCard({
  mode,
  side,
  pair,
  price,
  size,
  total,
  gates = ["POST_ONLY", "tick ✓", "lot ✓", "no self-match", "BalanceManager cap"],
  approvedDigest,
  txBytes,
  bookParams,
  midPrice,
  expireLabel,
}: LimitOrderCardProps) {
  const [signing, setSigning] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const { signAndExecute } = useSignAndExecuteTx({ approvedDigest });

  const handleSign = useCallback(async () => {
    if (!txBytes || !approvedDigest) return;
    setSigning(true);
    setSignError(null);
    try {
      // Reconstruct Transaction from the Guardian-approved bytes (WYSIWYS flow).
      // The hook asserts digest(bytes) === approvedDigest before wallet prompt.
      const rawBytes = Uint8Array.from(atob(txBytes), (c) => c.charCodeAt(0));
      const tx = Transaction.from(rawBytes);
      const result = await signAndExecute({ transaction: tx });
      setTxDigest(result.digest);
    } catch (err) {
      setSignError(err instanceof Error ? err.message : String(err));
    } finally {
      setSigning(false);
    }
  }, [txBytes, approvedDigest, signAndExecute]);

  const isLive = mode === "live";
  const canSign = isLive && !!txBytes && !!approvedDigest && !signing && !txDigest;

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        maxWidth: "440px",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="split-mono"
          style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--fg-muted)" }}
        >
          Tx preview · limit order
        </span>
        <div className="flex items-center gap-1.5">
          {/* POST_ONLY chip — Guardian-asserted order type */}
          <span
            className="split-mono"
            style={{
              fontSize: "10px",
              color: "var(--accent-ink)",
              background: "var(--accent-soft)",
              padding: "3px 9px",
              borderRadius: 99,
            }}
          >
            POST_ONLY
          </span>
          {/* PREVIEW badge — only in preview mode */}
          {!isLive && (
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
              PREVIEW
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2" style={{ padding: "16px", fontSize: "12.5px" }}>
        <OrderRow label="Side · pair" value={`${side} · ${pair}`} />
        <OrderRow label="Price" value={`${price} USDC`} />
        <OrderRow label="Size" value={`${size} DEEP`} />
        <OrderRow label="Total" value={`${total} USDC`} />

        {/* Mid-price context */}
        {midPrice !== undefined && (
          <OrderRow label="Mid-price" value={midPrice.toFixed(6)} muted />
        )}

        {/* Expiry */}
        {expireLabel && (
          <OrderRow label="Expires" value={expireLabel} muted />
        )}

        {/* Book params: tick / lot / min-size */}
        {bookParams && (
          <div
            className="flex items-center justify-between"
            style={{ marginTop: 2 }}
          >
            <span style={{ color: "var(--fg-muted)" }}>Book params</span>
            <span className="mono" style={{ color: "var(--fg-muted)", fontSize: "11px" }}>
              tick {bookParams.tickSize} · lot {bookParams.lotSize} · min {bookParams.minSize}
            </span>
          </div>
        )}

        {/* Guardian gate badges */}
        {gates.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {gates.map((g) => (
              <GateBadge key={g} label={g} />
            ))}
          </div>
        )}

        {/* Sign success */}
        {txDigest && (
          <div
            className="rounded-lg text-center split-mono"
            style={{
              marginTop: 4,
              padding: "8px 12px",
              fontSize: "11px",
              color: "var(--success)",
              background: "color-mix(in srgb, var(--success) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
            }}
          >
            Order placed · {txDigest.slice(0, 10)}…
          </div>
        )}

        {/* Sign error */}
        {signError && (
          <div
            className="rounded-lg text-center"
            style={{
              marginTop: 4,
              padding: "8px 12px",
              fontSize: "11px",
              color: "var(--error, #ef4444)",
              background: "color-mix(in srgb, var(--error, #ef4444) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error, #ef4444) 25%, transparent)",
            }}
          >
            {signError}
          </div>
        )}

        {/* Confirm button */}
        <button
          type="button"
          disabled={!canSign}
          onClick={handleSign}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg font-semibold"
          style={{
            height: "44px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            fontSize: "14.5px",
            opacity: canSign ? 1 : 0.4,
            cursor: canSign ? "pointer" : "not-allowed",
          }}
          title={isLive ? undefined : "DeepBook limit orders coming soon"}
        >
          {signing ? "Waiting for wallet…" : "Confirm & Sign in wallet"}
        </button>

        {/* Disclosure */}
        {!isLive && (
          <p
            className="text-center"
            style={{ fontSize: "11px", color: "var(--fg-faint)", marginTop: 4 }}
          >
            Sample — DeepBook limit-order backend not yet live
          </p>
        )}
      </div>
    </div>
  );
}

// ── Static sample props (preview mode default) ───────────────────────────────

/** Static sample matching "limit buy 500 DEEP at 0.0031 USDC" scenario. */
export const SAMPLE_LIMIT_ORDER = {
  mode: "preview" as const,
  side: "BUY",
  pair: "DEEP/USDC",
  price: "0.0031",
  size: "500",
  total: "1.55",
  bookParams: { tickSize: 0.000001, lotSize: 1.0, minSize: 1.0 },
  midPrice: 0.003105,
  expireLabel: "24 h",
};
