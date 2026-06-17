/**
 * Protocol-wide activity metrics (active users + transaction count).
 *
 * Honesty note: there is no free, authoritative, protocol-WIDE activity source
 * for Sui that we can rely on — BlockVision's account endpoints are wallet-scoped
 * (per-address), not protocol-aggregated, and DefiLlama doesn't expose user
 * counts. Rather than fabricate or approximate a misleading number, we return an
 * explicit `unavailable` with the reason. The dashboard renders this as
 * "unavailable", never a placeholder. (Wiring a dedicated Sui analytics API is a
 * documented [needs live-env] follow-up.)
 */

import { type Metric, unavailable } from "./metric";

const REASON = "no authoritative protocol-wide source (BlockVision is wallet-scoped)";

export function getActivityMetrics(): { activeUsers: Metric; txCount: Metric } {
  return {
    activeUsers: unavailable(REASON),
    txCount: unavailable(REASON),
  };
}
