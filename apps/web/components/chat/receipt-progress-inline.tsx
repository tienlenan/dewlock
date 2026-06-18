"use client";

/**
 * ReceiptProgressInline — streams the post-action receipt pipeline (Walrus blob →
 * memwal XP → profile/badges → Sui anchor) step-by-step, rendered INLINE directly
 * under the tx-preview card (not a modal) so progress stays in context with the
 * action that produced it.
 *
 * Presentational: the parent owns useReceiptStream() and passes `state`; the parent
 * commits the final receipt card once the pipeline finishes.
 */

import { Loader2, Check, Minus, X, Circle } from "lucide-react";
import type { ReceiptStreamState, StreamStepStatus } from "./use-receipt-stream";

function StatusIcon({ status }: { status: StreamStepStatus }) {
  switch (status) {
    case "running":
      return <Loader2 size={15} className="animate-spin" style={{ color: "var(--accent)" }} aria-label="running" />;
    case "done":
      return <Check size={15} style={{ color: "var(--accent)" }} aria-label="done" />;
    case "failed":
      return <X size={15} style={{ color: "var(--destructive)" }} aria-label="failed" />;
    case "skipped":
      return <Minus size={15} style={{ color: "var(--fg-faint)" }} aria-label="skipped" />;
    default:
      return <Circle size={9} style={{ color: "var(--fg-faint)", opacity: 0.5 }} aria-label="pending" />;
  }
}

function shortId(id: string): string {
  return id.length <= 14 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function ReceiptProgressInline({ state }: { state: ReceiptStreamState }) {
  const finished = !state.active && (state.result !== null || state.error !== null);
  const result = state.result;

  return (
    <div
      role="status"
      aria-label="Writing receipt"
      style={{
        maxWidth: 440,
        marginTop: 8,
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 14px 11px",
        fontFamily: "var(--font-mono)",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 11 }}>
        <span className="split-mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--fg-muted)" }}>
          {finished ? (state.error ? "receipt · partial" : "receipt · saved") : "receipt · writing…"}
        </span>
        {state.active && <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent)" }} aria-hidden />}
      </div>

      <ol style={{ display: "grid", gap: 9, margin: 0, padding: 0, listStyle: "none" }}>
        {state.steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5" style={{ fontSize: 12.5 }}>
            <span style={{ width: 16, display: "inline-flex", justifyContent: "center", flexShrink: 0 }}>
              <StatusIcon status={s.status} />
            </span>
            <span style={{ color: s.status === "pending" ? "var(--fg-faint)" : "var(--fg)", flex: 1 }}>{s.label}</span>
            {s.detail && (
              <span style={{ fontSize: 10.5, color: "var(--fg-faint)", textAlign: "right", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.detail}
              </span>
            )}
          </li>
        ))}
        {state.steps.length === 0 && (
          <li className="flex items-center gap-2.5" style={{ fontSize: 12.5, color: "var(--fg-faint)" }}>
            <Loader2 size={14} className="animate-spin" aria-hidden /> Starting…
          </li>
        )}
      </ol>

      {result && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "grid", gap: 6, fontSize: 11.5 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--fg-muted)" }}>walrus blob</span>
            <span style={{ color: result.blobId ? "var(--fg)" : "var(--fg-faint)" }}>{result.blobId ? shortId(result.blobId) : "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--fg-muted)" }}>sui object</span>
            <span style={{ color: result.suiObjectId ? "var(--fg)" : "var(--fg-faint)" }}>{result.suiObjectId ? shortId(result.suiObjectId) : "—"}</span>
          </div>
        </div>
      )}

      {state.error && (
        <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--destructive)" }}>{state.error}</p>
      )}
    </div>
  );
}
