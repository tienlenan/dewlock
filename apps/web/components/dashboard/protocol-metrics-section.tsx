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
    return (
      <div className="split-mono" style={{ maxWidth: 560, padding: 24, textAlign: "center", color: "var(--fg-faint)", fontSize: 11, letterSpacing: "0.1em" }}>
        loading protocol metrics…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 560, width: "100%" }}>
      <MetricsTotals totals={data.totals} />
      <ProtocolMetricsTable rows={data.perProtocol} />
    </div>
  );
}
