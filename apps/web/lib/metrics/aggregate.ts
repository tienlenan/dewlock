/**
 * Protocol-wide dashboard metrics — joins the REAL protocol registry (status,
 * build state, enforced-target count) with live TVL (DefiLlama) and honest
 * activity metrics. The registry portion is always real; external metrics are
 * fail-soft (per-metric `unavailable`, never fabricated).
 *
 * TTL-cached so the dashboard + chat tool share one external fetch cycle.
 */

import {
  getActiveProtocols,
  getExcludedProtocols,
  getBuiltProtocols,
  type ProtocolEntry,
} from "@dewlock/sui/protocol-registry";
import { type Metric, available, unavailable, isAvailable } from "./metric";
import { getProtocolTvls } from "./tvl";
import { getActivityMetrics } from "./activity";

const CACHE_TTL_MS = 60_000;

export interface ProtocolMetricRow {
  id: string;
  name: string;
  category: string;
  status: ProtocolEntry["status"];
  buildState: ProtocolEntry["buildState"];
  targetCount: number;
  tvl: Metric;
}

export interface DashboardMetrics {
  totals: {
    tvl: Metric;
    activeUsers: Metric;
    txCount: Metric;
    supportedProtocols: number;
    activeProtocols: number;
    excludedProtocols: number;
  };
  perProtocol: ProtocolMetricRow[];
  asOf: string;
}

let cache: { at: number; value: DashboardMetrics } | null = null;

function row(p: ProtocolEntry, tvl: Metric): ProtocolMetricRow {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    status: p.status,
    buildState: p.buildState,
    targetCount: p.allowlistedTargets.length,
    tvl,
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  const active = getActiveProtocols();
  const excluded = getExcludedProtocols();
  const built = getBuiltProtocols();
  const asOf = new Date().toISOString();

  // TVL only for active (live) protocols; excluded ones get an honest reason.
  const tvls = await getProtocolTvls(active.map((p) => ({ id: p.id, name: p.name })));

  const activeRows = active.map((p) => row(p, tvls[p.id] ?? unavailable("no TVL")));
  const excludedRows = excluded.map((p) => row(p, unavailable("excluded — not aggregated")));
  const perProtocol = [...activeRows, ...excludedRows];

  // Total TVL = sum of the available per-protocol TVLs. Unavailable only if NONE
  // resolved (so the page shows "unavailable" rather than a misleading $0).
  const availableTvls = activeRows.map((r) => r.tvl).filter(isAvailable);
  const totalTvl: Metric =
    availableTvls.length > 0
      ? available(availableTvls.reduce((sum, m) => sum + m.value, 0), "DefiLlama", asOf)
      : unavailable("no protocol TVL resolved");

  const activity = getActivityMetrics();

  const value: DashboardMetrics = {
    totals: {
      tvl: totalTvl,
      activeUsers: activity.activeUsers,
      txCount: activity.txCount,
      supportedProtocols: active.length,
      activeProtocols: built.length,
      excludedProtocols: excluded.length,
    },
    perProtocol,
    asOf,
  };

  cache = { at: Date.now(), value };
  return value;
}

/** Test-only: clear the module cache between cases. */
export function __clearMetricsCache(): void {
  cache = null;
}
