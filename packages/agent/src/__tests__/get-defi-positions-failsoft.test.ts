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
  getPoolTiedBalances: vi.fn(),
  WHITELISTED_POOL_KEYS: ["DEEP_USDC", "SUI_USDC", "DEEP_SUI"],
}));
vi.mock("@dewlock/sui/lending-positions", () => ({
  readNaviLending: vi.fn(),
}));

import { getExistingBalanceManagers } from "@dewlock/sui/balance-manager";
import { getOpenOrders, getSettledBalances, getPoolTiedBalances } from "@dewlock/sui/account-orders";
import { readNaviLending } from "@dewlock/sui/lending-positions";
import { getDefiPositions } from "../tools/get-defi-positions";

const WALLET = "0x" + "a".repeat(64);
const BM_ID = "0x" + "b".repeat(64);

const mResolve = getExistingBalanceManagers as unknown as import("vitest").Mock;
const mOrders = getOpenOrders as unknown as import("vitest").Mock;
const mSettled = getSettledBalances as unknown as import("vitest").Mock;
const mPoolTied = getPoolTiedBalances as unknown as import("vitest").Mock;
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
    mPoolTied.mockResolvedValue([{ coinType: "USDC", coinKey: "USDC", locked: 28, settled: 0 }]);
    mNavi.mockResolvedValue({ supplied: [{ coinType: "SUI", symbol: "SUI", amount: 1, valueUsd: 3 }], healthFactor: 2 });
  });
  afterEach(() => vi.unstubAllEnvs());

  type Positions = {
    deepbook: { balanceManagers: Array<{ balanceManagerId: string; openOrders: unknown[]; settledBalances: unknown[]; poolTied: unknown[] }> };
    lending: { navi: { supplied: unknown[]; healthFactor: number | null }; suilend: { supplied: null; manageUrl: string } };
    demoFixture: boolean;
  };

  it("returns one entry per BM with its orders + balances + pool-tied funds", async () => {
    const r = (await run()) as unknown as Positions;
    expect(r.deepbook.balanceManagers).toHaveLength(1);
    expect(r.deepbook.balanceManagers[0].balanceManagerId).toBe(BM_ID);
    expect(r.deepbook.balanceManagers[0].openOrders).toHaveLength(1);
    expect(r.deepbook.balanceManagers[0].settledBalances).toHaveLength(1);
    expect(r.deepbook.balanceManagers[0].poolTied).toHaveLength(1); // locked-in-pool funds surfaced
    expect(r.lending.navi.supplied).toHaveLength(1);
    expect(r.lending.suilend.supplied).toBeNull();
    expect(r.lending.suilend.manageUrl).toContain("suilend");
  });

  it("degrades only the pool-tied funds of a BM when its read rejects", async () => {
    mPoolTied.mockRejectedValueOnce(new Error("devInspect throttled"));
    const r = (await run()) as unknown as Positions;
    expect(r.deepbook.balanceManagers[0].poolTied).toEqual([]); // degraded
    expect(r.deepbook.balanceManagers[0].openOrders).toHaveLength(1); // intact
    expect(r.deepbook.balanceManagers[0].settledBalances).toHaveLength(1); // intact
  });

  it("degrades only the open-orders of a BM when its read rejects", async () => {
    mOrders.mockRejectedValueOnce(new Error("devInspect throttled"));
    const r = (await run()) as unknown as Positions;
    expect(r.deepbook.balanceManagers[0].openOrders).toEqual([]); // degraded
    expect(r.deepbook.balanceManagers[0].settledBalances).toHaveLength(1); // intact
    expect(r.lending.navi.supplied).toHaveLength(1); // intact
  });

  it("degrades only the NAVI section when its read rejects", async () => {
    mNavi.mockRejectedValueOnce(new Error("navi down"));
    const r = (await run()) as unknown as Positions;
    expect(r.lending.navi).toEqual({ supplied: [], healthFactor: null }); // degraded
    expect(r.deepbook.balanceManagers[0].openOrders).toHaveLength(1); // intact
  });

  it("lists every BM the wallet owns (multi-account)", async () => {
    const BM2 = "0x" + "c".repeat(64);
    mResolve.mockResolvedValueOnce({ status: "ok", ids: [BM_ID, BM2] });
    const r = (await run()) as unknown as Positions;
    expect(r.deepbook.balanceManagers.map((b) => b.balanceManagerId)).toEqual([BM_ID, BM2]);
  });

  it("never throws and returns no BMs when none are resolved", async () => {
    mResolve.mockResolvedValueOnce({ status: "ok", ids: [] });
    const r = (await run()) as unknown as Positions;
    expect(r.deepbook.balanceManagers).toEqual([]);
  });

  it("fixture mode returns deterministic canned positions", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
    const r = (await run()) as unknown as Positions;
    expect(r.demoFixture).toBe(true);
    expect(r.deepbook.balanceManagers[0].openOrders.length).toBeGreaterThan(0);
  });
});
