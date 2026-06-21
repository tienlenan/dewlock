/**
 * Tests: DeepBook cancel-order + withdraw-settled builders (order-management.ts).
 *
 * Headless — the DeepBook SDK dynamic import is mocked. The mock mirrors the REAL
 * @mysten/deepbook-v3@1.4.1 method surface (deepBook.cancelOrder,
 * balanceManager.withdrawFromManager/withdrawAllFromManager) so a method-name drift
 * would surface here, not silently at runtime.
 *
 * Coverage:
 *   - cancel: invalid orderId → OrderManagementBuildError; valid → cancelOrder(pool, KEY, id)
 *   - withdraw partial: positive amount → withdrawFromManager(KEY, coin, amount, SENDER)
 *   - withdraw all: omitted amount → withdrawAllFromManager(KEY, coin, SENDER)
 *   - withdraw recipient is ALWAYS the sender (no third-party outflow), amount<=0 throws
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildCancelOrder,
  buildWithdrawSettled,
  buildClaimSettled,
  OrderManagementBuildError,
} from "../deepbook/order-management";

const BM_KEY = "DEWLOCK";

// vi.hoisted gives stable mock references shared between the factory and the assertions.
const m = vi.hoisted(() => ({
  cancelOrder: vi.fn(() => () => {}),
  withdrawFromManager: vi.fn(() => () => {}),
  withdrawAllFromManager: vi.fn(() => () => {}),
  withdrawSettledAmounts: vi.fn(() => () => {}),
}));

// DeepBookClient must be a real class — createDeepBookClient calls `new DeepBookClient()`
// on the live path, and an arrow-fn vi.fn() is not constructable.
vi.mock("@mysten/deepbook-v3", () => ({
  DeepBookClient: class {
    deepBook = { cancelOrder: m.cancelOrder, withdrawSettledAmounts: m.withdrawSettledAmounts };
    balanceManager = {
      withdrawFromManager: m.withdrawFromManager,
      withdrawAllFromManager: m.withdrawAllFromManager,
    };
  },
  OrderType: { POST_ONLY: 3 },
  SelfMatchingOptions: { CANCEL_TAKER: 1 },
  MAX_TIMESTAMP: Number.MAX_SAFE_INTEGER,
}));

function makeMockSuiClient() {
  return { getBalance: vi.fn(), getCoinMetadata: vi.fn(), core: {} };
}

const SENDER = "0x" + "a".repeat(64);
const BM_ID = "0x" + "b".repeat(64);
const ORDER_ID = "0x" + "f".repeat(20);

beforeEach(() => {
  m.cancelOrder.mockClear();
  m.withdrawFromManager.mockClear();
  m.withdrawAllFromManager.mockClear();
  m.withdrawSettledAmounts.mockClear();
});

describe("buildCancelOrder", () => {
  it("throws OrderManagementBuildError for an invalid orderId", async () => {
    await expect(
      buildCancelOrder(makeMockSuiClient() as never, {
        senderAddress: SENDER,
        poolKey: "DEEP_USDC",
        balanceManagerId: BM_ID,
        orderId: "not-hex",
      }),
    ).rejects.toThrow(OrderManagementBuildError);
    expect(m.cancelOrder).not.toHaveBeenCalled();
  });

  it("calls deepBook.cancelOrder(poolKey, DEWLOCK, orderId) for a valid order", async () => {
    // tx.build may throw without a real client — the SDK call happens first (asserted).
    await buildCancelOrder(makeMockSuiClient() as never, {
      senderAddress: SENDER,
      poolKey: "DEEP_USDC",
      balanceManagerId: BM_ID,
      orderId: ORDER_ID,
    }).catch(() => {});
    expect(m.cancelOrder).toHaveBeenCalledWith("DEEP_USDC", BM_KEY, ORDER_ID);
  });
});

describe("buildWithdrawSettled", () => {
  it("throws for a non-positive amount", async () => {
    await expect(
      buildWithdrawSettled(makeMockSuiClient() as never, {
        senderAddress: SENDER,
        balanceManagerId: BM_ID,
        coinKey: "USDC",
        humanAmount: 0,
      }),
    ).rejects.toThrow(OrderManagementBuildError);
  });

  it("partial withdraw pins the recipient to the SENDER", async () => {
    await buildWithdrawSettled(makeMockSuiClient() as never, {
      senderAddress: SENDER,
      balanceManagerId: BM_ID,
      coinKey: "USDC",
      humanAmount: 12.5,
    }).catch(() => {});
    // recipient (4th arg) must equal the sender — never a third party.
    expect(m.withdrawFromManager).toHaveBeenCalledWith(BM_KEY, "USDC", 12.5, SENDER);
  });

  it("withdraw-all (omitted amount) uses withdrawAllFromManager with recipient=SENDER", async () => {
    await buildWithdrawSettled(makeMockSuiClient() as never, {
      senderAddress: SENDER,
      balanceManagerId: BM_ID,
      coinKey: "DEEP",
    }).catch(() => {});
    expect(m.withdrawAllFromManager).toHaveBeenCalledWith(BM_KEY, "DEEP", SENDER);
  });
});

describe("buildClaimSettled", () => {
  it("throws when no pools are provided (nothing to claim)", async () => {
    await expect(
      buildClaimSettled(makeMockSuiClient() as never, {
        senderAddress: SENDER,
        balanceManagerId: BM_ID,
        poolKeys: [],
      }),
    ).rejects.toThrow(OrderManagementBuildError);
    expect(m.withdrawSettledAmounts).not.toHaveBeenCalled();
  });

  it("emits withdrawSettledAmounts(poolKey, DEWLOCK) once per pool with a settled balance", async () => {
    await buildClaimSettled(makeMockSuiClient() as never, {
      senderAddress: SENDER,
      balanceManagerId: BM_ID,
      poolKeys: ["SUI_USDC", "DEEP_USDC"],
    }).catch(() => {});
    expect(m.withdrawSettledAmounts).toHaveBeenCalledTimes(2);
    expect(m.withdrawSettledAmounts).toHaveBeenCalledWith("SUI_USDC", BM_KEY);
    expect(m.withdrawSettledAmounts).toHaveBeenCalledWith("DEEP_USDC", BM_KEY);
  });
});
