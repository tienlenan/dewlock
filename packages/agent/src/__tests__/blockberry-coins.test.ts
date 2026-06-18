/**
 * Blockberry getCoinsByWallet → SuiVisionCoin mapping. Locks the field mapping +
 * fail-soft behavior (no key / auth failure → null → RPC fallback). Network mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ADDR = "0x" + "1".repeat(64);

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
}

describe("fetchBlockberryCoins", () => {
  beforeEach(() => {
    vi.resetModules(); // reset the module-level `blockberryDisabled` flag between tests
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when no API key is set (RPC fallback)", async () => {
    vi.stubEnv("BLOCKBERRY_API_KEY", "");
    const { fetchBlockberryCoins } = await import("../blockberry-coins");
    expect(await fetchBlockberryCoins(ADDR)).toBeNull();
  });

  it("maps content[] to SuiVisionCoin, deriving scam from securityMessage + usd from price", async () => {
    vi.stubEnv("BLOCKBERRY_API_KEY", "test-key");
    mockFetchOnce(200, {
      content: [
        {
          coinType: "0x2::sui::SUI",
          coinName: "Sui",
          coinSymbol: "SUI",
          decimals: 9,
          totalBalance: 2_000_000_000, // 2 SUI native
          coinPrice: 0.8,
          imgUrl: "https://logo/sui.png",
          verified: true,
          securityMessage: "",
        },
        {
          coinType: "0xbad::scam::SCAM",
          coinSymbol: "SCAM",
          decimals: 6,
          totalBalance: 1_000_000,
          coinPrice: 0,
          imgUrl: "",
          verified: false,
          securityMessage: "Potential scam token",
        },
      ],
    });
    const { fetchBlockberryCoins } = await import("../blockberry-coins");
    const coins = await fetchBlockberryCoins(ADDR);
    expect(coins).toHaveLength(2);

    const sui = coins!.find((c) => c.symbol === "SUI")!;
    expect(sui.balance).toBe("2000000000"); // native string
    expect(sui.verified).toBe(true);
    expect(sui.scam).toBe(false);
    expect(sui.logo).toBe("https://logo/sui.png");
    expect(sui.price).toBe(0.8);
    expect(sui.usdValue).toBeCloseTo(1.6); // 2 SUI * $0.8

    const scam = coins!.find((c) => c.symbol === "SCAM")!;
    expect(scam.scam).toBe(true); // from non-empty securityMessage
    expect(scam.verified).toBe(false);
  });

  it("returns null on 403 (key rejected) — fail soft", async () => {
    vi.stubEnv("BLOCKBERRY_API_KEY", "bad-key");
    mockFetchOnce(403, { message: "forbidden" });
    const { fetchBlockberryCoins } = await import("../blockberry-coins");
    expect(await fetchBlockberryCoins(ADDR)).toBeNull();
  });
});
