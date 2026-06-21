/**
 * Tests: getDefiPositions fail-soft contract.
 *
 * Every source read is independent: one rejecting source degrades ONLY its section
 * (to [] / null), never throws, and never blanks the others. Fixture mode returns
 * deterministic canned positions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@dewlock/sui", () => ({ getSuiMainnetClient: () => ({}) }));
vi.mock("@dewlock/sui/balance-manager", () => ({
  getExistingBalanceManagers: vi.fn(),
}));
vi.mock("@dewlock/sui/account-orders", () => ({
  getOpenOrders: vi.fn(),
  getSettledBalances: vi.fn(),
  WHITELISTED_POOL_KEYS: ["DEEP_USDC", "SUI_USDC", "DEEP_SUI"],
}));
vi.mock("@dewlock/sui/lending-positions", () => ({
  readNaviLending: vi.fn(),
}));

import { getExistingBalanceManagers } from "@dewlock/sui/balance-manager";
import { getOpenOrders, getSettledBalances } from "@dewlock/sui/account-orders";
import { readNaviLending } from "@dewlock/sui/lending-positions";
import { getDefiPositions } from "../tools/get-defi-positions";

const WALLET = "0x" + "a".repeat(64);
const BM_ID = "0x" + "b".repeat(64);

const mResolve = getExistingBalanceManagers as unknown as import("vitest").Mock;
const mOrders = getOpenOrders as unknown as import("vitest").Mock;
const mSettled = getSettledBalances as unknown as import("vitest").Mock;
const mNavi = readNaviLending as unknown as import("vitest").Mock;

function run(): Promise<unknown> {
  return (getDefiPositions as unknown as { execute: (i: unknown) => Promise<unknown> }).execute({
    walletAddress: WALLET,
  });
}

describe("getDefiPositions — fail-soft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mResolve.mockResolvedValue({ status: "ok", ids: [BM_ID] });
    mOrders.mockResolvedValue([
      { orderId: "0x1", poolKey: "SUI_USDC", side: "BUY", price: 2.8, quantity: 10, filledPct: 0, expireTimestampMs: 9e14 },
    ]);
    mSettled.mockResolvedValue([{ coinType: "USDC", coinKey: "USDC", balance: 5 }]);
    mNavi.mockResolvedValue({ supplied: [{ coinType: "SUI", symbol: "SUI", amount: 1, valueUsd: 3 }], healthFactor: 2 });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns all sections when every read succeeds", async () => {
    const r = (await run()) as unknown as {
      deepbook: { balanceManagerId: string; openOrders: unknown[]; settledBalances: unknown[] };
      lending: { navi: { supplied: unknown[]; healthFactor: number | null }; suilend: { supplied: null; manageUrl: string } };
    };
    expect(r.deepbook.balanceManagerId).toBe(BM_ID);
    expect(r.deepbook.openOrders).toHaveLength(1);
    expect(r.deepbook.settledBalances).toHaveLength(1);
    expect(r.lending.navi.supplied).toHaveLength(1);
    expect(r.lending.suilend.supplied).toBeNull();
    expect(r.lending.suilend.manageUrl).toContain("suilend");
  });

  it("degrades only the open-orders section when its read rejects", async () => {
    mOrders.mockRejectedValueOnce(new Error("devInspect throttled"));
    const r = (await run()) as { deepbook: { openOrders: unknown[]; settledBalances: unknown[] }; lending: { navi: { supplied: unknown[] } } };
    expect(r.deepbook.openOrders).toEqual([]); // degraded
    expect(r.deepbook.settledBalances).toHaveLength(1); // intact
    expect(r.lending.navi.supplied).toHaveLength(1); // intact
  });

  it("degrades only the NAVI section when its read rejects", async () => {
    mNavi.mockRejectedValueOnce(new Error("navi down"));
    const r = (await run()) as { deepbook: { openOrders: unknown[] }; lending: { navi: { supplied: unknown[]; healthFactor: number | null } } };
    expect(r.lending.navi).toEqual({ supplied: [], healthFactor: null }); // degraded
    expect(r.deepbook.openOrders).toHaveLength(1); // intact
  });

  it("never throws and omits the DeepBook section when no BM is resolved", async () => {
    mResolve.mockResolvedValueOnce({ status: "ok", ids: [] });
    const r = (await run()) as { deepbook: { balanceManagerId: string | null; openOrders: unknown[] } };
    expect(r.deepbook.balanceManagerId).toBeNull();
    expect(r.deepbook.openOrders).toEqual([]);
  });

  it("fixture mode returns deterministic canned positions", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
    const r = (await run()) as { demoFixture: boolean; deepbook: { openOrders: unknown[] } };
    expect(r.demoFixture).toBe(true);
    expect(r.deepbook.openOrders.length).toBeGreaterThan(0);
  });
});
