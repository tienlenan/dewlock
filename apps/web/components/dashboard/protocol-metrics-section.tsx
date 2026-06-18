"use client";

/**
 * ProtocolMetricsSection — the protocol-wide dashboard block: headline totals +
 * the supported-protocols table. Self-fetches GET /api/metrics (like ProtocolList
 * fetches /api/protocols), or renders pre-supplied data (chat-card reuse).
 *
 * Fail-soft throughout: a failing source renders "unavailable" per metric, never
 * a fabricated number. Resilient load (matches the activity cards): a generous 60s
 * budget + a retryable error, and a structured skeleton that mirrors the real cards.
 */

import { useEffect, useState } from "react";
import { DASHBOARD_RELOAD_EVENT } from "@/lib/tx-events";
import { MetricsTotals, type MetricsTotalsData } from "./metrics-totals";
import { ProtocolMetricsTable, type ProtocolMetricRowDto } from "./protocol-metrics-table";
import { NetworkSkeleton } from "./dashboard-skeletons";

export interface ProtocolMetricsData {
  totals: MetricsTotalsData;
  perProtocol: ProtocolMetricRowDto[];
  asOf: string;
}

export function ProtocolMetricsSection({ data: initial }: { data?: ProtocolMetricsData } = {}) {
  const [data, setData] = useState<ProtocolMetricsData | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (initial) return; // supplied (e.g. chat tool result) — skip the fetch
    let cancelled = false;
    let timedOut = false;
    const ctrl = new AbortController();
    // 60s budget (TVL sources can be slow) + retry — a tight abort showed a dead-end error.
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 60_000);
    setError(null);
    fetch("/api/metrics", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ProtocolMetricsData) => !cancelled && setData(d))
      .catch((e) => {
        if (cancelled) return;
        if (timedOut) { setError("Taking longer than usual — tap retry."); return; }
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [initial, reloadKey]);

  // User-triggered hard reload → refetch (skip when data was supplied via props).
  useEffect(() => {
    if (initial) return;
    const onReload = () => setReloadKey((k) => k + 1);
    window.addEventListener(DASHBOARD_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(DASHBOARD_RELOAD_EVENT, onReload);
  }, [initial]);

  if (error && !data) {
    return (
      <div style={{ maxWidth: 560, width: "100%", padding: 16, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", color: "var(--fg-muted)", fontSize: 13 }}>
        <span>Couldn’t load protocol metrics — {error}</span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          style={{ border: "1px solid var(--border)", borderRadius: 99, padding: "5px 14px", background: "var(--bg-sub)", color: "var(--fg)", fontSize: 12.5, cursor: "pointer" }}
        >
          Retry
        </button>
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
