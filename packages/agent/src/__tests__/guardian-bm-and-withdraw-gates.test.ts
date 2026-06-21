/**
 * Tests: Guardian gates for the DeepBook order-lifecycle actions.
 *
 *  - Action-shape gate (checkActionShape): each new actionType accepts ONLY its own
 *    MoveCall set; a deposit/withdraw/cancel that smuggles place_limit_order is BLOCKED
 *    (no reuse of the limit_order set).
 *  - Order-lifecycle gate (checkOrderLifecycleConstraints): cancel requires a 0x-hex
 *    orderId; withdraw pins recipient to sender, ceilings the amount by an independently
 *    re-derived settled balance, and BLOCKS fail-closed on a settled-read error.
 *
 * checkActionShape is pure (parses txBytes). The settled-balance read is mocked so the
 * ceiling/fail-closed paths are deterministic and offline.
 */

import { describe, it, expect, vi } from "vitest";
import { Transaction } from "@mysten/sui/transactions";

// Mock the settled-balance reader the withdraw ceiling depends on (fail-closed paths).
vi.mock("@dewlock/sui/account-orders", () => ({
  readSettledBalance: vi.fn(),
}));

import { readSettledBalance } from "@dewlock/sui/account-orders";
import { checkActionShape, checkOrderLifecycleConstraints } from "../guardian";
import { DEEPBOOK_PACKAGE, NATIVE_PACKAGE, COIN_TYPES } from "../allowlist";
import type { TradeProposal } from "../guardian";

const mockReadSettled = readSettledBalance as unknown as import("vitest").Mock;

const WALLET = "0x" + "a".repeat(64);
const BM_ID = "0x" + "b".repeat(64);
const ORDER_ID = "0x" + "f".repeat(20);
const OTHER = "0x" + "c".repeat(64);

// Build real round-trippable PTB bytes with the given MoveCall targets (pure args + manual gas).
async function ptbWithCalls(targets: string[]): Promise<string> {
  const tx = new Transaction();
  tx.setSender(WALLET);
  tx.setGasBudget(50_000_000n);
  tx.setGasPrice(1000n);
  tx.setGasPayment([{ objectId: "0x" + "d".repeat(64), version: "1", digest: "1".repeat(32) }]);
  for (const t of targets) {
    tx.moveCall({
      target: t as `${string}::${string}::${string}`,
      typeArguments: [COIN_TYPES.SUI, COIN_TYPES.USDC],
      arguments: [],
    });
  }
  return Buffer.from(await tx.build()).toString("base64");
}

function baseProposal(o: Partial<TradeProposal>): TradeProposal {
  return {
    txBytes: "",
    walletAddress: WALLET,
    actionLabel: "test",
    actionType: "cancel_order",
    coinTypeIn: COIN_TYPES.USDC,
    amountInNative: 0n,
    argProvenance: {},
    dailyUsdSpentSoFar: 0,
    balanceManagerId: BM_ID,
    ...o,
  };
}

describe("checkActionShape — DeepBook order-lifecycle shapes", () => {
  it("bm_create accepts only new + public_share_object", async () => {
    const txBytes = await ptbWithCalls([
      `${DEEPBOOK_PACKAGE}::balance_manager::new`,
      `${NATIVE_PACKAGE}::transfer::public_share_object`,
    ]);
    const r = await checkActionShape(baseProposal({ actionType: "bm_create", txBytes }));
    expect(r.ok).toBe(true);
  });

  it("bm_deposit accepts only balance_manager::deposit", async () => {
    const txBytes = await ptbWithCalls([`${DEEPBOOK_PACKAGE}::balance_manager::deposit`]);
    const r = await checkActionShape(baseProposal({ actionType: "bm_deposit", txBytes }));
    expect(r.ok).toBe(true);
  });

  it("bm_deposit BLOCKS a smuggled place_limit_order (no limit_order-set reuse)", async () => {
    const txBytes = await ptbWithCalls([
      `${DEEPBOOK_PACKAGE}::balance_manager::deposit`,
      `${DEEPBOOK_PACKAGE}::pool::place_limit_order`,
    ]);
    const r = await checkActionShape(baseProposal({ actionType: "bm_deposit", txBytes }));
    expect(r.ok).toBe(false);
  });

  it("cancel_order accepts cancel_order + owner proof", async () => {
    const txBytes = await ptbWithCalls([
      `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_owner`,
      `${DEEPBOOK_PACKAGE}::pool::cancel_order`,
    ]);
    const r = await checkActionShape(baseProposal({ actionType: "cancel_order", txBytes }));
    expect(r.ok).toBe(true);
  });

  it("withdraw_settled accepts withdraw and withdraw_all, BLOCKS a smuggled order", async () => {
    const okPartial = await checkActionShape(
      baseProposal({ actionType: "withdraw_settled", txBytes: await ptbWithCalls([`${DEEPBOOK_PACKAGE}::balance_manager::withdraw`]) }),
    );
    expect(okPartial.ok).toBe(true);
    const okAll = await checkActionShape(
      baseProposal({ actionType: "withdraw_settled", txBytes: await ptbWithCalls([`${DEEPBOOK_PACKAGE}::balance_manager::withdraw_all`]) }),
    );
    expect(okAll.ok).toBe(true);
    const smuggled = await checkActionShape(
      baseProposal({ actionType: "withdraw_settled", txBytes: await ptbWithCalls([`${DEEPBOOK_PACKAGE}::pool::place_limit_order`]) }),
    );
    expect(smuggled.ok).toBe(false);
  });
});

describe("checkOrderLifecycleConstraints — cancel_order", () => {
  const client = {} as never;

  it("blocks a missing/invalid orderId", async () => {
    const r = await checkOrderLifecycleConstraints(
      baseProposal({ actionType: "cancel_order", poolKey: "DEEP_USDC", orderId: undefined }),
      client,
    );
    expect(r.errors.some((e) => e.gate === "ol_order_id")).toBe(true);
  });

  it("passes a valid orderId + whitelisted pool", async () => {
    const r = await checkOrderLifecycleConstraints(
      baseProposal({ actionType: "cancel_order", poolKey: "DEEP_USDC", orderId: ORDER_ID }),
      client,
    );
    expect(r.errors).toHaveLength(0);
  });
});

describe("checkOrderLifecycleConstraints — withdraw_settled", () => {
  const client = {} as never;

  it("blocks a recipient that is not the sender", async () => {
    mockReadSettled.mockResolvedValueOnce(100);
    const r = await checkOrderLifecycleConstraints(
      baseProposal({
        actionType: "withdraw_settled",
        coinTypeIn: COIN_TYPES.USDC,
        amountInNative: 5_000_000n, // 5 USDC
        recipientAddress: OTHER,
      }),
      client,
    );
    expect(r.errors.some((e) => e.gate === "ol_recipient")).toBe(true);
  });

  it("blocks an amount above the settled balance", async () => {
    mockReadSettled.mockResolvedValueOnce(10); // 10 USDC settled
    const r = await checkOrderLifecycleConstraints(
      baseProposal({
        actionType: "withdraw_settled",
        coinTypeIn: COIN_TYPES.USDC,
        amountInNative: 20_000_000n, // 20 USDC > 10 settled
      }),
      client,
    );
    expect(r.errors.some((e) => e.gate === "ol_withdraw_ceiling")).toBe(true);
  });

  it("BLOCKS fail-closed when the settled-balance read throws", async () => {
    mockReadSettled.mockRejectedValueOnce(new Error("rpc down"));
    const r = await checkOrderLifecycleConstraints(
      baseProposal({
        actionType: "withdraw_settled",
        coinTypeIn: COIN_TYPES.USDC,
        amountInNative: 1_000_000n,
      }),
      client,
    );
    expect(r.errors.some((e) => e.gate === "ol_settled_read")).toBe(true);
  });

  it("passes within settled balance and recipient = sender", async () => {
    mockReadSettled.mockResolvedValueOnce(10);
    const r = await checkOrderLifecycleConstraints(
      baseProposal({
        actionType: "withdraw_settled",
        coinTypeIn: COIN_TYPES.USDC,
        amountInNative: 5_000_000n, // 5 USDC <= 10
      }),
      client,
    );
    expect(r.errors).toHaveLength(0);
  });
});
