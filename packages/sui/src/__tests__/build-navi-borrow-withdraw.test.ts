/**
 * Tests: buildNaviBorrow / buildNaviWithdraw builder validation.
 *
 * Proves (validation guards fired BEFORE any SDK/RPC call):
 *  1. Non-positive amount is rejected.
 *  2. Unknown coin type is rejected (scam-clone guard) before any build attempt.
 *  3. Borrow/withdraw on a non-NAVI protocol throws (NAVI-only — the Suilend builder
 *     has no borrow/withdraw path and the HF gate is NAVI-specific).
 *  4. Fixture mode returns a no-op PTB for borrow/withdraw (the action reaches the
 *     fixture branch — previously blocked by the action validation).
 *
 * NOTE: The MoveCall-shape contract (only incentive_v3::borrow_v2/withdraw_v2 may
 * appear, no deposit/swap can ride a borrow shape) is NOT tested here — fixture mode
 * emits an empty PTB. That contract is locked in the Guardian action-shape gate tests
 * (packages/agent/.../guardian-hf-gate.test.ts: "swap MoveCall smuggled into a
 * lend_borrow action-shape" + the allowlist assertions). The live PTB path
 * (buildNaviBorrow/buildNaviWithdraw) needs a live RPC and is exercised on mainnet.
 */

import { describe, it, expect } from "vitest";
import { COIN_TYPES } from "../allowlist";
import { buildLend, LendBuildError, type LendSpec } from "../build-lend";

const client = {} as never;

function spec(over: Partial<LendSpec> = {}): LendSpec {
  return {
    senderAddress: "0x" + "a".repeat(64),
    protocol: "navi",
    action: "borrow",
    coinType: COIN_TYPES.USDC,
    amountNative: 10_000_000n, // 10 USDC
    ...over,
  };
}

describe("buildLend — borrow/withdraw validation", () => {
  it("rejects borrow with non-positive amount", async () => {
    await expect(buildLend(client, spec({ action: "borrow", amountNative: 0n }))).rejects.toBeInstanceOf(LendBuildError);
  });

  it("rejects withdraw with non-positive amount", async () => {
    await expect(buildLend(client, spec({ action: "withdraw", amountNative: -1n }))).rejects.toBeInstanceOf(LendBuildError);
  });

  it("rejects borrow with unknown coin type (scam-clone guard)", async () => {
    await expect(
      buildLend(client, spec({ action: "borrow", coinType: "0xdeadbeef::scam::SCAM" })),
    ).rejects.toThrow(/Unknown coin type/);
  });

  it("rejects withdraw with unknown coin type", async () => {
    await expect(
      buildLend(client, spec({ action: "withdraw", coinType: "0xdeadbeef::fake::FAKE" })),
    ).rejects.toThrow(/Unknown coin type/);
  });

  it("rejects borrow on a non-NAVI protocol (NAVI-only; never falls into Suilend repay)", async () => {
    await expect(
      buildLend(client, spec({ action: "borrow", protocol: "suilend" })),
    ).rejects.toThrow(/only buildable on NAVI/);
  });

  it("rejects withdraw on a non-NAVI protocol", async () => {
    await expect(
      buildLend(client, spec({ action: "withdraw", protocol: "suilend" })),
    ).rejects.toThrow(/only buildable on NAVI/);
  });

  it("fixture mode: borrow returns a valid base64 PTB with isFixture=true", async () => {
    // In fixture mode (NEXT_PUBLIC_DEMO_MODE=fixture) the builder skips live RPC
    // and returns a no-op PTB. This validates the borrow code path reaches the
    // fixture branch correctly (was previously blocked by the action validation).
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildLend(client, spec({ action: "borrow" }));
      expect(result.isFixture).toBe(true);
      expect(typeof result.txBytes).toBe("string");
      expect(result.txBytes.length).toBeGreaterThan(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });

  it("fixture mode: withdraw returns a valid base64 PTB with isFixture=true", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildLend(client, spec({ action: "withdraw" }));
      expect(result.isFixture).toBe(true);
      expect(typeof result.txBytes).toBe("string");
      expect(result.txBytes.length).toBeGreaterThan(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });

  it("fixture mode: SUI borrow returns a valid PTB with isFixture=true", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildLend(client, spec({ action: "borrow", coinType: COIN_TYPES.SUI }));
      expect(result.isFixture).toBe(true);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });
});

describe("buildLend — borrow/withdraw action type acceptance", () => {
  it("accepts 'borrow' as a valid LendAction (does not throw Unknown action)", async () => {
    // In fixture mode: should NOT throw "Unsupported lend action" for borrow.
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      // Must not throw LendBuildError with "Unsupported lend action"
      await expect(buildLend(client, spec({ action: "borrow" }))).resolves.toBeDefined();
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });

  it("accepts 'withdraw' as a valid LendAction (does not throw Unknown action)", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      await expect(buildLend(client, spec({ action: "withdraw" }))).resolves.toBeDefined();
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });
});
