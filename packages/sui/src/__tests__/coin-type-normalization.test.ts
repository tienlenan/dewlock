/**
 * Regression: on-chain data (dry-run balance changes) reports coin types with SHORT
 * addresses (e.g. "0x2::sui::SUI"), but the curated keys use the canonical full-length
 * form. Before normalization, getTrustedUsdPrice(short SUI) returned undefined, so the
 * net-outflow gate blocked every SUI swap with "no trusted USD price". These tests lock
 * the normalizer + price lookup so that can't silently regress.
 */

import { describe, it, expect } from "vitest";
import { COIN_TYPES, normalizeCoinType, getTrustedUsdPrice } from "../allowlist";

describe("coin-type normalization", () => {
  it("expands a short SUI address to the canonical full-length type", () => {
    expect(normalizeCoinType("0x2::sui::SUI")).toBe(COIN_TYPES.SUI);
  });

  it("is idempotent on already-canonical types", () => {
    expect(normalizeCoinType(COIN_TYPES.SUI)).toBe(COIN_TYPES.SUI);
    expect(normalizeCoinType(COIN_TYPES.USDC)).toBe(COIN_TYPES.USDC);
  });

  it("passes non-`addr::mod::name` strings through unchanged", () => {
    expect(normalizeCoinType("not-a-coin")).toBe("not-a-coin");
  });
});

describe("getTrustedUsdPrice accepts short on-chain coin types", () => {
  it("prices short-form SUI the same as the canonical form (not undefined)", () => {
    const short = getTrustedUsdPrice("0x2::sui::SUI");
    expect(short).toBeDefined();
    expect(short).toBe(getTrustedUsdPrice(COIN_TYPES.SUI));
  });

  it("prices stablecoins at $1 regardless of address form", () => {
    const shortUsdc = "0x" + COIN_TYPES.USDC.split("::")[0].slice(2).replace(/^0+/, "") + "::usdc::USDC";
    expect(getTrustedUsdPrice(shortUsdc)).toBe(1.0);
  });
});
