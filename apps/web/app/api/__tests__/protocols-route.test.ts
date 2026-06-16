/**
 * Tests: GET /api/protocols — registry posture surface.
 *
 * Strategy: import the route handler directly and call it with a synthetic
 * NextRequest (no live server). The registry is pure data, so no mocking needed.
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../protocols/route";

interface Dto {
  id: string;
  status: string;
  buildState: string;
  targetCount: number;
  lastIncident?: { date: string };
}

async function fetchProtocols() {
  const req = new NextRequest("http://localhost/api/protocols");
  const res = await GET(req);
  expect(res.status).toBe(200);
  return (await res.json()) as { active: Dto[]; excluded: Dto[] };
}

describe("GET /api/protocols", () => {
  it("returns active + excluded partitions", async () => {
    const body = await fetchProtocols();
    expect(Array.isArray(body.active)).toBe(true);
    expect(Array.isArray(body.excluded)).toBe(true);
    expect(body.active.length).toBeGreaterThan(0);
    expect(body.excluded.length).toBeGreaterThan(0);
  });

  it("active includes built lenders (Cetus, NAVI) and a still-deferred protocol (Scallop)", async () => {
    const body = await fetchProtocols();
    const cetus = body.active.find((p) => p.id === "cetus");
    const navi = body.active.find((p) => p.id === "navi");
    const scallop = body.active.find((p) => p.id === "scallop");
    expect(cetus?.buildState).toBe("built");
    expect(cetus?.targetCount).toBeGreaterThan(0);
    // NAVI is now a built lender (deposit/repay enforced).
    expect(navi?.buildState).toBe("built");
    expect(navi?.targetCount).toBeGreaterThan(0);
    // Scallop is active + audit-clean but has no adapter yet.
    expect(scallop?.buildState).toBe("deferred");
    expect(scallop?.targetCount).toBe(0);
  });

  it("excluded includes hacked Nemo (with incident) and off-model Bluefin", async () => {
    const body = await fetchProtocols();
    const nemo = body.excluded.find((p) => p.id === "nemo");
    const bluefin = body.excluded.find((p) => p.id === "bluefin");
    expect(nemo?.status).toBe("hacked");
    expect(nemo?.lastIncident?.date).toBe("2025-09-07");
    expect(bluefin?.status).toBe("listed-excluded");
  });

  it("excluded protocols never carry enforced targets", async () => {
    const body = await fetchProtocols();
    for (const p of body.excluded) expect(p.targetCount).toBe(0);
  });
});
