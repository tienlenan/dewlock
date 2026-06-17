"use client";

/**
 * MetricsTotals — protocol-wide headline numbers. Each metric shows its source +
 * freshness when available, or an honest "unavailable" (with reason on hover)
 * when the source couldn't provide it. Protocol counts come from the real
 * registry, so they're always present.
 */

import type { Metric } from "@/lib/metrics/metric";

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function freshness(asOf: string): string {
  return asOf.slice(0, 10);
}

function MetricCell({ label, metric, format }: { label: string; metric: Metric; format: (n: number) => string }) {
  const ok = !("unavailable" in metric);
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: ok ? "var(--fg)" : "var(--fg-faint)" }}>
        {ok ? format(metric.value) : "unavailable"}
      </div>
      <div className="split-mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--fg-muted)", marginTop: 2 }}>
        {label}
      </div>
      <div
        className="split-mono"
        title={ok ? undefined : metric.reason}
        style={{ fontSize: 8.5, letterSpacing: "0.06em", color: "var(--fg-faint)", marginTop: 1 }}
      >
        {ok ? `${metric.source} · ${freshness(metric.asOf)}` : (metric.reason ?? "no source")}
      </div>
    </div>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--fg)" }}>{value}</div>
      <div className="split-mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--fg-muted)", marginTop: 2 }}>
        {label}
      </div>
      <div className="split-mono" style={{ fontSize: 8.5, letterSpacing: "0.06em", color: "var(--fg-faint)", marginTop: 1 }}>
        registry
      </div>
    </div>
  );
}

export interface MetricsTotalsData {
  tvl: Metric;
  activeUsers: Metric;
  txCount: Metric;
  supportedProtocols: number;
  activeProtocols: number;
  excludedProtocols: number;
}

export function MetricsTotals({ totals }: { totals: MetricsTotalsData }) {
  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 560, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Protocol-wide</span>
      </div>
      <div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
        <MetricCell label="total tvl" metric={totals.tvl} format={compactUsd} />
        <CountCell label="supported protocols" value={totals.supportedProtocols} />
        <CountCell label="enforced (built)" value={totals.activeProtocols} />
        <MetricCell label="active users" metric={totals.activeUsers} format={(n) => n.toLocaleString()} />
        <MetricCell label="transactions" metric={totals.txCount} format={(n) => n.toLocaleString()} />
      </div>
    </div>
  );
}
