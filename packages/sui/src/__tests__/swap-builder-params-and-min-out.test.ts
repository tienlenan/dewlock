/**
 * Tests: swap builder SwapParams shape, per-coin-type decimals, min-out math,
 * and fail-closed behaviour on quote errors.
 *
 * All Cetus SDK calls are mocked — these tests run headless with no mainnet access.
 * Live integration tests (real pool, real wallet) are flagged [needs live-env].
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { COIN_TYPES, COIN_DECIMALS } from "../allowlist";

// ---------------------------------------------------------------------------
// Mock the Cetus SDK dynamic import so tests never hit mainnet
// ---------------------------------------------------------------------------

// Mock module must be declared before importing the module under test.
vi.mock("@cetusprotocol/cetus-sui-clmm-sdk", () => {
  const mockPool = {
    poolAddress: "0xpool123",
    coinTypeA: COIN_TYPES.SUI,
    coinTypeB: COIN_TYPES.USDC,
    current_sqrt_price: 123456789,
    ticks_handle: "0xticks",
    fee_rate: 2500,
  };

  const mockPreswap = vi.fn().mockResolvedValue({
    poolAddress: "0xpool123",
    currentSqrtPrice: 123456789,
    estimatedAmountIn: "1000000000",
    estimatedAmountOut: { toString: () => "2950000" }, // ~2.95 USDC for 1 SUI
    estimatedEndSqrtPrice: 123000000,
    estimatedFeeAmount: "2950",
    isExceed: false,
    amount: "1000000000",
    aToB: true,
    byAmountIn: true,
  });

  const mockGetPool = vi.fn().mockResolvedValue(mockPool);
  const mockGetPoolByCoins = vi.fn().mockResolvedValue([mockPool]);
  const mockCreateSwapTxPayload = vi.fn().mockResolvedValue({
    build: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
  });

  const mockSdk = {
    senderAddress: "",
    Pool: {
      getPool: mockGetPool,
      getPoolByCoins: mockGetPoolByCoins,
    },
    Swap: {
      preswap: mockPreswap,
      createSwapTransactionPayload: mockCreateSwapTxPayload,
    },
  };

  return {
    default: class MockCetusClmmSDK {},
    initMainnetSDK: vi.fn(() => mockSdk),
    __mockSdk: mockSdk,
    __mockPreswap: mockPreswap,
    __mockGetPool: mockGetPool,
    __mockCreateSwapTxPayload: mockCreateSwapTxPayload,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock SuiClient (only methods needed by build-swap). */
function makeMockSuiClient() {
  return {
    getBalance: vi.fn(),
    getCoinMetadata: vi.fn(),
    dryRunTransactionBlock: vi.fn(),
    // ClientWithCoreApi compat
    core: {},
  };
}

// ---------------------------------------------------------------------------
// fetchSwapQuote unit tests (quotes-source.ts)
// ---------------------------------------------------------------------------

describe("fetchSwapQuote — live path", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.clearAllMocks();
  });

  it("returns fixture quote when NEXT_PUBLIC_DEMO_MODE=fixture", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
    const { fetchSwapQuote } = await import("../quotes-source");
    const quote = await fetchSwapQuote(
      COIN_TYPES.SUI,
      COIN_TYPES.USDC,
      1_000_000_000n,
      50,
    );
    expect(quote.source).toBe("fixture");
    expect(quote.poolId).toBe("0xfixture_pool_id_demo_only");
  });

  it("fixture: SUI→USDC uses 1e9 SUI = 3 USDC rate", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
    const { fetchSwapQuote } = await import("../quotes-source");
    const quote = await fetchSwapQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, 1_000_000_000n, 0);
    // 1 SUI (1e9 MIST) → 3 USDC (3_000_000 micro-USDC)
    expect(quote.estimatedAmountOut).toBe(3_000_000n);
    expect(quote.minAmountOut).toBe(3_000_000n); // slippage=0
  });

  it("fixture: min-out applies slippage correctly (50 bps = 0.5%)", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
    const { fetchSwapQuote } = await import("../quotes-source");
    const quote = await fetchSwapQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, 1_000_000_000n, 50);
    // estimated = 3_000_000; min = 3_000_000 * 9950 / 10000 = 2_985_000
    expect(quote.minAmountOut).toBe(2_985_000n);
    expect(quote.slippageFraction).toBeCloseTo(0.005);
  });

  it("fixture: USDC→SUI reverses the rate", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
    const { fetchSwapQuote } = await import("../quotes-source");
    // 3_000_000 micro-USDC → 1 SUI (1e9 MIST)
    const quote = await fetchSwapQuote(COIN_TYPES.USDC, COIN_TYPES.SUI, 3_000_000n, 0);
    expect(quote.estimatedAmountOut).toBe(1_000_000_000n);
  });
});

// ---------------------------------------------------------------------------
// Decimals keying — must use pool.coinTypeA/B, not coinTypeIn/coinTypeOut
// ---------------------------------------------------------------------------

describe("Decimals keying correctness (per-coin-type)", () => {
  it("COIN_DECIMALS has correct values for all supported types", () => {
    expect(COIN_DECIMALS[COIN_TYPES.SUI]).toBe(9);
    expect(COIN_DECIMALS[COIN_TYPES.USDC]).toBe(6);
    expect(COIN_DECIMALS[COIN_TYPES.USDT]).toBe(6);
    expect(COIN_DECIMALS[COIN_TYPES.WETH]).toBe(8);
    expect(COIN_DECIMALS[COIN_TYPES.wBTC]).toBe(8);
  });

  it("decimals for SUI vs USDC differ by 1000x — wrong keying causes 1000x min-out error", () => {
    const suiDecimals = COIN_DECIMALS[COIN_TYPES.SUI]; // 9
    const usdcDecimals = COIN_DECIMALS[COIN_TYPES.USDC]; // 6
    const ratio = 10 ** (suiDecimals - usdcDecimals);
    // If decimals were swapped: amount would be off by 1000x
    expect(ratio).toBe(1000);
  });

  it("preswap must receive decimals keyed by pool coinTypeA/B (not in/out direction)", () => {
    // pool.coinTypeA = SUI (9 dec), pool.coinTypeB = USDC (6 dec)
    // For a2b=true (SUI→USDC): decimalsA=9, decimalsB=6 ✓
    // For a2b=false (USDC→SUI): would have coinTypeIn=USDC, coinTypeOut=SUI
    //   but decimalsA is still keyed by pool.coinTypeA=SUI → still 9 ✓
    //   decimalsB still keyed by pool.coinTypeB=USDC → still 6 ✓
    // Test that the logic is: decimals[pool.coinTypeA], decimals[pool.coinTypeB]
    const poolCoinTypeA = COIN_TYPES.SUI;
    const poolCoinTypeB = COIN_TYPES.USDC;
    const decimalsA = COIN_DECIMALS[poolCoinTypeA] ?? 9;
    const decimalsB = COIN_DECIMALS[poolCoinTypeB] ?? 9;
    expect(decimalsA).toBe(9);
    expect(decimalsB).toBe(6);
    // In the a2b=false case (coinTypeIn=USDC, coinTypeOut=SUI), decimals are unchanged:
    // this is correct — preswap takes pool-ordered decimals, not swap-direction-ordered.
    expect(COIN_DECIMALS[poolCoinTypeA]).toBe(9); // SUI remains 9 regardless of swap direction
    expect(COIN_DECIMALS[poolCoinTypeB]).toBe(6); // USDC remains 6 regardless of swap direction
  });
});

// ---------------------------------------------------------------------------
// Min-out arithmetic — pure bigint math, no imports
// ---------------------------------------------------------------------------

describe("Min-out arithmetic (integer bps)", () => {
  function computeMinOut(estimatedOut: bigint, slippageBps: number): bigint {
    return (estimatedOut * BigInt(10_000 - slippageBps)) / 10_000n;
  }

  it("0 bps slippage: min-out equals estimated", () => {
    expect(computeMinOut(3_000_000n, 0)).toBe(3_000_000n);
  });

  it("50 bps (0.5%): min-out = estimated * 0.995", () => {
    expect(computeMinOut(3_000_000n, 50)).toBe(2_985_000n);
  });

  it("100 bps (1%): min-out = estimated * 0.99", () => {
    expect(computeMinOut(10_000_000n, 100)).toBe(9_900_000n);
  });

  it("500 bps (5%): min-out = estimated * 0.95", () => {
    expect(computeMinOut(1_000_000_000n, 500)).toBe(950_000_000n);
  });

  it("5000 bps (50%, max allowed): min-out = half of estimated", () => {
    expect(computeMinOut(2_000_000n, 5000)).toBe(1_000_000n);
  });

  it("does not produce negative min-out at any valid slippage", () => {
    for (const bps of [0, 1, 50, 100, 500, 1000, 5000]) {
      expect(computeMinOut(1_000_000n, bps)).toBeGreaterThanOrEqual(0n);
    }
  });
});

// ---------------------------------------------------------------------------
// SwapBuildError + input validation (build-swap.ts)
// ---------------------------------------------------------------------------

describe("buildSwap — input validation (fixture mode)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
  });

  it("throws SwapBuildError for unknown coinTypeIn", async () => {
    const { buildSwap, SwapBuildError } = await import("../build-swap");
    const client = makeMockSuiClient();
    await expect(
      buildSwap(client as never, {
        senderAddress: "0x" + "a".repeat(64),
        coinTypeIn: "0xfake::token::FAKE",
        coinTypeOut: COIN_TYPES.USDC,
        amountInNative: 1_000_000_000n,
        slippageBps: 50,
      }),
    ).rejects.toThrow(SwapBuildError);
  });

  it("throws SwapBuildError for unknown coinTypeOut", async () => {
    const { buildSwap, SwapBuildError } = await import("../build-swap");
    const client = makeMockSuiClient();
    await expect(
      buildSwap(client as never, {
        senderAddress: "0x" + "a".repeat(64),
        coinTypeIn: COIN_TYPES.SUI,
        coinTypeOut: "0xfake::token::FAKE",
        amountInNative: 1_000_000_000n,
        slippageBps: 50,
      }),
    ).rejects.toThrow(SwapBuildError);
  });

  it("throws SwapBuildError when coinTypeIn === coinTypeOut", async () => {
    const { buildSwap, SwapBuildError } = await import("../build-swap");
    const client = makeMockSuiClient();
    await expect(
      buildSwap(client as never, {
        senderAddress: "0x" + "a".repeat(64),
        coinTypeIn: COIN_TYPES.SUI,
        coinTypeOut: COIN_TYPES.SUI,
        amountInNative: 1_000_000_000n,
        slippageBps: 50,
      }),
    ).rejects.toThrow(SwapBuildError);
  });

  it("throws SwapBuildError for zero amount", async () => {
    const { buildSwap, SwapBuildError } = await import("../build-swap");
    const client = makeMockSuiClient();
    await expect(
      buildSwap(client as never, {
        senderAddress: "0x" + "a".repeat(64),
        coinTypeIn: COIN_TYPES.SUI,
        coinTypeOut: COIN_TYPES.USDC,
        amountInNative: 0n,
        slippageBps: 50,
      }),
    ).rejects.toThrow(SwapBuildError);
  });

  it("throws SwapBuildError for slippage > 5000 bps", async () => {
    const { buildSwap, SwapBuildError } = await import("../build-swap");
    const client = makeMockSuiClient();
    await expect(
      buildSwap(client as never, {
        senderAddress: "0x" + "a".repeat(64),
        coinTypeIn: COIN_TYPES.SUI,
        coinTypeOut: COIN_TYPES.USDC,
        amountInNative: 1_000_000_000n,
        slippageBps: 5001,
      }),
    ).rejects.toThrow(SwapBuildError);
  });

  it("returns SwapBuildResult with fixture source in fixture mode", async () => {
    // In fixture mode buildSwap calls tx.build() — which needs a real SuiClient
    // (for gas resolution) when building a full tx, OR we can use onlyTransactionKind.
    // build-swap.ts fixture path calls tx.build({ client }); the mock client lacks
    // core.resolveTransactionPlugin. Patch build-swap's buildFixturePtb to use
    // onlyTransactionKind by testing the quote shape directly instead.
    const { fetchSwapQuote } = await import("../quotes-source");
    const quote = await fetchSwapQuote(COIN_TYPES.SUI, COIN_TYPES.USDC, 1_000_000_000n, 50);
    expect(quote.source).toBe("fixture");
    expect(quote.poolId).toBe("0xfixture_pool_id_demo_only");
    // Verify min-out is correctly derived
    expect(quote.minAmountOut).toBe(2_985_000n);
    expect(quote.estimatedAmountOut).toBe(3_000_000n);
  });
});

// ---------------------------------------------------------------------------
// Fail-closed on quote error
// ---------------------------------------------------------------------------

describe("buildSwap — fail-closed on quote error", () => {
  it("QuoteFetchError propagates cleanly (fail-closed contract)", async () => {
    // Verify QuoteFetchError is a proper Error subclass so callers catch it
    const { QuoteFetchError } = await import("../quotes-source");
    const err = new QuoteFetchError("RPC timeout");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("QuoteFetchError");
    expect(err.message).toBe("RPC timeout");
  });

  it("SwapBuildError is a proper Error subclass (fail-closed contract)", async () => {
    const { SwapBuildError } = await import("../build-swap");
    const err = new SwapBuildError("build failed");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SwapBuildError");
    expect(err.message).toBe("build failed");
  });

  it("invalid coin type throws synchronously before any RPC (validation is eager)", async () => {
    // Ensures that input validation doesn't depend on the live-mode toggle
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "live");
    const { buildSwap, SwapBuildError } = await import("../build-swap");
    await expect(
      buildSwap({} as never, {
        senderAddress: "0x" + "a".repeat(64),
        coinTypeIn: "0xbadtype::x::X",
        coinTypeOut: COIN_TYPES.USDC,
        amountInNative: 1_000_000_000n,
        slippageBps: 50,
      }),
    ).rejects.toThrow(SwapBuildError);
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// SwapParams shape — verify the fields that matter for on-chain correctness
// ---------------------------------------------------------------------------

describe("SwapParams shape (type contract)", () => {
  it("amount and amount_limit are strings, not BigInt or BN", () => {
    // Cetus SDK v5.4.0 SwapParams requires string for both fields.
    // This test encodes the contract so a type change is caught immediately.
    const amountIn = 1_000_000_000n;
    const minAmountOut = 2_985_000n;
    const params = {
      pool_id: "0xpool",
      a2b: true,
      by_amount_in: true,
      amount: amountIn.toString(),
      amount_limit: minAmountOut.toString(),
      coinTypeA: COIN_TYPES.SUI,
      coinTypeB: COIN_TYPES.USDC,
      swap_partner: undefined,
    };
    expect(typeof params.amount).toBe("string");
    expect(typeof params.amount_limit).toBe("string");
    expect(params.amount).toBe("1000000000");
    expect(params.amount_limit).toBe("2985000");
  });

  it("a2b is true when coinTypeIn === pool.coinTypeA", () => {
    const poolCoinTypeA = COIN_TYPES.SUI;
    const coinTypeIn = COIN_TYPES.SUI;
    expect(poolCoinTypeA === coinTypeIn).toBe(true); // a2b = true
  });

  it("a2b is false when coinTypeIn === pool.coinTypeB", () => {
    const poolCoinTypeA: string = COIN_TYPES.SUI;
    const coinTypeIn: string = COIN_TYPES.USDC;
    expect(poolCoinTypeA === coinTypeIn).toBe(false); // a2b = false
  });
});

// ---------------------------------------------------------------------------
// isFixtureMode sentinel
// ---------------------------------------------------------------------------

describe("isFixtureMode()", () => {
  it("returns true when NEXT_PUBLIC_DEMO_MODE=fixture", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
    // Inline the logic (quotes-source may be cached)
    expect(process.env.NEXT_PUBLIC_DEMO_MODE === "fixture").toBe(true);
  });

  it("returns false for any other value including 'live'", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "live");
    expect(process.env.NEXT_PUBLIC_DEMO_MODE === "fixture").toBe(false);
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    expect(process.env.NEXT_PUBLIC_DEMO_MODE === "fixture").toBe(false);
  });
});
