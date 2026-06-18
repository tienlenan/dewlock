"use client";

/**
 * ProtocolMetricsSection — the protocol-wide dashboard block: headline totals +
 * the supported-protocols table. Self-fetches GET /api/metrics (like ProtocolList
 * fetches /api/protocols), or renders pre-supplied data (chat-card reuse).
 *
 * Fail-soft throughout: a failing source renders "unavailable" per metric, never
 * a fabricated number; a total fetch failure shows an error line.
 */

import { useEffect, useState } from "react";
import { MetricsTotals, type MetricsTotalsData } from "./metrics-totals";
import { ProtocolMetricsTable, type ProtocolMetricRowDto } from "./protocol-metrics-table";

export interface ProtocolMetricsData {
  totals: MetricsTotalsData;
  perProtocol: ProtocolMetricRowDto[];
  asOf: string;
}

const SHIMMER = "linear-gradient(90deg, var(--bg-sub) 25%, var(--border) 50%, var(--bg-sub) 75%)";

/** Loading skeleton — mirrors the totals card + the protocol table (maxWidth 560). */
function NetworkSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading protocol metrics" style={{ maxWidth: 560, width: "100%" }}>
      <style>{`@keyframes netShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ width: "100%", height: 88, borderRadius: 14, background: SHIMMER, backgroundSize: "200% 100%", animation: "netShimmer 1.6s ease-in-out infinite" }} aria-hidden />
      <div style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", background: "var(--bg-elev)" }} aria-hidden>
        <div style={{ height: 42, borderBottom: "1px solid var(--border)", background: SHIMMER, backgroundSize: "200% 100%", animation: "netShimmer 1.6s ease-in-out infinite" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{ width: 90, height: 12, borderRadius: 4, background: SHIMMER, backgroundSize: "200% 100%", animation: "netShimmer 1.6s ease-in-out infinite" }} />
              <div style={{ flex: 1 }} />
              <div style={{ width: 64, height: 12, borderRadius: 4, background: SHIMMER, backgroundSize: "200% 100%", animation: "netShimmer 1.6s ease-in-out infinite" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProtocolMetricsSection({ data: initial }: { data?: ProtocolMetricsData } = {}) {
  const [data, setData] = useState<ProtocolMetricsData | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return; // supplied (e.g. chat tool result) — skip the fetch
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    fetch("/api/metrics", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ProtocolMetricsData) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [initial]);

  if (error) {
    return (
      <div style={{ maxWidth: 560, padding: 20, textAlign: "center", color: "var(--destructive)", fontSize: 13 }}>
        Couldn’t load protocol metrics ({error}).
      </div>
    );
  }
  if (!data) {
    return <NetworkSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 560, width: "100%" }}>
      <MetricsTotals totals={data.totals} />
      <ProtocolMetricsTable rows={data.perProtocol} />
    </div>
  );
}
