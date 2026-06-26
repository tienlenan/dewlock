"use client";

/**
 * TxFlowSection — directional asset-flow visualization with a Rows ⇄ Map switcher.
 *
 * Rows (default, mobile-safe): one labelled line per non-zero balance delta.
 * Map: an interactive React Flow node graph (You ⇄ counterparties) — a compact static
 * preview in-card, with a "View full" dialog that gives it room to pan/zoom.
 *
 * Both views render deriveFlowRows() (tested in tx-preview-format.test.ts), which
 * preserves every non-zero delta — so this section is a faithful, labelled
 * replacement for the old raw balance-delta list. Numbers are the dry-run estimate
 * at preview time; the min-out row (in the details grid) is the guaranteed floor.
 */

import React, { useState } from "react";
import { Maximize2 } from "lucide-react";
import {
  deriveFlowRows,
  deriveCompositeFlow,
  type FlowPreviewInput,
  type FlowRow,
  type CompositeFlowStep,
} from "./tx-preview-format";
import { TxFlowGraph } from "./tx-flow-graph";
import { TxFlowDialog } from "./tx-flow-dialog";

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
  // Composite (e.g. swap→lend): render every leg explicitly — the intermediate coin nets
  // to ~0 at the wallet, so the balance-delta rows alone would hide the lend leg.
  const compositeSteps =
    preview.compositeFlow && preview.compositeFlow.length > 0
      ? deriveCompositeFlow(preview.compositeFlow, preview.coinDecimals)
      : null;
  const rows = deriveFlowRows(preview, walletAddress);
  if (!compositeSteps && rows.length === 0) return null;

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
      {view === "rows" ? (
        compositeSteps ? <CompositeRowsView steps={compositeSteps} /> : <RowsView rows={rows} />
      ) : (
        <MapView preview={preview} walletAddress={walletAddress} />
      )}
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

// Composite rows: an explicit You → leg0 → leg1 … chain. Each row shows the hop and the
// coin flowing into it, so a swap→lend composite reads "You → Cetus (1 SUI)" then
// "Cetus → NAVI (USDC)" — the lend leg the balance-delta rows would otherwise hide.
function CompositeRowsView({ steps }: { steps: CompositeFlowStep[] }) {
  return (
    <div style={{ borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
      {steps.map((s, i) => {
        const from = i === 0 ? "You" : steps[i - 1].nodeLabel;
        return (
          <div
            key={i}
            className="flex items-center justify-between gap-2"
            style={{ padding: "8px 12px", fontSize: "12px", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
          >
            <span style={{ color: "var(--fg-muted)", minWidth: 0 }}>
              <strong style={{ color: "var(--fg)" }}>{from}</strong> →{" "}
              <strong style={{ color: "var(--fg)" }}>{s.nodeLabel}</strong>
              <span style={{ color: "var(--fg-faint)" }}> · {s.nodeSub}</span>
            </span>
            <span className="mono split-mono" style={compositeChipStyle(s.isOutflow)}>
              {s.isOutflow ? "−" : ""}
              {s.edgeLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function compositeChipStyle(isOutflow: boolean): React.CSSProperties {
  const color = isOutflow ? OUT : "var(--fg-muted)";
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

// Map: the asset flow as an interactive React Flow graph. The compact in-card preview
// is static (no pan/zoom); "View full" opens a tall, explorable dialog with room to read.
function MapView({ preview, walletAddress }: { preview: FlowPreviewInput; walletAddress?: string }) {
  const [full, setFull] = useState(false);
  return (
    <>
      <div
        style={{
          position: "relative",
          height: 290,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-sub)",
          overflow: "hidden",
        }}
      >
        <TxFlowGraph preview={preview} walletAddress={walletAddress} />
        <button
          type="button"
          onClick={() => setFull(true)}
          className="split-mono"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 5,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: "10px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "4px 9px",
            borderRadius: 7,
            border: "1px solid var(--border)",
            background: "var(--bg-elev)",
            color: "var(--fg-muted)",
            cursor: "pointer",
          }}
        >
          <Maximize2 size={11} aria-hidden /> View full
        </button>
      </div>
      <TxFlowDialog open={full} onClose={() => setFull(false)} preview={preview} walletAddress={walletAddress} />
    </>
  );
}
