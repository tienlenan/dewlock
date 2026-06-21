"use client";

/**
 * TxFlowDialog — full-size, interactive view of the asset-flow graph. Opened from the
 * Map view's "View full" button; gives React Flow the room (and pan/zoom) it needs to
 * look good, which the compact in-card preview can't. Follows the app's modal pattern
 * (fixed overlay, Escape / backdrop / X to close).
 */

import { useEffect } from "react";
import { X } from "lucide-react";
import { TxFlowGraph } from "./tx-flow-graph";
import type { FlowRow } from "./tx-preview-format";

export function TxFlowDialog({
  open,
  onClose,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  rows: FlowRow[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Transaction asset flow"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 760,
          height: "min(75vh, 560px)",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--bg-elev)",
          boxShadow: "var(--shadow-md)",
          overflow: "hidden",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}
        >
          <span
            className="split-mono"
            style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-muted)" }}
          >
            Asset flow
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", padding: 2 }}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <TxFlowGraph rows={rows} interactive />
        </div>
      </div>
    </div>
  );
}
