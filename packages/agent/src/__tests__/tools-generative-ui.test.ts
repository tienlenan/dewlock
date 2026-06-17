/**
 * Tests: read-only generative-UI tools (listProtocols, getSwapOptions, getReceiveInfo).
 *
 * These tools render cards; they must NOT build or sign (the value path stays in
 * prepareTrade). getSwapOptions surfaces both sources + the best so the user can
 * pick a venue; the chosen source is later re-derived by the Guardian.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SwapQuote } from "@dewlock/sui/quotes-source";

vi.mock("@dewlock/sui/quotes-source", () => ({ fetchSwapQuote: vi.fn() }));
vi.mock("@dewlock/sui/aggregator-quotes", () => ({ fetchAggregatorQuote: vi.fn() }));

import { fetchSwapQuote } from "@dewlock/sui/quotes-source";
import { fetchAggregatorQuote } from "@dewlock/sui/aggregator-quotes";
import { listProtocols } from "../tools/list-protocols";
import { getSwapOptions } from "../tools/get-swap-options";
import { getReceiveInfo } from "../tools/get-receive-info";
import { getUserStats } from "../tools/get-user-stats";
import { getProtocolMetrics } from "../tools/get-protocol-metrics";
import { COIN_TYPES } from "../allowlist";

// Mastra tools are invoked as tool.execute(inputObject) (see prepare-trade route).
const run = (t: unknown, input: unknown) =>
  (t as { execute: (i: unknown) => Promise<Record<string, unknown>> }).execute(input);

const mockCetus = fetchSwapQuote as unknown as import("vitest").Mock<
  (a: string, b: string, c: bigint, d: number) => Promise<SwapQuote>
>;
const mockAgg = fetchAggregatorQuote as unknown as import("vitest").Mock<
  (a: string, b: string, c: bigint, d: number) => Promise<SwapQuote>
>;

function quote(over: Partial<SwapQuote> = {}): SwapQuote {
  return {
    coinTypeIn: COIN_TYPES.SUI,
    coinTypeOut: COIN_TYPES.USDC,
    amountIn: 1_000_000_000n,
    estimatedAmountOut: 3_000_000n,
    minAmountOut: 2_985_000n,
    slippageFraction: 0.005,
    poolId: "p",
    source: "live",
    ...over,
  };
}

describe("listProtocols", () => {
  it("returns the registry posture: active includes Cetus (built), excluded includes Nemo (hacked)", async () => {
    const r = await run(listProtocols, {});
    const active = r.active as Array<{ id: string; buildState: string; status: string }>;
    const excluded = r.excluded as Array<{ id: string; status: string }>;
    expect(active.find((p) => p.id === "cetus")?.buildState).toBe("built");
    expect(excluded.find((p) => p.id === "nemo")?.status).toBe("hacked");
  });
});

describe("getReceiveInfo", () => {
  it("returns the public address + QR payload and NO key material", async () => {
    const wallet = "0x" + "a".repeat(64);
    const r = await run(getReceiveInfo, { walletAddress: wallet });
    expect(r.address).toBe(wallet);
    expect(r.qrData).toBe(wallet);
    expect(r.network).toBe("mainnet");
    // Never leaks anything key-like.
    expect(JSON.stringify(r)).not.toMatch(/private|secret|seed|mnemonic|priv/i);
  });
});

describe("getSwapOptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns both sources + picks the higher-output as best", async () => {
    mockCetus.mockResolvedValue(quote({ estimatedAmountOut: 3_000_000n }));
    mockAgg.mockResolvedValue(quote({ estimatedAmountOut: 3_009_000n, routeProviders: ["CETUS", "DEEPBOOK"] }));
    const r = await run(getSwapOptions, {
      coinTypeIn: COIN_TYPES.SUI,
      coinTypeOut: COIN_TYPES.USDC,
      amountInNative: "1000000000",
      slippageBps: 50,
    });
    expect(r.best).toBe("aggregator");
    const options = r.options as Array<{ source: string; available: boolean }>;
    expect(options.map((o) => o.source).sort()).toEqual(["aggregator", "cetus"]);
    expect(options.every((o) => o.available)).toBe(true);
  });

  it("marks a failing source unavailable and still returns the working one as best", async () => {
    mockCetus.mockResolvedValue(quote({ estimatedAmountOut: 3_000_000n }));
    mockAgg.mockRejectedValue(new Error("aggregator route unavailable"));
    const r = await run(getSwapOptions, {
      coinTypeIn: COIN_TYPES.SUI,
      coinTypeOut: COIN_TYPES.USDC,
      amountInNative: "1000000000",
      slippageBps: 50,
    });
    expect(r.best).toBe("cetus");
    const options = r.options as Array<{ source: string; available: boolean; error?: string }>;
    expect(options.find((o) => o.source === "aggregator")?.available).toBe(false);
  });
});

describe("getUserStats", () => {
  const ADDR = "0x" + "1".repeat(64);

  it("returns the honest empty (newbie) state with no receipts", async () => {
    const r = await run(getUserStats, { walletAddress: ADDR });
    const stats = r.stats as { txCount: number };
    const badges = r.badges as { earned: unknown[]; locked: unknown[] };
    expect(stats.txCount).toBe(0);
    expect(badges.earned).toEqual([]);
    expect(badges.locked.length).toBeGreaterThan(0);
  });

  it("derives stats + earns badges from passed receipt lines (no memwal needed)", async () => {
    const r = await run(getUserStats, {
      walletAddress: ADDR,
      receiptLines: ["action log: 2026-01-01T00:00:00.000Z | Swap SUI for USDC | tx:0x1 | usd:$4.00 | blob:pending"],
    });
    const stats = r.stats as { txCount: number; actions: { swap: number } };
    const earned = (r.badges as { earned: Array<{ id: string }> }).earned.map((b) => b.id);
    expect(stats.txCount).toBe(1);
    expect(stats.actions.swap).toBe(1);
    expect(earned).toContain("newbie");
    expect(earned).toContain("first-swap");
  });
});

describe("getProtocolMetrics", () => {
  it("returns real registry counts (no network) keyed to active/excluded protocols", async () => {
    const r = await run(getProtocolMetrics, {});
    expect(r.supportedProtocols as number).toBeGreaterThan(5);
    expect(r.enforcedProtocols as number).toBeGreaterThan(0);
    expect(r.excludedProtocols as number).toBeGreaterThan(0);
    const rows = r.perProtocol as Array<{ id: string; status: string }>;
    expect(rows.some((p) => p.id === "cetus")).toBe(true);
    expect(rows.some((p) => p.status === "hacked")).toBe(true);
  });
});
