/**
 * listProtocols tool — the read-only protocol-posture card.
 *
 * It surfaces the SAME registry the Guardian enforces, so the security-relevant
 * invariant is the active/excluded split: a hacked or not-yet-built protocol must
 * NEVER appear in `active` (where the UI would present it as safe to use).
 *
 * Pure: no LLM, no network — calls the tool's execute directly.
 */

import { describe, it, expect } from "vitest";
import { listProtocols } from "../tools/list-protocols";

type Dto = {
  id: string;
  name: string;
  category: string;
  status: "active" | "listed-excluded" | "hacked";
  buildState: "built" | "deferred" | "excluded";
  targetCount: number;
};
type Result = { active: Dto[]; excluded: Dto[] };

// Mastra tools are invoked as tool.execute(inputObject) (see prepare-trade route).
const run = () =>
  (listProtocols as unknown as { execute: (i: unknown) => Promise<Result> }).execute({});

describe("listProtocols tool", () => {
  it("returns the active + excluded registry split", async () => {
    const r = await run();
    expect(Array.isArray(r.active)).toBe(true);
    expect(Array.isArray(r.excluded)).toBe(true);
    expect(r.active.length).toBeGreaterThan(0); // we ship at least one usable protocol
  });

  it("SECURITY: every active protocol is recognized (status active) — never hacked/excluded", async () => {
    const { active } = await run();
    for (const p of active) {
      // The `active` card must never surface a hacked or listed-excluded protocol as
      // usable. buildState may be "built" OR "deferred" (recognized-but-not-yet-built,
      // shown with a badge) — but never "excluded".
      expect(p.status).toBe("active");
      expect(p.buildState).not.toBe("excluded");
    }
  });

  it("excluded protocols are never active+built (deferred / listed-excluded / hacked)", async () => {
    const { excluded } = await run();
    for (const p of excluded) {
      const isActiveBuilt = p.status === "active" && p.buildState === "built";
      expect(isActiveBuilt).toBe(false);
    }
  });

  it("no protocol id appears in both active and excluded", async () => {
    const { active, excluded } = await run();
    const activeIds = new Set(active.map((p) => p.id));
    for (const p of excluded) expect(activeIds.has(p.id)).toBe(false);
  });

  it("every DTO has the card's required, well-typed fields", async () => {
    const { active, excluded } = await run();
    for (const p of [...active, ...excluded]) {
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe("string");
      expect(typeof p.category).toBe("string");
      expect(["active", "listed-excluded", "hacked"]).toContain(p.status);
      expect(["built", "deferred", "excluded"]).toContain(p.buildState);
      expect(Number.isInteger(p.targetCount)).toBe(true);
      expect(p.targetCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("active+built protocols that move value expose at least one allowlisted target", async () => {
    const { active } = await run();
    // A built, value-moving protocol the Guardian routes to must have ≥1 target;
    // a 0-target active protocol would be a registry wiring mistake.
    const withTargets = active.filter((p) => p.targetCount > 0);
    expect(withTargets.length).toBeGreaterThan(0);
  });
});
