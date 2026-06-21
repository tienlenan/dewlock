/**
 * Tests: lending gate (NAVI + Suilend) — verb safety + value capping via outflow.
 *
 * Proves:
 *  1. borrow/withdraw (health-REDUCING) are gated OFF — blocked before build.
 *  2. deposit/repay (health-IMPROVING) require an active+built lending protocol.
 *  3. The shape gate + allowlist permit only deposit/repay targets; a borrow
 *     target (even on an active lender) is refused.
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
  it("BLOCKs borrow (health-reducing, gated off)", () => {
    const r = checkLendingConstraints(lendProposal({ actionType: "lend_borrow" }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("guarded");
  });

  it("BLOCKs withdraw (health-reducing, gated off)", () => {
    const r = checkLendingConstraints(lendProposal({ actionType: "lend_withdraw" }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("guarded");
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

  it("a NAVI BORROW target is refused at allowlist AND lend_deposit shape", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({ target: `${NAVI_PACKAGE}::incentive_v3::borrow`, typeArguments: [COIN_TYPES.USDC], arguments: [] }),
    );
    expect((await checkAllowlist(txBytes)).ok).toBe(false);
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

  it("BLOCKs a borrow before build (gate: lending)", async () => {
    const txBytes = await realBytes();
    const res = await guardianCheck(lendProposal({ txBytes, actionType: "lend_borrow" }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("lending");
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
