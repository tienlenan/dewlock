"use client";

/**
 * TxPreviewFooter — the trust gates + sign affordances at the bottom of the card:
 * provenance-confirm gate, cap warning, WYSIWYS digest panel, and the Cancel /
 * Confirm row. Owns its own provenance + digest UI state and derives confirmEnabled,
 * so the orchestrator card stays slim. Markup identical to the inline version.
 *
 * Security: the digest panel shows the EXACT approvedDigest; the Confirm button stays
 * disabled until provenance is acknowledged when required — do not relax this gate.
 */

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { TxPreviewData } from "./tx-preview-card";

export function TxPreviewFooter({
  preview,
  isPending = false,
  onConfirm,
  onCancel,
}: {
  preview: TxPreviewData;
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [provenanceAcknowledged, setProvenanceAcknowledged] = useState(false);
  const [showDigest, setShowDigest] = useState(false);
  const confirmEnabled = !isPending && (!preview.requiresProvenanceConfirm || provenanceAcknowledged);

  return (
    <>
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
    </>
  );
}
