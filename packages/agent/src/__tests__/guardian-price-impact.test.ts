/**
 * Tests the swap price-impact gate: a swap whose output is worth materially less than its input
 * (thin-liquidity / bad-rate route) is BLOCKED, even when the PTB min-out matches the fresh quote
 * (both agree on the bad rate — only an absolute USD-value comparison catches it). A normal-rate
 * swap passes. Threshold defaults to 5% and is overridable per proposal.
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
// Price the non-SUI side deterministically (USDC = $1) so the impact math is stable. SUI is
// priced via liveSuiUsd (above), so getTrustedUsdPrice is only consulted for USDC here.
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

describe("guardian — swap price-impact gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUI_USD_PRICE_FLOOR", "3.0");
    vi.stubEnv("TX_USD_CAP", "50");
    vi.stubEnv("DAILY_USD_CAP", "200");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("BLOCKs a bad-rate swap (0.7 USDC out for 1 SUI in) even when min-out is consistent", async () => {
    // The fresh quote agrees on the bad rate, so the min-out consistency gate passes — only the
    // absolute USD-value gate catches the ~77% value loss.
    mockCetus.mockResolvedValue({
      coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountIn: 1_000_000_000n,
      estimatedAmountOut: 700_000n, minAmountOut: 700_000n, slippageFraction: 0, poolId: "p", source: "live",
    });
    mockDryRun.mockResolvedValue(dr([
      { coinType: COIN_TYPES.SUI, amount: -1_000_000_000n, owner: WALLET },
      { coinType: COIN_TYPES.USDC, amount: 700_000n, owner: WALLET },
    ]));
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, minAmountOutNative: 700_000n, swapSource: "cetus" }),
      stubClient,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.gates).toContain("low_liquidity");
      expect(res.reasons.join(" ")).toMatch(/Low liquidity/i);
    }
  });

  it("passes a normal-rate swap (2.97 USDC out for 1 SUI in, ~1% loss)", async () => {
    mockCetus.mockResolvedValue({
      coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountIn: 1_000_000_000n,
      estimatedAmountOut: 2_970_000n, minAmountOut: 2_970_000n, slippageFraction: 0, poolId: "p", source: "live",
    });
    mockDryRun.mockResolvedValue(dr([
      { coinType: COIN_TYPES.SUI, amount: -1_000_000_000n, owner: WALLET },
      { coinType: COIN_TYPES.USDC, amount: 2_970_000n, owner: WALLET },
    ]));
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, minAmountOutNative: 2_970_000n, swapSource: "cetus" }),
      stubClient,
    );
    expect(res.ok).toBe(true);
  });

  it("a stricter per-proposal threshold (1%) BLOCKs a 3% loss the 5% default would allow", async () => {
    mockCetus.mockResolvedValue({
      coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountIn: 1_000_000_000n,
      estimatedAmountOut: 2_910_000n, minAmountOut: 2_910_000n, slippageFraction: 0, poolId: "p", source: "live",
    });
    mockDryRun.mockResolvedValue(dr([
      { coinType: COIN_TYPES.SUI, amount: -1_000_000_000n, owner: WALLET },
      { coinType: COIN_TYPES.USDC, amount: 2_910_000n, owner: WALLET }, // $2.91 → 3% loss
    ]));
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, minAmountOutNative: 2_910_000n, swapSource: "cetus", maxPriceImpactBps: 100 }),
      stubClient,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("low_liquidity");
  });
});
