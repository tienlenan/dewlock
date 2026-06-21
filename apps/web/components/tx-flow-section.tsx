"use client";

/**
 * TxFlowSection — directional asset-flow visualization with a Rows ⇄ Map switcher.
 *
 * Rows (default, mobile-safe): one labelled line per non-zero balance delta.
 * Map: a hub-and-spoke node graph (You ⇄ counterparties) — opt-in "wow" view that
 * still stacks vertically so it never overflows the narrow chat column.
 *
 * Both views render deriveFlowRows() (tested in tx-preview-format.test.ts), which
 * preserves every non-zero delta — so this section is a faithful, labelled
 * replacement for the old raw balance-delta list. Numbers are the dry-run estimate
 * at preview time; the min-out row (in the details grid) is the guaranteed floor.
 */

import React, { useState } from "react";
import { deriveFlowRows, type FlowPreviewInput, type FlowRow } from "./tx-preview-format";

const OUT = "var(--destructive)";
const IN = "var(--success)";

export function TxFlowSection({
  preview,
  walletAddress,
}: {
  preview: FlowPreviewInput;
  walletAddress?: string;
}) {
  const [view, setView] = useState<"rows" | "map">("rows");
  const rows = deriveFlowRows(preview, walletAddress);
  if (rows.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <p
          className="split-mono"
          style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--fg-muted)", textTransform: "uppercase", margin: 0 }}
        >
          Asset flow <span style={{ color: "var(--fg-faint)" }}>· est. at preview</span>
        </p>
        <Switcher view={view} onChange={setView} />
      </div>
      {view === "rows" ? <RowsView rows={rows} /> : <MapView rows={rows} />}
    </div>
  );
}

function Switcher({ view, onChange }: { view: "rows" | "map"; onChange: (v: "rows" | "map") => void }) {
  return (
    <div
      role="tablist"
      style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}
    >
      {(["rows", "map"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => onChange(v)}
          className="split-mono"
          style={{
            fontSize: "10px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "4px 10px",
            border: "none",
            cursor: "pointer",
            background: view === v ? "var(--accent-soft)" : "transparent",
            color: view === v ? "var(--accent-ink)" : "var(--fg-muted)",
          }}
        >
          {v === "rows" ? "Flow" : "Map"}
        </button>
      ))}
    </div>
  );
}

function amountStyle(direction: "out" | "in"): React.CSSProperties {
  const color = direction === "out" ? OUT : IN;
  return {
    fontSize: "11px",
    color,
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    padding: "2px 8px",
    borderRadius: 99,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

function RowsView({ rows }: { rows: FlowRow[] }) {
  return (
    <div style={{ borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
      {rows.map((r, i) => {
        const from = r.direction === "out" ? r.label : r.counterparty;
        const to = r.direction === "out" ? r.counterparty : r.label;
        return (
          <div
            key={i}
            className="flex items-center justify-between gap-2"
            style={{ padding: "8px 12px", fontSize: "12px", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
          >
            <span style={{ color: "var(--fg-muted)", minWidth: 0 }}>
              <strong style={{ color: "var(--fg)" }}>{from}</strong> → {to}
            </span>
            <span className="mono split-mono" style={amountStyle(r.direction)}>
              {r.direction === "out" ? "−" : "+"}
              {r.amountFormatted} {r.ticker}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function nodeChip(label: string, accent = false): React.ReactNode {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 8,
        background: accent ? "var(--accent-soft)" : "var(--bg-sub)",
        color: accent ? "var(--accent-ink)" : "var(--fg)",
        border: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// Hub-and-spoke "map": a central You node with one labelled edge per flow. Built
// with flex (not fixed-coord SVG) so it stacks and never overflows on mobile.
function MapView({ rows }: { rows: FlowRow[] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--bg-sub)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flexShrink: 0 }}>{nodeChip("You", true)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
        {rows.map((r, i) => {
          const color = r.direction === "out" ? OUT : IN;
          const arrow = r.direction === "out" ? "──▶" : "◀──";
          return (
            <div key={i} className="flex items-center gap-2" style={{ minWidth: 0 }}>
              <span className="mono" style={{ fontSize: "10px", color }}>{arrow}</span>
              <span className="mono split-mono" style={amountStyle(r.direction)}>
                {r.direction === "out" ? "−" : "+"}
                {r.amountFormatted} {r.ticker}
              </span>
              <span className="mono" style={{ fontSize: "10px", color }}>{arrow}</span>
              {nodeChip(r.counterparty)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
