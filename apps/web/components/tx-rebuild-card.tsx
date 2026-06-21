"use client";

/**
 * TxRebuildCard — the placeholder a reloaded conversation shows where a signable
 * tx-preview used to be.
 *
 * WHY it exists: signable bytes (txBytes / approvedDigest) are NEVER persisted — they
 * go stale (dry-run, min-out, gas, and the Guardian approval were all computed at that
 * moment). So instead of re-signing old bytes, "Re-build" re-issues the original command
 * through the normal pipeline, producing a FRESH, freshly-Guardian-checked tx-preview.
 */

import { RotateCcw } from "lucide-react";

export function TxRebuildCard({ label, onRebuild }: { label: string; onRebuild: () => void }) {
  return (
    <div
      className="w-full"
      style={{
        maxWidth: 440,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-md)",
        padding: 15,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span
        className="split-mono"
        style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--fg-muted)", textTransform: "uppercase" }}
      >
        Transaction expired
      </span>
      <p style={{ fontSize: "12.5px", color: "var(--fg-muted)", margin: 0, lineHeight: 1.45 }}>
        The signable transaction isn&apos;t kept after a reload — its bytes go stale. Re-build it
        to review a fresh, re-checked transaction and sign again.
      </p>
      {label && (
        <div
          style={{
            fontSize: "12.5px",
            color: "var(--fg)",
            fontWeight: 600,
            padding: "9px 11px",
            borderRadius: 10,
            background: "var(--bg-sub)",
            border: "1px solid var(--border)",
          }}
        >
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={onRebuild}
        className="flex items-center justify-center gap-2 rounded-lg font-semibold"
        style={{
          height: 44,
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          fontSize: "14.5px",
          cursor: "pointer",
          boxShadow: "var(--shadow-aqua)",
        }}
      >
        <RotateCcw size={14} aria-hidden /> Re-build transaction
      </button>
    </div>
  );
}
