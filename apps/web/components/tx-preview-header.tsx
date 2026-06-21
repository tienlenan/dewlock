"use client";

/**
 * TxPreviewHeader — the card's top bar: "Tx preview · <action>" plus the status
 * badges (DEMO in fixture mode, CAP WARNING near limits, and the dry-run ✓ marker).
 * Markup identical to the inline version it was extracted from.
 */

import React from "react";
import type { TxPreviewData } from "./tx-preview-card";

export function TxPreviewHeader({ preview }: { preview: TxPreviewData }) {
  return (
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
  );
}
