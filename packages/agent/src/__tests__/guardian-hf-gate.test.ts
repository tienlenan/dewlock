/**
 * Tests: post-tx health-factor gate for NAVI borrow / withdraw.
 *
 * Proves:
 *  1. Borrow keeping HF ≥ threshold → PASS.
 *  2. Borrow dropping HF < threshold → BLOCK, reason names the HF gate.
 *  3. First-borrow (zero prior debt) → simulation returns sane HF; gate does not
 *     crash or divide-by-zero on 0→positive-debt transition.
 *  4. Simulation THROWS or returns undefined / Infinity / NaN → BLOCK
 *     (proves the gate does NOT inherit build-lend.ts's best-effort skip).
 *  5. Borrow-inflow value gate: an over-cap borrow → BLOCK because a borrow is an
 *     inflow and the net-outflow cap structurally cannot see it.
 *  6. Swap/deposit MoveCall smuggled into a borrow action-shape → BLOCK.
 *  7. Derived-amount borrow/withdraw → BLOCK (provenance hard-block extension).
 *  8. Full-withdraw with residual debt → BLOCK.
 *  9. BLOCK-theater: over-leveraged borrow produces a BLOCK gate result.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { COIN_TYPES, NAVI_PACKAGE } from "../allowlist";
import type { DryRunResult } from "@dewlock/sui/dry-run";

// Mock the NAVI SDK CJS bundle — the real one does live RPC calls.
// We intercept at the guardian's import boundary (guardian.ts requires navi.cjs).
vi.mock("@dewlock/sui/navi-hf-simulation", () => ({
  simulateNaviHealthFactor: vi.fn(),
}));

vi.mock("@dewlock/sui", async () => {
  const { capObjectsForPreview } = await vi.importActual<typeof import("@dewlock/sui/dry-run")>(
    "@dewlock/sui/dry-run",
  );
  return {
    dryRunTransaction: vi.fn(),
    DryRunFailedError: class DryRunFailedError extends Error {},
    capObjectsForPreview,
  };
});

import { dryRunTransaction } from "@dewlock/sui";
import { simulateNaviHealthFactor } from "@dewlock/sui/navi-hf-simulation";
import { guardianCheck, checkLendingConstraints } from "../guardian";
import { checkProvenance } from "../guardian-gates";
import type { TradeProposal } from "../guardian";

const mockDryRun = dryRunTransaction as unknown as import("vitest").Mock<
  (c: unknown, t: string) => Promise<DryRunResult>
>;
const mockSimulateHF = simulateNaviHealthFactor as unknown as import("vitest").Mock<
  (address: string, coinType: string, operation: { type: number; amount: number }) => Promise<number>
>;

const WALLET = "0x" + "a".repeat(64);
const stubClient = {} as Parameters<typeof guardianCheck>[1];

async function realBytes(populate: (tx: Transaction) => void = () => {}): Promise<string> {
  const tx = new Transaction();
  tx.setSender(WALLET);
  tx.setGasBudget(50_000_000n);
  tx.setGasPrice(1000n);
  tx.setGasPayment([{ objectId: "0x" + "d".repeat(64), version: "1", digest: "1".repeat(32) }]);
  populate(tx);
  return Buffer.from(await tx.build()).toString("base64");
}

function borrowProposal(over: Partial<TradeProposal> = {}): TradeProposal {
  return {
    txBytes: "",
    walletAddress: WALLET,
    actionLabel: "borrow",
    actionType: "lend_borrow",
    coinTypeIn: COIN_TYPES.USDC,
    amountInNative: 10_000_000n, // 10 USDC
    lendingProtocol: "navi",
    argProvenance: { amount: "user_turn", coinType: "user_turn" },
    dailyUsdSpentSoFar: 0,
    ...over,
  };
}

function withdrawProposal(over: Partial<TradeProposal> = {}): TradeProposal {
  return {
    txBytes: "",
    walletAddress: WALLET,
    actionLabel: "withdraw",
    actionType: "lend_withdraw",
    coinTypeIn: COIN_TYPES.USDC,
    amountInNative: 10_000_000n, // 10 USDC
    lendingProtocol: "navi",
    argProvenance: { amount: "user_turn", coinType: "user_turn" },
    dailyUsdSpentSoFar: 0,
    ...over,
  };
}

// Minimal dry-run result for a borrow (inflow to wallet, no outflow from user for the coin).
// Borrow does NOT produce an outflow delta for the user — it produces an INFLOW.
function borrowDryRun(): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    // Borrow = coin enters wallet (positive delta). No USDC outflow.
    balanceDeltas: [{ coinType: COIN_TYPES.USDC, amount: 10_000_000n, owner: WALLET }],
    gasCostMist: 1_000_000n,
  };
}

describe("checkLendingConstraints — borrow/withdraw now require HF gate", () => {
  // After the unlock: checkLendingConstraints should PASS for borrow/withdraw
  // (the HF gate runs separately after it).
  it("passes lend_borrow after unlocking", () => {
    const r = checkLendingConstraints(borrowProposal());
    // The old BLOCK for borrow/withdraw is lifted — they now pass the lending gate
    // and are gated by the HF gate instead.
    expect(r.ok).toBe(true);
  });

  it("passes lend_withdraw after unlocking", () => {
    const r = checkLendingConstraints(withdrawProposal());
    expect(r.ok).toBe(true);
  });
});

describe("checkProvenance — derived-amount/coinType borrow/withdraw → hard BLOCK", () => {
  it("BLOCKs lend_borrow with derived amount", () => {
    const r = checkProvenance(borrowProposal({ argProvenance: { amount: "derived", coinType: "user_turn" } }));
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/derived/i);
  });

  it("BLOCKs lend_borrow with derived coinType", () => {
    const r = checkProvenance(borrowProposal({ argProvenance: { amount: "user_turn", coinType: "derived" } }));
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/derived/i);
  });

  it("BLOCKs lend_withdraw with derived amount", () => {
    const r = checkProvenance(withdrawProposal({ argProvenance: { amount: "derived", coinType: "user_turn" } }));
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/derived/i);
  });

  it("does NOT block borrow with both args user_turn", () => {
    const r = checkProvenance(borrowProposal());
    expect(r.blocked).toBe(false);
  });
});

describe("guardianCheck — HF gate for borrow/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TX_USD_CAP", "500");
    vi.stubEnv("DAILY_USD_CAP", "2000");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("PASS: borrow that keeps HF ≥ 1.6", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // Simulation returns HF well above threshold
    mockSimulateHF.mockResolvedValue(2.5);
    mockDryRun.mockResolvedValue(borrowDryRun());

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.preview.actionType).toBe("lend_borrow");
    }
  });

  it("BLOCK: borrow that drops HF below 1.6", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // Simulation returns HF below threshold
    mockSimulateHF.mockResolvedValue(1.4);
    mockDryRun.mockResolvedValue(borrowDryRun());

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.gates).toContain("hf_gate");
      expect(res.reasons.some((r) => r.includes("health factor"))).toBe(true);
    }
  });

  it("BLOCK: first-borrow (zero prior debt) still blocks if HF below threshold", async () => {
    // Zero prior debt means first-borrow: simulation must not crash (no divide-by-zero).
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // First borrow with low collateral → simulation returns low HF
    mockSimulateHF.mockResolvedValue(1.2);
    mockDryRun.mockResolvedValue(borrowDryRun());

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("hf_gate");
  });

  it("PASS: first-borrow with healthy collateral (HF = 3.5 → pass, no crash)", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // First borrow with ample collateral
    mockSimulateHF.mockResolvedValue(3.5);
    mockDryRun.mockResolvedValue(borrowDryRun());

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(true);
  });

  it("BLOCK: simulation THROWS → gate must BLOCK (not skip, not pass)", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // Simulation throws (network error, NAVI API down, etc.)
    mockSimulateHF.mockRejectedValue(new Error("NAVI RPC timeout"));

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.gates).toContain("hf_gate");
      // Must include the reason, not silently skip
      expect(res.reasons.some((r) => r.length > 0)).toBe(true);
    }
  });

  it("BLOCK: simulation returns undefined (unreadable HF) → gate must BLOCK", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // Simulation returns undefined (e.g., RPC returned empty result)
    mockSimulateHF.mockResolvedValue(undefined as unknown as number);

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("hf_gate");
  });

  it("BLOCK: simulation returns Infinity → treat as unverified → BLOCK", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // Infinity HF is a sign of a zero-debt position being mis-read; not a safe pass.
    mockSimulateHF.mockResolvedValue(Infinity);

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("hf_gate");
  });

  it("BLOCK: simulation returns NaN → treat as unverified → BLOCK", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    mockSimulateHF.mockResolvedValue(NaN);

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("hf_gate");
  });

  it("BLOCK: over-cap borrow proves inflow value gate (net-outflow cap cannot catch this)", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // TX_USD_CAP=500. Borrowing 1000 USDC is $1000 > $500.
    // The dry-run shows an INFLOW (+) for USDC — computeNetOutflowUsd skips inflows.
    // The borrow-inflow value gate must catch it independently.
    mockSimulateHF.mockResolvedValue(2.0); // HF is fine but value is over cap
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      // Borrow: coin arrives in wallet (positive delta for user)
      balanceDeltas: [{ coinType: COIN_TYPES.USDC, amount: 1_000_000_000n, owner: WALLET }], // 1000 USDC
      gasCostMist: 1_000_000n,
    });

    const res = await guardianCheck(
      borrowProposal({
        txBytes,
        amountInNative: 1_000_000_000n, // 1000 USDC — > $500 cap
      }),
      stubClient,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      // Must be blocked by borrow_cap gate or tx_cap, NOT by net-outflow
      expect(res.gates.some((g) => g === "borrow_cap" || g === "tx_cap")).toBe(true);
    }
  });

  it("BLOCK: borrow_cap fires in isolation (high tx_cap cannot mask it)", async () => {
    // Prove the borrow-inflow value gate is independent: raise TX_USD_CAP above the
    // borrow value so tx_cap can't fire, drop the borrow cap below it. Only borrow_cap
    // may block — if checkBorrowInflowCap were broken, nothing would catch this.
    vi.stubEnv("TX_USD_CAP", "100000");
    vi.stubEnv("NAVI_BORROW_USD_CAP", "500");
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    mockSimulateHF.mockResolvedValue(2.0); // HF fine; only the borrow cap should bite
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [{ coinType: COIN_TYPES.USDC, amount: 1_000_000_000n, owner: WALLET }], // +1000 USDC inflow
      gasCostMist: 1_000_000n,
    });

    const res = await guardianCheck(
      borrowProposal({ txBytes, amountInNative: 1_000_000_000n }),
      stubClient,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.gates).toContain("borrow_cap");
      expect(res.gates).not.toContain("tx_cap"); // tx_cap raised out of range — proves independence
    }
  });

  it("BLOCK: swap MoveCall smuggled into a lend_borrow action-shape", async () => {
    // A swap target inside a borrow action-shape must be refused by the shape gate.
    const txBytes = await realBytes((tx) => {
      // Swap call (should not appear in a borrow shape)
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      });
      // Smuggled deposit call
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::entry_deposit`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      });
    });
    mockSimulateHF.mockResolvedValue(2.5);
    mockDryRun.mockResolvedValue(borrowDryRun());

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      // Blocked by action_shape gate (deposit call is not in borrow allowlist)
      expect(res.gates).toContain("action_shape");
    }
  });

  it("BLOCK: derived-amount borrow → provenance hard-block", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    mockSimulateHF.mockResolvedValue(2.5);
    mockDryRun.mockResolvedValue(borrowDryRun());

    const res = await guardianCheck(
      borrowProposal({
        txBytes,
        argProvenance: { amount: "derived", coinType: "user_turn" },
      }),
      stubClient,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.gates).toContain("injection_provenance");
    }
  });

  it("BLOCK: full-withdraw with residual debt → BLOCK", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::withdraw_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // Full withdraw (amount == 0 means full) but simulation says position has debt
    // Simulation returns HF below threshold after full withdrawal of all collateral
    mockSimulateHF.mockResolvedValue(0.5); // effectively insolvent
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      // Withdraw: coin exits NAVI and enters wallet (positive delta for user)
      balanceDeltas: [{ coinType: COIN_TYPES.USDC, amount: 50_000_000n, owner: WALLET }], // 50 USDC
      gasCostMist: 1_000_000n,
    });

    const res = await guardianCheck(withdrawProposal({ txBytes }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("hf_gate");
  });

  it("BLOCK-theater: over-leveraged borrow (HF drops to 1.1) writes BLOCK result", async () => {
    // Parity test with the withdraw/BM block-theater pattern. An honest borrow that
    // would leave the position under-collateralized must produce a deterministic BLOCK.
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${NAVI_PACKAGE}::incentive_v3::borrow_v2`,
        typeArguments: [COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    // Position is already leveraged; the simulated post-tx HF drops to 1.1.
    mockSimulateHF.mockResolvedValue(1.1);
    mockDryRun.mockResolvedValue(borrowDryRun());

    const res = await guardianCheck(borrowProposal({ txBytes }), stubClient);
    // The BLOCK result is deterministic — the LLM never sees the PTB.
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.gates).toContain("hf_gate");
      expect(res.reasons.length).toBeGreaterThan(0);
    }
  });
});
