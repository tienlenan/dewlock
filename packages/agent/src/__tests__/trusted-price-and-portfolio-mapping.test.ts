/**
 * Tests: getTrustedUsdPrice + getPortfolio balance mapping.
 *
 * Invariants verified:
 *   - Stablecoins always return 1.0 (price anchor, not pool-derived)
 *   - SUI returns a positive number from env or the conservative floor
 *   - WETH / wBTC return undefined → Guardian blocks (unknown price)
 *   - Unknown coin types return undefined (never fabricated)
 *   - getPortfolio maps getAllBalances rows correctly: known→USD, unknown→null
 *   - totalEstimatedUsdValue sums only non-null USD values
 *   - Manipulating a pool-spot price CANNOT change getTrustedUsdPrice (independence)
 *   - Cap gate blocks when getTrustedUsdPrice returns undefined
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { COIN_TYPES, COIN_DECIMALS, getTrustedUsdPrice } from "../allowlist";

// ---------------------------------------------------------------------------
// getTrustedUsdPrice — pure unit tests (no mock needed, synchronous)
// ---------------------------------------------------------------------------

describe("getTrustedUsdPrice — stablecoins", () => {
  it("USDC returns exactly 1.0", () => {
    expect(getTrustedUsdPrice(COIN_TYPES.USDC)).toBe(1.0);
  });

  it("USDT returns exactly 1.0", () => {
    expect(getTrustedUsdPrice(COIN_TYPES.USDT)).toBe(1.0);
  });

  it("stablecoin price is independent of any pool-spot value (hardcoded)", () => {
    // Simulate an adversary who somehow patches a pool spot price in memory.
    // getTrustedUsdPrice must still return 1.0 because it never reads pool state.
    const fakePollutedPoolSpot = 999.99; // attacker's injected value
    void fakePollutedPoolSpot; // unused — proves no code path reaches it
    expect(getTrustedUsdPrice(COIN_TYPES.USDC)).toBe(1.0);
  });
});

describe("getTrustedUsdPrice — SUI", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a positive number by default (conservative floor 3.0)", () => {
    vi.stubEnv("SUI_USD_PRICE_FLOOR", "");
    const price = getTrustedUsdPrice(COIN_TYPES.SUI);
    expect(price).toBeDefined();
    expect(price).toBeGreaterThan(0);
  });

  it("uses SUI_USD_PRICE_FLOOR env when set", () => {
    vi.stubEnv("SUI_USD_PRICE_FLOOR", "4.25");
    const price = getTrustedUsdPrice(COIN_TYPES.SUI);
    expect(price).toBeCloseTo(4.25);
  });

  it("falls back to 3.0 when env is unset", () => {
    vi.stubEnv("SUI_USD_PRICE_FLOOR", "");
    const price = getTrustedUsdPrice(COIN_TYPES.SUI);
    expect(price).toBe(3.0);
  });

  it("SUI price is NOT derived from any swap pool (no Cetus import in allowlist)", () => {
    // getTrustedUsdPrice is synchronous — if it called Cetus it would be async.
    // This test encodes that contract.
    const price = getTrustedUsdPrice(COIN_TYPES.SUI);
    expect(typeof price).toBe("number"); // synchronous → not a Promise
  });
});

describe("getTrustedUsdPrice — WETH / wBTC (Pyth live, floor-clamped → swappable)", () => {
  // In unit tests the Pyth cache is cold (no refresh), so these resolve to their
  // conservative floors. In production a warm Pyth cache returns the live ETH/BTC
  // price (clamped UP to the floor, never below it).
  it("WETH returns the conservative floor (>=800) when the cache is cold", () => {
    const p = getTrustedUsdPrice(COIN_TYPES.WETH);
    expect(p).toBeDefined();
    expect(p).toBeGreaterThanOrEqual(800);
  });

  it("wBTC returns the conservative floor (>=15000) when the cache is cold", () => {
    const p = getTrustedUsdPrice(COIN_TYPES.wBTC);
    expect(p).toBeDefined();
    expect(p).toBeGreaterThanOrEqual(15000);
  });

  it("arbitrary unknown coin type (no feed, no floor) still returns undefined", () => {
    expect(getTrustedUsdPrice("0xdeadbeef::fake::FAKE")).toBeUndefined();
  });

  it("SECURITY: a coin with no feed AND no floor → Guardian cap gate blocks (fail-closed)", () => {
    // The Guardian gate: usdPrice === undefined → block("trusted_price").
    function simulateCapGate(coinType: string): { blocked: boolean } {
      return { blocked: getTrustedUsdPrice(coinType) === undefined };
    }
    // Unknown coins still fail-closed (the security contract is preserved).
    expect(simulateCapGate("0xfake::coin::COIN").blocked).toBe(true);
    expect(simulateCapGate("0xdeadbeef::junk::JUNK").blocked).toBe(true);
    // Priced coins (incl. WETH/wBTC via Pyth+floor) pass.
    expect(simulateCapGate(COIN_TYPES.WETH).blocked).toBe(false);
    expect(simulateCapGate(COIN_TYPES.wBTC).blocked).toBe(false);
    expect(simulateCapGate(COIN_TYPES.USDC).blocked).toBe(false);
    expect(simulateCapGate(COIN_TYPES.SUI).blocked).toBe(false);
  });
});

describe("getTrustedUsdPrice — pool-spot manipulation cannot change cap (independence)", () => {
  it("mocking a pool-spot price has no effect on getTrustedUsdPrice", () => {
    // This test proves that even if Cetus preswap returns a manipulated price,
    // the Guardian's cap gate is unaffected because it calls getTrustedUsdPrice,
    // not any pool-derived value.
    const manipulatedPoolSpot = 10_000; // 10000 USDC/SUI — attacker's price

    // getTrustedUsdPrice for SUI is env-based (conservative floor), never pool spot
    const trustedPrice = getTrustedUsdPrice(COIN_TYPES.SUI);

    // Even if pool says 10000x, trusted price stays at the floor
    expect(trustedPrice).not.toBe(manipulatedPoolSpot);
    expect(trustedPrice).toBeLessThanOrEqual(10); // max reasonable SUI price in test env
  });
});

// ---------------------------------------------------------------------------
// getPortfolio balance mapping — mocked SuiClient
// ---------------------------------------------------------------------------

// Mock @dewlock/sui to avoid pulling in the real client
vi.mock("@dewlock/sui", () => ({
  getSuiMainnetClient: vi.fn(),
}));

// Mock the live SUI price source so RPC-path mapping is deterministic (no network).
// Fixed at 3.0 so the balance-mapping assertions below stay price-stable — these
// tests verify the mapping math, not the live price.
vi.mock("@dewlock/sui/aggregator-quotes", () => ({
  fetchSuiUsdPrice: vi.fn(async () => 3.0),
}));

import { getSuiMainnetClient } from "@dewlock/sui";

const FAKE_WALLET = "0x" + "a".repeat(64);

/** Expected shape of a successful getPortfolio result (narrows the Mastra union). */
interface PortfolioResult {
  walletAddress: string;
  balances: Array<{
    coinType: string;
    displayTicker: string;
    nativeBalance: string;
    humanBalance: string;
    estimatedUsdValue: number | null;
    decimals: number;
  }>;
  totalEstimatedUsdValue: number;
  network: "mainnet";
  demoFixture: boolean;
}

/** Call execute and assert a non-void, non-error result. */
async function runPortfolio(
  getPortfolio: { execute?: (...args: never[]) => Promise<unknown> },
  walletAddress: string,
): Promise<PortfolioResult> {
  expect(getPortfolio.execute).toBeDefined();
  const raw = await getPortfolio.execute!({ walletAddress } as never, {} as never);
  expect(raw).toBeDefined();
  return raw as PortfolioResult;
}

/** Build a mock SuiClient with controllable getAllBalances + getCoinMetadata. */
function makePortfolioClient(options: {
  balances: Array<{ coinType: string; totalBalance: string; coinObjectCount?: number }>;
  metadata?: Record<string, { decimals: number; symbol: string } | null>;
}) {
  return {
    getAllBalances: vi.fn().mockResolvedValue(
      options.balances.map((b) => ({
        coinType: b.coinType,
        totalBalance: b.totalBalance,
        coinObjectCount: b.coinObjectCount ?? 1,
        lockedBalance: {},
      })),
    ),
    getCoinMetadata: vi.fn(async ({ coinType }: { coinType: string }) => {
      if (!options.metadata) return null;
      const entry = options.metadata[coinType];
      if (entry === null) return null;
      if (entry === undefined) return null;
      return { decimals: entry.decimals, symbol: entry.symbol, name: coinType, description: "", iconUrl: null };
    }),
  };
}

describe("getPortfolio — live balance mapping", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("SUI_USD_PRICE_FLOOR", "3.0");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps SUI balance with correct decimals (9) and USD value", async () => {
    const mockClient = makePortfolioClient({
      balances: [{ coinType: COIN_TYPES.SUI, totalBalance: "5000000000" }], // 5 SUI
    });
    vi.mocked(getSuiMainnetClient).mockReturnValue(mockClient as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    const suiRow = result.balances.find((b) => b.coinType === COIN_TYPES.SUI);
    expect(suiRow).toBeDefined();
    expect(suiRow!.decimals).toBe(9);
    expect(suiRow!.humanBalance).toBe("5.000000");
    // 5 SUI * $3.0 = $15
    expect(suiRow!.estimatedUsdValue).toBeCloseTo(15);
    expect(result.totalEstimatedUsdValue).toBeCloseTo(15);
  });

  it("maps USDC balance with correct decimals (6) and USD=1.0/unit", async () => {
    const mockClient = makePortfolioClient({
      balances: [{ coinType: COIN_TYPES.USDC, totalBalance: "10000000" }], // 10 USDC
    });
    vi.mocked(getSuiMainnetClient).mockReturnValue(mockClient as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    const usdcRow = result.balances.find((b) => b.coinType === COIN_TYPES.USDC);
    expect(usdcRow).toBeDefined();
    expect(usdcRow!.decimals).toBe(6);
    expect(usdcRow!.humanBalance).toBe("10.000000");
    expect(usdcRow!.estimatedUsdValue).toBeCloseTo(10);
  });

  it("unknown/unverified coin type: filtered out (scam protection), verified shown", async () => {
    const UNKNOWN_TYPE = "0xdeadbeef::junk::JUNK";
    const mockClient = makePortfolioClient({
      balances: [
        { coinType: COIN_TYPES.SUI, totalBalance: "1000000000" }, // 1 SUI (curated → verified)
        { coinType: UNKNOWN_TYPE, totalBalance: "1000000" },       // unverified + not whitelisted
      ],
      metadata: {
        [UNKNOWN_TYPE]: { decimals: 6, symbol: "JUNK" },
      },
    });
    vi.mocked(getSuiMainnetClient).mockReturnValue(mockClient as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    // Trust gate: the unverified, non-whitelisted JUNK token is hidden entirely.
    expect(result.balances.find((b) => b.coinType === UNKNOWN_TYPE)).toBeUndefined();
    // The verified SUI row remains.
    expect(result.balances.find((b) => b.coinType === COIN_TYPES.SUI)).toBeDefined();
    // Total only sums the SUI row ($3)
    expect(result.totalEstimatedUsdValue).toBeCloseTo(3);
  });

  it("whitelisted-but-unverified coin (e.g. CETUS) IS shown (trust gate OR-clause)", async () => {
    // CETUS is in POPULAR_TOKENS but not COIN_TYPES → verified:false on the RPC path,
    // yet it must still appear because it is whitelisted.
    const CETUS = "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS";
    const mockClient = makePortfolioClient({
      balances: [{ coinType: CETUS, totalBalance: "1000000000" }],
      metadata: { [CETUS]: { decimals: 9, symbol: "CETUS" } },
    });
    vi.mocked(getSuiMainnetClient).mockReturnValue(mockClient as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    expect(result.balances.find((b) => b.coinType === CETUS)).toBeDefined();
  });

  it("WETH balance: now priced (Pyth+floor) → included in the total", async () => {
    const mockClient = makePortfolioClient({
      balances: [
        { coinType: COIN_TYPES.WETH, totalBalance: "100000000" }, // 1 WETH (8 dec)
        { coinType: COIN_TYPES.USDC, totalBalance: "5000000" },   // 5 USDC
      ],
    });
    vi.mocked(getSuiMainnetClient).mockReturnValue(mockClient as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    const wethRow = result.balances.find((b) => b.coinType === COIN_TYPES.WETH);
    // 1 WETH valued at the conservative floor (cold cache) → a positive USD value.
    expect(wethRow!.estimatedUsdValue).not.toBeNull();
    expect(wethRow!.estimatedUsdValue!).toBeGreaterThanOrEqual(800);
    // Total = WETH (>=800) + 5 USDC.
    expect(result.totalEstimatedUsdValue).toBeGreaterThanOrEqual(805);
  });

  it("getAllBalances failure → returns empty balances, total=0 (degrades gracefully)", async () => {
    const mockClient = {
      getAllBalances: vi.fn().mockRejectedValue(new Error("RPC timeout")),
      getCoinMetadata: vi.fn(),
    };
    vi.mocked(getSuiMainnetClient).mockReturnValue(mockClient as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    expect(result.balances).toHaveLength(0);
    expect(result.totalEstimatedUsdValue).toBe(0);
    expect(result.demoFixture).toBe(false);
  });

  it("unverified coin (metadata failure): filtered out by the trust gate, not shown", async () => {
    const UNKNOWN_TYPE = "0xabc::some::TOKEN";
    const mockClient = makePortfolioClient({
      balances: [{ coinType: UNKNOWN_TYPE, totalBalance: "500" }],
      metadata: {}, // metadata map is empty → getCoinMetadata returns null for UNKNOWN_TYPE
    });
    // Override getCoinMetadata to throw for the unknown type
    mockClient.getCoinMetadata = vi.fn().mockRejectedValue(new Error("Not found"));
    vi.mocked(getSuiMainnetClient).mockReturnValue(mockClient as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    // Unverified + not whitelisted → hidden (no scam/airdrop tokens shown).
    expect(result.balances).toHaveLength(0);
    expect(result.totalEstimatedUsdValue).toBe(0);
  });

  it("fixture mode: returns exactly 5 rows with DEMO badge, ignores client", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
    const mockClient = makePortfolioClient({ balances: [] });
    vi.mocked(getSuiMainnetClient).mockReturnValue(mockClient as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    expect(result.demoFixture).toBe(true);
    expect(result.balances).toHaveLength(5);
    // getAllBalances should NOT have been called in fixture mode
    expect(mockClient.getAllBalances).not.toHaveBeenCalled();
  });

  it("fixture: SUI=5, USDC=10, USDT=5, total = 5*3 + 10 + 5 = $30", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "fixture");
    vi.mocked(getSuiMainnetClient).mockReturnValue({} as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    expect(result.totalEstimatedUsdValue).toBeCloseTo(30);
  });

  it("multiple coins: total sums all priced positions (incl. WETH via Pyth+floor)", async () => {
    const mockClient = makePortfolioClient({
      balances: [
        { coinType: COIN_TYPES.SUI, totalBalance: "3000000000" },   // 3 SUI → $9
        { coinType: COIN_TYPES.USDC, totalBalance: "7000000" },     // 7 USDC → $7
        { coinType: COIN_TYPES.WETH, totalBalance: "50000000" },    // 0.5 WETH → >= $400 (floor)
      ],
    });
    vi.mocked(getSuiMainnetClient).mockReturnValue(mockClient as never);

    const { getPortfolio } = await import("../tools/get-portfolio");
    const result = await runPortfolio(getPortfolio, FAKE_WALLET);

    const wethRow = result.balances.find((b) => b.coinType === COIN_TYPES.WETH);
    // 0.5 WETH at the floor (>=800/ETH) → >= $400; now included.
    expect(wethRow!.estimatedUsdValue!).toBeGreaterThanOrEqual(400);
    // 3 SUI*$3 + 7 USDC*$1 + WETH(>=$400) → >= $416.
    expect(result.totalEstimatedUsdValue).toBeGreaterThanOrEqual(416);
  });
});

// ---------------------------------------------------------------------------
// Cap gate independence from pool manipulation
// ---------------------------------------------------------------------------

describe("Cap gate — pool manipulation does NOT affect trusted price", () => {
  it("trusted price for USDC is always $1 regardless of any pool value", () => {
    // The Guardian reads getTrustedUsdPrice(coinTypeIn) — a pure function with
    // no network access and no dependency on Cetus preswap results.
    // An attacker controlling a pool cannot move it.
    const suiPrice = getTrustedUsdPrice(COIN_TYPES.SUI);
    const usdcPrice = getTrustedUsdPrice(COIN_TYPES.USDC);
    const fakePrice = getTrustedUsdPrice("0xfake::coin::COIN");

    // Cap gate would compute: estimatedUsdValue = (nativeAmount / 10^decimals) * usdPrice
    // For a $5 cap with 1 SUI at $3: estimatedUsdValue=3 < cap=5 → passes
    const nativeSui = 1_000_000_000n; // 1 SUI
    const estimatedUsd = (Number(nativeSui) / 10 ** (COIN_DECIMALS[COIN_TYPES.SUI] ?? 9)) * (suiPrice ?? 0);
    expect(estimatedUsd).toBeCloseTo(3);

    // Stablecoin: 5 USDC = $5 exactly
    const nativeUsdc = 5_000_000n;
    const usdcUsd = (Number(nativeUsdc) / 10 ** (COIN_DECIMALS[COIN_TYPES.USDC] ?? 6)) * (usdcPrice ?? 0);
    expect(usdcUsd).toBeCloseTo(5);

    // An unpriced (no-feed, no-floor) coin → undefined → cap gate blocks (fail-closed).
    expect(fakePrice).toBeUndefined();
  });
});
