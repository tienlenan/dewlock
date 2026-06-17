/**
 * Tests for GET /api/metrics. The aggregator is mocked (no network) — these
 * tests assert the route shape + the fail-soft 503 path, not the aggregation
 * logic (covered in lib/metrics/__tests__/aggregate.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({ throws: false }));

vi.mock("@/lib/metrics/aggregate", () => ({
  getDashboardMetrics: async () => {
    if (h.throws) throw new Error("upstream down");
    return {
      totals: {
        tvl: { value: 100, source: "DefiLlama", asOf: "2026-06-17T00:00:00.000Z" },
        activeUsers: { unavailable: true, reason: "no source" },
        txCount: { unavailable: true, reason: "no source" },
        supportedProtocols: 11,
        activeProtocols: 6,
        excludedProtocols: 4,
      },
      perProtocol: [{ id: "cetus", name: "Cetus", category: "dex", status: "active", buildState: "built", targetCount: 3, tvl: { value: 100, source: "DefiLlama", asOf: "2026-06-17T00:00:00.000Z" } }],
      asOf: "2026-06-17T00:00:00.000Z",
    };
  },
}));

import { GET, OPTIONS } from "../metrics/route";

beforeEach(() => {
  h.throws = false;
});

describe("GET /api/metrics", () => {
  it("returns 200 with totals + perProtocol", async () => {
    const res = await GET(new NextRequest("http://localhost/api/metrics"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals.supportedProtocols).toBe(11);
    expect(body.totals.tvl).toMatchObject({ source: "DefiLlama" });
    expect(body.perProtocol[0].id).toBe("cetus");
  });

  it("OPTIONS returns 204", async () => {
    const res = await OPTIONS(new NextRequest("http://localhost/api/metrics"));
    expect(res.status).toBe(204);
  });

  it("returns 503 if the aggregator throws (fail-soft guard)", async () => {
    h.throws = true;
    const res = await GET(new NextRequest("http://localhost/api/metrics"));
    expect(res.status).toBe(503);
  });
});
