/**
 * Test: allowlist refusal — off-allowlist {pkg::mod::fn} is blocked.
 *
 * Tests the pure isTargetAllowed() gate from guardian-gates.ts (no SDK deps),
 * plus the ALLOWED_MOVE_TARGETS set structure from allowlist.ts.
 *
 * The checkAllowlist() wrapper (which uses Transaction.from) is tested at
 * integration level; unit tests here cover the deterministic gate logic
 * which is the security invariant that matters.
 */

import { describe, it, expect } from "vitest";
import {
  ALLOWED_MOVE_TARGETS,
  CETUS_CLMM_PACKAGE,
  CETUS_CLMM_PACKAGE_V2,
  SUINS_PACKAGE,
} from "../allowlist";
import { isTargetAllowed } from "../guardian-gates";

describe("Guardian gate: allowlist refusal (pure gate)", () => {
  it("allows Cetus swap on v1 package", () => {
    expect(isTargetAllowed(`${CETUS_CLMM_PACKAGE}::pool::swap`)).toBe(true);
  });

  it("allows Cetus swap on v2 package", () => {
    expect(isTargetAllowed(`${CETUS_CLMM_PACKAGE_V2}::pool::swap`)).toBe(true);
  });

  it("allows Cetus add_liquidity_fix_coin", () => {
    expect(isTargetAllowed(`${CETUS_CLMM_PACKAGE}::pool::add_liquidity_fix_coin`)).toBe(true);
  });

  it("allows SuiNS registry lookup", () => {
    expect(isTargetAllowed(`${SUINS_PACKAGE}::registry::lookup`)).toBe(true);
  });

  it("allows native pay::split_and_transfer", () => {
    expect(
      isTargetAllowed(
        "0x0000000000000000000000000000000000000000000000000000000000000002::pay::split_and_transfer",
      ),
    ).toBe(true);
  });

  it("blocks an arbitrary off-allowlist drain function", () => {
    const EVIL = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    expect(isTargetAllowed(`${EVIL}::drain::steal_coins`)).toBe(false);
  });

  it("blocks correct package but wrong function name", () => {
    // Even the right Cetus package with an unlisted function is refused
    expect(isTargetAllowed(`${CETUS_CLMM_PACKAGE}::pool::rug_pull`)).toBe(false);
  });

  it("blocks correct package+module but wrong function", () => {
    expect(isTargetAllowed(`${SUINS_PACKAGE}::registry::delete_all`)).toBe(false);
  });

  it("blocks empty string target", () => {
    expect(isTargetAllowed("")).toBe(false);
  });

  it("blocks a target that looks almost right but has extra whitespace", () => {
    expect(isTargetAllowed(`${CETUS_CLMM_PACKAGE}::pool::swap `)).toBe(false);
  });

  describe("ALLOWED_MOVE_TARGETS set integrity", () => {
    it("is non-empty", () => {
      expect(ALLOWED_MOVE_TARGETS.size).toBeGreaterThan(0);
    });

    it("all entries follow {0xPKG::module::function} format", () => {
      for (const target of ALLOWED_MOVE_TARGETS) {
        const parts = target.split("::");
        expect(parts.length, `target "${target}" should have 3 parts`).toBe(3);
        expect(parts[0], `package in "${target}" should start with 0x`).toMatch(
          /^0x[0-9a-f]+$/i,
        );
        expect(parts[1].length, `module in "${target}" should be non-empty`).toBeGreaterThan(0);
        expect(parts[2].length, `function in "${target}" should be non-empty`).toBeGreaterThan(0);
      }
    });

    it("contains both Cetus CLMM package versions", () => {
      const targets = [...ALLOWED_MOVE_TARGETS];
      expect(targets.some((t) => t.startsWith(CETUS_CLMM_PACKAGE))).toBe(true);
      expect(targets.some((t) => t.startsWith(CETUS_CLMM_PACKAGE_V2))).toBe(true);
    });

    it("contains SuiNS package", () => {
      const targets = [...ALLOWED_MOVE_TARGETS];
      expect(targets.some((t) => t.startsWith(SUINS_PACKAGE))).toBe(true);
    });

    it("does NOT contain any wildcard or empty package addresses", () => {
      for (const target of ALLOWED_MOVE_TARGETS) {
        expect(target).not.toContain("*");
        expect(target.split("::")[0]).not.toBe("0x");
        expect(target.split("::")[0]).not.toBe("");
      }
    });
  });
});
