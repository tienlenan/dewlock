"use client";

/**
 * LendSummary — the lending-specific body of a Guardian-approved lend preview.
 *
 * Rendered inside TxPreviewCard for lend_deposit / lend_repay so the security
 * machinery (dry-run deltas, WYSIWYS digest, gate badges, confirm flow) is shared
 * (DRY). Shows the protocol, asset + amount, the verb, and health before/after.
 *
 * Borrow/withdraw never reach this card — the Guardian gates them off before a
 * PTB is built, so a lend preview here is always a health-improving action.
 */

export interface LendSummaryProps {
  protocol: "navi" | "suilend";
  verb: "deposit" | "repay";
  amount: string;
  ticker: string;
  healthBefore?: number;
  healthAfter?: number;
}

function fmtHealth(h?: number): string {
  if (h === undefined) return "—";
  if (!Number.isFinite(h) || h > 100) return "∞";
  return h.toFixed(2);
}

export function LendSummary({ protocol, verb, amount, ticker, healthBefore, healthAfter }: LendSummaryProps) {
  return (
    <div
      style={{
        padding: "13px 15px",
        background: "var(--bg-sub)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="split-mono"
          style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)" }}
        >
          {verb === "deposit" ? "Supply" : "Repay"} · {protocol}
        </div>
        <span
          className="split-mono"
          style={{ fontSize: "10px", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)", padding: "2px 8px", borderRadius: 99 }}
        >
          health-improving
        </span>
      </div>
      <div style={{ fontSize: "20px", fontWeight: 700 }}>
        {amount} <span style={{ fontSize: "12px", color: "var(--fg-muted)" }}>{ticker}</span>
      </div>
      {(healthBefore !== undefined || healthAfter !== undefined) && (
        <div className="flex items-center justify-between" style={{ fontSize: "12px" }}>
          <span style={{ color: "var(--fg-muted)" }}>Health factor</span>
          <span className="mono" style={{ color: "var(--fg)" }}>
            {fmtHealth(healthBefore)} → {fmtHealth(healthAfter)}
          </span>
        </div>
      )}
    </div>
  );
}
