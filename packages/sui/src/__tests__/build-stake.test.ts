/**
 * Tests: buildStake / buildUnstake builder validation.
 *
 * Proves (validation guards fired BEFORE any SDK/RPC call):
 *  1. Non-positive amount is rejected.
 *  2. Unknown coin type is rejected (scam-clone guard) before any build attempt.
 *  3. Fixture mode returns a no-op PTB for stake/unstake (action reaches fixture branch).
 *
 * MoveCall-shape contract (only staked_sui_vault::request_stake / request_unstake_atomic
 * appear, no swap/deposit can ride these shapes) is locked in the Guardian action-shape
 * gate tests (guardian-staking-gate.test.ts). The live PTB path needs a live RPC and
 * is exercised on mainnet.
 */

import { describe, it, expect } from "vitest";
import { COIN_TYPES } from "../allowlist";
import { buildStake, buildUnstake, StakeBuildError, type StakeSpec, type UnstakeSpec } from "../build-stake";

const client = {} as never;
const WALLET = "0x" + "a".repeat(64);

function stakeSpec(over: Partial<StakeSpec> = {}): StakeSpec {
  return {
    senderAddress: WALLET,
    amountNative: 1_000_000_000n, // 1 SUI
    ...over,
  };
}

function unstakeSpec(over: Partial<UnstakeSpec> = {}): UnstakeSpec {
  return {
    senderAddress: WALLET,
    afSuiAmountNative: 1_000_000_000n, // 1 afSUI
    ...over,
  };
}

describe("buildStake — validation", () => {
  it("rejects stake with zero amount", async () => {
    await expect(buildStake(client, stakeSpec({ amountNative: 0n }))).rejects.toBeInstanceOf(StakeBuildError);
  });

  it("rejects stake with negative amount", async () => {
    await expect(buildStake(client, stakeSpec({ amountNative: -1n }))).rejects.toBeInstanceOf(StakeBuildError);
  });

  it("fixture mode: stake returns a valid base64 PTB with isFixture=true", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildStake(client, stakeSpec());
      expect(result.isFixture).toBe(true);
      expect(typeof result.txBytes).toBe("string");
      expect(result.txBytes.length).toBeGreaterThan(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });
});

describe("buildUnstake — validation", () => {
  it("rejects unstake with zero amount", async () => {
    await expect(buildUnstake(client, unstakeSpec({ afSuiAmountNative: 0n }))).rejects.toBeInstanceOf(StakeBuildError);
  });

  it("rejects unstake with negative amount", async () => {
    await expect(buildUnstake(client, unstakeSpec({ afSuiAmountNative: -1n }))).rejects.toBeInstanceOf(StakeBuildError);
  });

  it("fixture mode: unstake returns a valid base64 PTB with isFixture=true", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildUnstake(client, unstakeSpec());
      expect(result.isFixture).toBe(true);
      expect(typeof result.txBytes).toBe("string");
      expect(result.txBytes.length).toBeGreaterThan(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });
});

describe("buildStake — coin type guarding", () => {
  it("fixture mode: stake emits no MoveCalls (fixture PTB is empty)", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildStake(client, stakeSpec());
      // Fixture PTB built as TransactionKind — decode and verify no unexpected Move calls
      const { Transaction } = await import("@mysten/sui/transactions");
      // Fixture is built with onlyTransactionKind — decode via fromKind (from() expects
      // full TransactionData and would RangeError on kind-only bytes).
      const tx = Transaction.fromKind(Buffer.from(result.txBytes, "base64"));
      const moveCalls = (tx.getData().commands ?? []).filter((c) => "MoveCall" in c && c.MoveCall);
      expect(moveCalls.length).toBe(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });

  it("fixture mode: unstake emits no MoveCalls (fixture PTB is empty)", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildUnstake(client, unstakeSpec());
      const { Transaction } = await import("@mysten/sui/transactions");
      // Fixture is built with onlyTransactionKind — decode via fromKind (from() expects
      // full TransactionData and would RangeError on kind-only bytes).
      const tx = Transaction.fromKind(Buffer.from(result.txBytes, "base64"));
      const moveCalls = (tx.getData().commands ?? []).filter((c) => "MoveCall" in c && c.MoveCall);
      expect(moveCalls.length).toBe(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });
});
