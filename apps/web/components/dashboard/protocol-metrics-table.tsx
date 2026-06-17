"use client";

/**
 * ProtocolMetricsTable — per-protocol status (from the real registry) joined with
 * live TVL (DefiLlama). Status + enforced-target count are always real; TVL is
 * fail-soft ("—" with the reason on hover when a source can't provide it).
 */

import type { Metric } from "@/lib/metrics/metric";

export interface ProtocolMetricRowDto {
  id: string;
  name: string;
  category: string;
  status: "active" | "listed-excluded" | "hacked";
  buildState: "built" | "deferred" | "excluded";
  targetCount: number;
  tvl: Metric;
}

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function StatusDot({ status }: { status: ProtocolMetricRowDto["status"] }) {
  const color =
    status === "active" ? "var(--success)" : status === "hacked" ? "var(--destructive)" : "var(--warning)";
  const label = status === "active" ? "active" : status === "hacked" ? "hacked" : "excluded";
  return (
    <span className="split-mono" style={{ fontSize: 9.5, color, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function Row({ p }: { p: ProtocolMetricRowDto }) {
  const tvlOk = !("unavailable" in p.tvl);
  return (
    <div className="flex items-center gap-3" style={{ padding: "11px 16px", borderTop: "1px solid var(--border)" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>{p.name}</span>
          <span className="split-mono" style={{ fontSize: 9, color: "var(--fg-faint)" }}>{p.category}</span>
        </div>
        <div style={{ marginTop: 3 }}>
          <StatusDot status={p.status} />
          {p.status === "active" && p.buildState === "built" && (
            <span className="split-mono" style={{ fontSize: 9, color: "var(--accent-ink)", marginLeft: 8 }}>
              {p.targetCount} enforced targets
            </span>
          )}
        </div>
      </div>
      <span
        title={tvlOk ? undefined : (p.tvl as { reason?: string }).reason}
        style={{ fontSize: 13, fontWeight: 650, color: tvlOk ? "var(--fg)" : "var(--fg-faint)", whiteSpace: "nowrap" }}
      >
        {tvlOk ? compactUsd((p.tvl as { value: number }).value) : "—"}
      </span>
    </div>
  );
}

export function ProtocolMetricsTable({ rows }: { rows: ProtocolMetricRowDto[] }) {
  const withTvl = rows.filter((r) => !("unavailable" in r.tvl)).length;
  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 560, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex items-center justify-between" style={{ padding: "13px 16px" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Supported protocols</span>
        <span className="split-mono" style={{ fontSize: 9.5, letterSpacing: "0.08em", color: "var(--fg-muted)" }}>
          tvl · defillama · {withTvl}/{rows.length}
        </span>
      </div>
      {rows.map((p) => (
        <Row key={p.id} p={p} />
      ))}
    </div>
  );
}
