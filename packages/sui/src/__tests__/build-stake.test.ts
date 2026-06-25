/**
 * Tests: buildStake / buildUnstake builder validation.
 *
 * Proves (validation guards fired BEFORE any SDK/RPC call):
 *  1. Non-positive amount is rejected.
 *  2. Unknown provider is rejected (fail-closed) before any build attempt.
 *  3. Fixture mode returns a no-op PTB for stake/unstake (action reaches fixture branch).
 *  4. haSUI fixture mode returns a no-op PTB with no MoveCalls.
 *
 * MoveCall-shape contract (only staked_sui_vault::request_stake / request_unstake_atomic
 * appear for afSUI, and interface::request_stake / request_unstake_instant for haSUI,
 * no swap/deposit can ride these shapes) is locked in guardian-staking-gate.test.ts.
 * The live PTB path needs a live RPC and is exercised on mainnet.
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
    lstProvider: "afsui",
    ...over,
  };
}

function unstakeSpec(over: Partial<UnstakeSpec> = {}): UnstakeSpec {
  return {
    senderAddress: WALLET,
    afSuiAmountNative: 1_000_000_000n, // 1 afSUI
    lstProvider: "afsui",
    ...over,
  };
}

function haSuiStakeSpec(over: Partial<StakeSpec> = {}): StakeSpec {
  return {
    senderAddress: WALLET,
    amountNative: 1_000_000_000n, // 1 SUI
    lstProvider: "hasui",
    ...over,
  };
}

function haSuiUnstakeSpec(over: Partial<UnstakeSpec> = {}): UnstakeSpec {
  return {
    senderAddress: WALLET,
    afSuiAmountNative: 1_000_000_000n, // 1 haSUI
    lstProvider: "hasui",
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

// ---------------------------------------------------------------------------
// Phase 3: haSUI (Haedal) builder tests
// ---------------------------------------------------------------------------

describe("buildStake — haSUI (Haedal) validation", () => {
  it("rejects haSUI stake with zero amount", async () => {
    await expect(buildStake(client, haSuiStakeSpec({ amountNative: 0n }))).rejects.toBeInstanceOf(StakeBuildError);
  });

  it("rejects haSUI stake with negative amount", async () => {
    await expect(buildStake(client, haSuiStakeSpec({ amountNative: -1n }))).rejects.toBeInstanceOf(StakeBuildError);
  });

  it("fixture mode: haSUI stake returns a valid base64 PTB with isFixture=true", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildStake(client, haSuiStakeSpec());
      expect(result.isFixture).toBe(true);
      expect(typeof result.txBytes).toBe("string");
      expect(result.txBytes.length).toBeGreaterThan(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });

  it("fixture mode: haSUI stake emits no MoveCalls (fixture PTB is empty)", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildStake(client, haSuiStakeSpec());
      const { Transaction } = await import("@mysten/sui/transactions");
      // Fixture built with onlyTransactionKind → decode via fromKind
      const tx = Transaction.fromKind(Buffer.from(result.txBytes, "base64"));
      const moveCalls = (tx.getData().commands ?? []).filter((c) => "MoveCall" in c && c.MoveCall);
      expect(moveCalls.length).toBe(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });
});

describe("buildUnstake — haSUI (Haedal) validation", () => {
  it("rejects haSUI unstake with zero amount", async () => {
    await expect(buildUnstake(client, haSuiUnstakeSpec({ afSuiAmountNative: 0n }))).rejects.toBeInstanceOf(StakeBuildError);
  });

  it("rejects haSUI unstake with negative amount", async () => {
    await expect(buildUnstake(client, haSuiUnstakeSpec({ afSuiAmountNative: -1n }))).rejects.toBeInstanceOf(StakeBuildError);
  });

  it("fixture mode: haSUI unstake returns a valid base64 PTB with isFixture=true", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildUnstake(client, haSuiUnstakeSpec());
      expect(result.isFixture).toBe(true);
      expect(typeof result.txBytes).toBe("string");
      expect(result.txBytes.length).toBeGreaterThan(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });

  it("fixture mode: haSUI unstake emits no MoveCalls (fixture PTB is empty)", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
    try {
      const result = await buildUnstake(client, haSuiUnstakeSpec());
      const { Transaction } = await import("@mysten/sui/transactions");
      // Fixture built with onlyTransactionKind → decode via fromKind
      const tx = Transaction.fromKind(Buffer.from(result.txBytes, "base64"));
      const moveCalls = (tx.getData().commands ?? []).filter((c) => "MoveCall" in c && c.MoveCall);
      expect(moveCalls.length).toBe(0);
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });
});

describe("buildStake / buildUnstake — unknown provider", () => {
  it("unknown lstProvider on stake → StakeBuildError (fail-closed)", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    // Must NOT be fixture mode so provider check is reached
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    try {
      await expect(
        buildStake(client, { senderAddress: WALLET, amountNative: 1_000_000_000n, lstProvider: "vsui" as never }),
      ).rejects.toBeInstanceOf(StakeBuildError);
    } finally {
      if (originalMode !== undefined) process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });

  it("unknown lstProvider on unstake → StakeBuildError (fail-closed)", async () => {
    const originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    try {
      await expect(
        buildUnstake(client, { senderAddress: WALLET, afSuiAmountNative: 1_000_000_000n, lstProvider: "vsui" as never }),
      ).rejects.toBeInstanceOf(StakeBuildError);
    } finally {
      if (originalMode !== undefined) process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
    }
  });
});
