/**
 * Test: decimals-per-coin-type correctness.
 *
 * Verifies that COIN_DECIMALS entries match expected on-chain values, and
 * that the curated map covers all COIN_TYPES entries without gaps.
 * A wrong decimals entry would cause min-out math errors (money risk #1).
 */

import { describe, it, expect } from "vitest";
import { COIN_TYPES, COIN_DECIMALS } from "../allowlist";

describe("COIN_DECIMALS — decimals-per-coin-type correctness", () => {
  it("SUI has 9 decimals (MIST)", () => {
    expect(COIN_DECIMALS[COIN_TYPES.SUI]).toBe(9);
  });

  it("USDC has 6 decimals", () => {
    expect(COIN_DECIMALS[COIN_TYPES.USDC]).toBe(6);
  });

  it("USDT has 6 decimals", () => {
    expect(COIN_DECIMALS[COIN_TYPES.USDT]).toBe(6);
  });

  it("WETH has 8 decimals", () => {
    expect(COIN_DECIMALS[COIN_TYPES.WETH]).toBe(8);
  });

  it("wBTC has 8 decimals", () => {
    expect(COIN_DECIMALS[COIN_TYPES.wBTC]).toBe(8);
  });

  it("every COIN_TYPES entry has a corresponding COIN_DECIMALS entry (no gap)", () => {
    for (const [ticker, coinType] of Object.entries(COIN_TYPES)) {
      expect(
        COIN_DECIMALS[coinType],
        `Missing decimals for ${ticker} (${coinType})`,
      ).toBeDefined();
    }
  });

  it("all decimals values are positive integers in the expected range [0,18]", () => {
    for (const [coinType, decimals] of Object.entries(COIN_DECIMALS)) {
      expect(
        Number.isInteger(decimals) && decimals >= 0 && decimals <= 18,
        `Decimals for ${coinType} is out of range: ${decimals}`,
      ).toBe(true);
    }
  });

  it("native-units cap is computable: 1 SUI = 1e9 MIST (sanity)", () => {
    const oneSui = 1n * 10n ** BigInt(COIN_DECIMALS[COIN_TYPES.SUI]);
    expect(oneSui).toBe(1_000_000_000n);
  });

  it("native-units cap is computable: 1 USDC = 1e6 micro-USDC (sanity)", () => {
    const oneUsdc = 1n * 10n ** BigInt(COIN_DECIMALS[COIN_TYPES.USDC]);
    expect(oneUsdc).toBe(1_000_000n);
  });
});
