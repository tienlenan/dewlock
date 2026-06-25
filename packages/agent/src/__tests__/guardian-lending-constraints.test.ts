/**
 * Tests: lending gate (NAVI + Suilend) — verb safety + value capping via outflow.
 *
 * Proves:
 *  1. borrow/withdraw (health-REDUCING) now PASS checkLendingConstraints — the HF
 *     gate (checkPostTxHealthFactor) is their post-tx safety backstop.
 *  2. deposit/repay (health-IMPROVING) require an active+built lending protocol.
 *  3. The action-shape gate enforces a MINIMAL-EXACT per-action allowlist:
 *     a NAVI borrow target passes the global allowlist but is refused inside the
 *     lend_deposit action-shape (only deposit targets allowed in that shape).
 *  4. Deposit value is bounded by the dry-run net-outflow cap (over-cap BLOCKs).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { COIN_TYPES, NAVI_PACKAGE, SUILEND_PACKAGE } from "../allowlist";
import type { DryRunResult } from "@dewlock/sui/dry-run";

vi.mock("@dewlock/sui", async () => {
  // Real, dependency-free capObjectsForPreview (dry-run subpath) so the mocked root
  // still satisfies guardian's preview compose; dryRunTransaction stays controllable.
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
import { checkLendingConstraints, checkActionShape, checkAllowlist, guardianCheck } from "../guardian";
import type { TradeProposal } from "../guardian";

const mockDryRun = dryRunTransaction as unknown as import("vitest").Mock<
  (c: unknown, t: string) => Promise<DryRunResult>
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

function lendProposal(over: Partial<TradeProposal>): TradeProposal {
  return {
    txBytes: "",
    walletAddress: WALLET,
    actionLabel: "lend",
    actionType: "lend_deposit",
    coinTypeIn: COIN_TYPES.USDC,
    amountInNative: 2_000_000n, // $2
    argProvenance: { amount: "user_turn", coinType: "user_turn" },
    dailyUsdSpentSoFar: 0,
    lendingProtocol: "navi",
    ...over,
  };
}

describe("checkLendingConstraints", () => {
  // borrow/withdraw now pass checkLendingConstraints — their HF gate runs separately
  // in guardianCheck (checkPostTxHealthFactor + checkBorrowInflowCap).
  it("permits lend_borrow on an active lender (HF gate is the backstop, not this function)", () => {
    const r = checkLendingConstraints(lendProposal({ actionType: "lend_borrow" }));
    expect(r.ok).toBe(true);
  });

  it("permits lend_withdraw on an active lender (HF gate is the backstop, not this function)", () => {
    const r = checkLendingConstraints(lendProposal({ actionType: "lend_withdraw" }));
    expect(r.ok).toBe(true);
  });

  it("permits deposit/repay on an active+built lender (NAVI, Suilend)", () => {
    expect(checkLendingConstraints(lendProposal({ actionType: "lend_deposit", lendingProtocol: "navi" })).ok).toBe(true);
    expect(checkLendingConstraints(lendProposal({ actionType: "lend_repay", lendingProtocol: "suilend" })).ok).toBe(true);
  });

  it("BLOCKs a lending action with no protocol (fail-closed)", () => {
    const r = checkLendingConstraints(lendProposal({ lendingProtocol: undefined }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("lendingProtocol");
  });
});

describe("lending shape + allowlist", () => {
  it("a NAVI deposit target passes both allowlist and lend_deposit shape", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({ target: `${NAVI_PACKAGE}::incentive_v3::entry_deposit`, typeArguments: [COIN_TYPES.USDC], arguments: [] }),
    );
    expect((await checkAllowlist(txBytes)).ok).toBe(true);
    expect((await checkActionShape(lendProposal({ txBytes, actionType: "lend_deposit" }))).ok).toBe(true);
  });

  it("a NAVI BORROW target passes the global allowlist but is refused inside the lend_deposit action-shape", async () => {
    // The allowlist now includes borrow targets (they are part of the NAVI protocol).
    // What prevents a smuggled borrow inside a deposit PTB is the action-shape gate,
    // which enforces a MINIMAL-EXACT allowlist per action: lend_deposit only allows
    // entry_deposit/entry_repay/refresh_stake, not borrow targets.
    const txBytes = await realBytes((tx) =>
      tx.moveCall({ target: `${NAVI_PACKAGE}::incentive_v3::borrow`, typeArguments: [COIN_TYPES.USDC], arguments: [] }),
    );
    // Global allowlist now passes borrow (it is in the NAVI protocol's targets)
    expect((await checkAllowlist(txBytes)).ok).toBe(true);
    // But a borrow call inside a lend_deposit shape is refused by the action-shape gate
    expect((await checkActionShape(lendProposal({ txBytes, actionType: "lend_deposit" }))).ok).toBe(false);
  });

  it("a Suilend deposit target passes lend_deposit shape", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({ target: `${SUILEND_PACKAGE}::lending_market::deposit_liquidity_and_mint_ctokens`, typeArguments: [COIN_TYPES.USDC], arguments: [] }),
    );
    expect((await checkActionShape(lendProposal({ txBytes, actionType: "lend_deposit" }))).ok).toBe(true);
  });
});

describe("guardianCheck — lending end-to-end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TX_USD_CAP", "5");
    vi.stubEnv("DAILY_USD_CAP", "20");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("passes lend_borrow through the lending gate (HF gate is the backstop — tested in guardian-hf-gate.test.ts)", async () => {
    // lend_borrow no longer hard-blocks at checkLendingConstraints.
    // The HF gate (checkPostTxHealthFactor) and borrow-inflow cap block unsafe borrows.
    // A comprehensive lend_borrow integration test lives in guardian-hf-gate.test.ts.
    const r = checkLendingConstraints(lendProposal({ actionType: "lend_borrow" }));
    expect(r.ok).toBe(true);
  });

  it("passes an in-cap NAVI deposit and caps its value from the actual outflow", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({ target: `${NAVI_PACKAGE}::incentive_v3::entry_deposit`, typeArguments: [COIN_TYPES.USDC], arguments: [] }),
    );
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [{ coinType: COIN_TYPES.USDC, amount: -2_000_000n, owner: WALLET }],
      gasCostMist: 0n,
    });
    const res = await guardianCheck(lendProposal({ txBytes, amountInNative: 2_000_000n }), stubClient);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.preview.lendingProtocol).toBe("navi");
  });

  it("BLOCKs a NAVI deposit whose actual outflow exceeds the per-tx cap", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({ target: `${NAVI_PACKAGE}::incentive_v3::entry_deposit`, typeArguments: [COIN_TYPES.USDC], arguments: [] }),
    );
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [{ coinType: COIN_TYPES.USDC, amount: -12_000_000n, owner: WALLET }], // $12 > $5
      gasCostMist: 0n,
    });
    const res = await guardianCheck(lendProposal({ txBytes, amountInNative: 2_000_000n }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("tx_cap");
  });
});
