/**
 * Tests: source-aware min-out re-derive + the slippageBps=0 hole + aggregator gating.
 *
 * Proves:
 *  1. slippageBps=0 no longer bypasses the min-out gate (0 bps + tampered min-out BLOCKs).
 *  2. The min-out gate re-derives from the SAME source as the PTB (cetus quote for a
 *     cetus swap, aggregator quote for an aggregator swap — never crossed).
 *  3. An aggregator route through an ACTIVATED venue passes allowlist + shape; a route
 *     touching a non-activated DEX wrapper is refused at BOTH gates (fail-closed).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { COIN_TYPES, CETUS_AGGREGATOR_PACKAGE, CETUS_CLMM_PACKAGE } from "../allowlist";
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
  // Guardian fetches a live SUI/USD price for value-bounding; pin it to the $3 floor
  // here so these min-out/cap tests stay deterministic and unchanged.
  fetchSuiUsdPrice: vi.fn().mockResolvedValue(3),
}));

import { dryRunTransaction } from "@dewlock/sui";
import { fetchSwapQuote } from "@dewlock/sui/quotes-source";
import { fetchAggregatorQuote } from "@dewlock/sui/aggregator-quotes";
import { guardianCheck, checkActionShape, checkAllowlist } from "../guardian";
import type { TradeProposal } from "../guardian";

type QuoteFn = (a: string, b: string, c: bigint, d: number, e?: string) => Promise<SwapQuote>;
const mockCetus = fetchSwapQuote as unknown as import("vitest").Mock<QuoteFn>;
const mockAgg = fetchAggregatorQuote as unknown as import("vitest").Mock<QuoteFn>;
const mockDryRun = dryRunTransaction as unknown as import("vitest").Mock<
  (c: unknown, t: string) => Promise<DryRunResult>
>;

const WALLET = "0x" + "a".repeat(64);

async function realBytes(populate: (tx: Transaction) => void = () => {}): Promise<string> {
  const tx = new Transaction();
  tx.setSender(WALLET);
  tx.setGasBudget(50_000_000n);
  tx.setGasPrice(1000n);
  tx.setGasPayment([{ objectId: "0x" + "d".repeat(64), version: "1", digest: "1".repeat(32) }]);
  populate(tx);
  return Buffer.from(await tx.build()).toString("base64");
}

function quote(over: Partial<SwapQuote> = {}): SwapQuote {
  return {
    coinTypeIn: COIN_TYPES.SUI,
    coinTypeOut: COIN_TYPES.USDC,
    amountIn: 1_000_000_000n,
    estimatedAmountOut: 3_000_000n,
    minAmountOut: 3_000_000n,
    slippageFraction: 0,
    poolId: "p",
    source: "live",
    ...over,
  };
}

// SuiClient stub: only getCoinMetadata is used (by checkMinOut decimals cross-check).
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
    amountInNative: 1_000_000_000n,
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

describe("min-out gate — slippageBps=0 hole closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUI_USD_PRICE_FLOOR", "3.0");
    vi.stubEnv("TX_USD_CAP", "5");
    vi.stubEnv("DAILY_USD_CAP", "20");
    mockCetus.mockResolvedValue(quote());
    mockAgg.mockResolvedValue(quote({ estimatedAmountOut: 3_009_000n, minAmountOut: 2_993_955n }));
    mockDryRun.mockResolvedValue(dr([{ coinType: COIN_TYPES.SUI, amount: -1_000_000_000n, owner: WALLET }]));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("slippageBps=0 with a tampered (zero) min-out BLOCKs on min_out", async () => {
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, slippageBps: 0, minAmountOutNative: 0n, swapSource: "cetus" }),
      stubClient,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("min_out");
    expect(mockCetus).toHaveBeenCalled();
  });

  it("a faithful cetus swap passes the min-out gate", async () => {
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, slippageBps: 50, minAmountOutNative: 3_000_000n, swapSource: "cetus" }),
      stubClient,
    );
    expect(res.ok).toBe(true);
  });
});

describe("min-out gate — source-aware re-derive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUI_USD_PRICE_FLOOR", "3.0");
    vi.stubEnv("TX_USD_CAP", "5");
    vi.stubEnv("DAILY_USD_CAP", "20");
    mockCetus.mockResolvedValue(quote());
    mockAgg.mockResolvedValue(quote({ estimatedAmountOut: 3_009_000n, minAmountOut: 2_993_955n }));
    mockDryRun.mockResolvedValue(dr([{ coinType: COIN_TYPES.SUI, amount: -1_000_000_000n, owner: WALLET }]));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("aggregator swap re-derives from the aggregator quote (not the cetus quote)", async () => {
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, slippageBps: 50, minAmountOutNative: 2_993_955n, swapSource: "aggregator" }),
      stubClient,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.preview.swapSource).toBe("aggregator");
    expect(mockAgg).toHaveBeenCalled();
    expect(mockCetus).not.toHaveBeenCalled();
  });

  it("aggregator swap with a tampered min-out BLOCKs (re-derived from aggregator quote)", async () => {
    const txBytes = await realBytes();
    const res = await guardianCheck(
      swapProposal({ txBytes, slippageBps: 50, minAmountOutNative: 0n, swapSource: "aggregator" }),
      stubClient,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("min_out");
  });
});

describe("aggregator route gating — activated venues only", () => {
  it("an aggregator hop on an ACTIVATED venue passes allowlist + swap shape", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${CETUS_AGGREGATOR_PACKAGE}::cetus::swap`,
        typeArguments: [COIN_TYPES.SUI, COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    expect((await checkAllowlist(txBytes)).ok).toBe(true);
    expect((await checkActionShape(swapProposal({ txBytes, swapSource: "aggregator" }))).ok).toBe(true);
  });

  it("an aggregator hop on a NON-activated venue (turbos) is refused at allowlist AND shape", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${CETUS_AGGREGATOR_PACKAGE}::turbos::swap`,
        typeArguments: [COIN_TYPES.SUI, COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    const allow = await checkAllowlist(txBytes);
    const shape = await checkActionShape(swapProposal({ txBytes, swapSource: "aggregator" }));
    expect(allow.ok).toBe(false);
    expect(allow.reason).toContain("not on the protocol allowlist");
    expect(shape.ok).toBe(false);
    expect(shape.reason).toContain("shape mismatch");
  });

  it("a direct Cetus pool swap still passes both gates", async () => {
    const txBytes = await realBytes((tx) =>
      tx.moveCall({
        target: `${CETUS_CLMM_PACKAGE}::pool::swap`,
        typeArguments: [COIN_TYPES.SUI, COIN_TYPES.USDC],
        arguments: [],
      }),
    );
    expect((await checkAllowlist(txBytes)).ok).toBe(true);
    expect((await checkActionShape(swapProposal({ txBytes, swapSource: "cetus" }))).ok).toBe(true);
  });
});
