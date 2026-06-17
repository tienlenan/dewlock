/**
 * Tests for the protocol-wide metrics aggregator. The TVL module is mocked (no
 * network); the protocol registry is REAL (aliased to source) so the join is
 * exercised against actual registry data. Covers: registry join, total-TVL sum
 * over available metrics, honest unavailable for activity, full fail-soft when
 * TVL is unavailable, and the TTL cache.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ mode: "partial" as "partial" | "none", calls: 0 }));

vi.mock("../tvl", () => ({
  getProtocolTvls: async (protocols: Array<{ id: string }>) => {
    h.calls += 1;
    return Object.fromEntries(
      protocols.map((p, i) => [
        p.id,
        h.mode === "none"
          ? { unavailable: true }
          : i === 0
            ? { value: 100, source: "DefiLlama", asOf: "2026-06-17T00:00:00.000Z" }
            : { unavailable: true },
      ]),
    );
  },
  __clearTvlCache: () => {},
}));

import { getDashboardMetrics, __clearMetricsCache } from "../aggregate";

beforeEach(() => {
  __clearMetricsCache();
  h.mode = "partial";
  h.calls = 0;
});

describe("getDashboardMetrics", () => {
  it("joins live TVL with the real registry and sums available TVL", async () => {
    const m = await getDashboardMetrics();
    // Registry join: active + excluded rows present, keyed by real ids.
    expect(m.perProtocol.length).toBeGreaterThan(5);
    expect(m.perProtocol.some((r) => r.id === "cetus")).toBe(true);
    expect(m.perProtocol.some((r) => r.status === "hacked")).toBe(true);
    // Totals: only the first protocol's TVL was available → sum is 100.
    expect(m.totals.tvl).toMatchObject({ value: 100, source: "DefiLlama" });
    // Counts come from the registry (always real).
    expect(m.totals.supportedProtocols).toBeGreaterThan(5);
    expect(m.totals.activeProtocols).toBeGreaterThan(0);
    expect(m.totals.excludedProtocols).toBeGreaterThan(0);
    // Activity is honestly unavailable, not fabricated.
    expect(m.totals.activeUsers).toHaveProperty("unavailable", true);
    expect(m.totals.txCount).toHaveProperty("unavailable", true);
  });

  it("fail-soft: TVL unavailable still yields registry rows + counts, total unavailable", async () => {
    h.mode = "none";
    __clearMetricsCache();
    const m = await getDashboardMetrics();
    expect(m.totals.tvl).toHaveProperty("unavailable", true);
    expect(m.perProtocol.length).toBeGreaterThan(5); // registry intact
    expect(m.totals.supportedProtocols).toBeGreaterThan(5);
    expect(m.perProtocol.every((r) => "unavailable" in r.tvl)).toBe(true);
  });

  it("caches the result (one TVL fetch across calls)", async () => {
    await getDashboardMetrics();
    await getDashboardMetrics();
    expect(h.calls).toBe(1);
  });
});
