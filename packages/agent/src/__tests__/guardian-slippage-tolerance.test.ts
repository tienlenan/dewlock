/**
 * Tests the swap slippage-tolerance gate: a swap requesting a slippage tolerance wider than the
 * server ceiling (MAX_SLIPPAGE_BPS, default 10%) is BLOCKED — an over-wide tolerance drives
 * min-out near zero and invites sandwich/MEV loss. A tolerance at/under the ceiling passes the gate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { COIN_TYPES } from "../allowlist";
import type { SwapQuote } from "@dewlock/sui/quotes-source";
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
vi.mock("@dewlock/sui/quotes-source", () => ({ fetchSwapQuote: vi.fn() }));
vi.mock("@dewlock/sui/aggregator-quotes", () => ({
  fetchAggregatorQuote: vi.fn(),
  fetchSuiUsdPrice: vi.fn().mockResolvedValue(3), // SUI = $3 (deterministic)
}));
vi.mock("../allowlist", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  const types = actual.COIN_TYPES as Record<string, string>;
  return {
    ...actual,
    getTrustedUsdPrice: vi.fn((ct: string) => (ct === types.USDC ? 1 : undefined)),
  };
});

import { dryRunTransaction } from "@dewlock/sui";
import { fetchSwapQuote } from "@dewlock/sui/quotes-source";
import { guardianCheck } from "../guardian";
import type { TradeProposal } from "../guardian";

type QuoteFn = (a: string, b: string, c: bigint, d: number, e?: string) => Promise<SwapQuote>;
const mockCetus = fetchSwapQuote as unknown as import("vitest").Mock<QuoteFn>;
const mockDryRun = dryRunTransaction as unknown as import("vitest").Mock<
  (c: unknown, t: string) => Promise<DryRunResult>
>;

const WALLET = "0x" + "a".repeat(64);

async function realBytes(): Promise<string> {
  const tx = new Transaction();
  tx.setSender(WALLET);
  tx.setGasBudget(50_000_000n);
  tx.setGasPrice(1000n);
  tx.setGasPayment([{ objectId: "0x" + "d".repeat(64), version: "1", digest: "1".repeat(32) }]);
  return Buffer.from(await tx.build()).toString("base64");
}

const stubClient = {
  getCoinMetadata: vi.fn(async ({ coinType }: { coinType: string }) => ({
    decimals: coinType === COIN_TYPES.USDC ? 6 : 9,
  })),
} as unknown as Parameters<typeof guardianCheck>[1];

function swapProposal(over: Partial<TradeProposal>): TradeProposal {
  return {
    txBytes: "",
    walletAddress: WALLET,
    actionLabel: "swap",
    actionType: "swap",
    coinTypeIn: COIN_TYPES.SUI,
    coinTypeOut: COIN_TYPES.USDC,
    amountInNative: 1_000_000_000n, // 1 SUI = $3
    slippageBps: 50,
    argProvenance: { amount: "user_turn", coinType: "user_turn" },
    dailyUsdSpentSoFar: 0,
    ...over,
  };
}

const dr = (deltas: DryRunResult["balanceDeltas"]): DryRunResult => ({
  effects: {} as DryRunResult["effects"],
  balanceDeltas: deltas,
  gasCostMist: 0n,
});

describe("guardian — swap slippage-tolerance gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUI_USD_PRICE_FLOOR", "3.0");
    vi.stubEnv("TX_USD_CAP", "50");
    vi.stubEnv("DAILY_USD_CAP", "200");
    // A consistent fresh quote so the min-out gate never blocks on its own.
    mockCetus.mockResolvedValue({
      coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountIn: 1_000_000_000n,
      estimatedAmountOut: 3_000_000n, minAmountOut: 2_985_000n, slippageFraction: 0.005, poolId: "p", source: "live",
    });
    mockDryRun.mockResolvedValue(dr([
      { coinType: COIN_TYPES.SUI, amount: -1_000_000_000n, owner: WALLET },
      { coinType: COIN_TYPES.USDC, amount: 2_985_000n, owner: WALLET },
    ]));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("BLOCKs a swap whose slippage tolerance exceeds the 10% default ceiling", async () => {
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, slippageBps: 3000, swapSource: "cetus" }), // 30% tolerance
      stubClient,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.gates).toContain("slippage_tolerance");
      expect(res.reasons.join(" ")).toMatch(/Slippage tolerance/i);
    }
  });

  it("honors a server-configured MAX_SLIPPAGE_BPS override (2% ceiling blocks a 5% tolerance)", async () => {
    vi.stubEnv("MAX_SLIPPAGE_BPS", "200");
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, slippageBps: 500, swapSource: "cetus" }),
      stubClient,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("slippage_tolerance");
  });

  it("does NOT add the slippage gate for a tolerance at/under the ceiling", async () => {
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, slippageBps: 1000, minAmountOutNative: 2_985_000n, swapSource: "cetus" }), // 10% == ceiling
      stubClient,
    );
    if (!res.ok) expect(res.gates).not.toContain("slippage_tolerance");
  });
});
