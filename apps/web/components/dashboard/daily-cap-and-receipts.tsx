"use client";

/**
 * DailyCapAndReceipts — today's spend vs the daily cap + the most recent Dewlock
 * receipts. Both come from the immutable receipt log. The daily figure here is
 * informational; the enforced daily tracker (server-side) remains the authority.
 */

import type { ReceiptDto, DailyUsageDto } from "./types";

function usd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function shortDigest(d: string): string {
  return d.length > 14 ? `${d.slice(0, 8)}…${d.slice(-4)}` : d;
}

function CapBar({ usage }: { usage: DailyUsageDto }) {
  const pct =
    usage.capUsd && usage.capUsd > 0
      ? Math.min(100, Math.round((usage.usedUsd / usage.capUsd) * 100))
      : null;
  return (
    <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: pct != null ? 8 : 0 }}>
        <span className="split-mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--fg-muted)" }}>
          today via dewlock
        </span>
        <span style={{ fontSize: 12, fontWeight: 650, color: "var(--fg)" }}>
          {usd(usage.usedUsd)}
          {usage.capUsd != null && (
            <span style={{ color: "var(--fg-faint)", fontWeight: 400 }}> / {usd(usage.capUsd)} cap</span>
          )}
        </span>
      </div>
      {pct != null && (
        <div style={{ height: 6, borderRadius: 99, background: "var(--bg-sub)", overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: pct >= 100 ? "var(--destructive)" : "var(--accent)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}

export function DailyCapAndReceipts({
  dailyUsage,
  receipts,
}: {
  dailyUsage?: DailyUsageDto;
  receipts?: ReceiptDto[];
}) {
  const hasReceipts = receipts && receipts.length > 0;
  if (!dailyUsage && !hasReceipts) return null;

  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      {dailyUsage && <CapBar usage={dailyUsage} />}

      <div style={{ padding: "13px 16px" }}>
        <div className="split-mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--fg-muted)", marginBottom: 10 }}>
          recent receipts
        </div>
        {hasReceipts ? (
          <div className="flex flex-col gap-2">
            {receipts!.map((r) => (
              <div key={r.txDigest + r.timestamp} className="flex items-center justify-between gap-3">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.actionLabel}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 1 }}>
                    {r.timestamp.slice(0, 10)} · tx {shortDigest(r.txDigest)}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 650, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>{usd(r.usdValue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 11.5, color: "var(--fg-faint)", margin: 0, lineHeight: 1.45 }}>
            No receipts yet — your sealed transactions will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
