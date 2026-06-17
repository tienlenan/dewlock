/**
 * Tests for the shared BlockVision client.
 *
 * fetch is ALWAYS mocked — these tests never hit the live API (conserves the
 * trial-call budget). Covers: missing key, success normalization, fail-soft on
 * HTTP error + non-200 envelope code, and the TTL cache (no duplicate fetch).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getWalletOverview,
  fetchAccountCoins,
  __clearBlockVisionCache,
} from "../client";

const ADDR = "0x" + "1".repeat(64);
const KEY = "test-key";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

function mockFetchByPath(handlers: Record<string, () => Promise<Response>>) {
  return vi.fn((url: string | URL) => {
    const u = String(url);
    for (const [needle, h] of Object.entries(handlers)) {
      if (u.includes(needle)) return h();
    }
    return jsonResponse({ code: 404 }, false, 404);
  });
}

beforeEach(() => {
  __clearBlockVisionCache();
  process.env.BLOCKVISION_API_KEY = KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.BLOCKVISION_API_KEY;
});

describe("BlockVision client — missing key", () => {
  it("returns a degraded overview without calling fetch", async () => {
    delete process.env.BLOCKVISION_API_KEY;
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const ov = await getWalletOverview(ADDR);
    expect(spy).not.toHaveBeenCalled();
    expect(ov.degraded).toBe(true);
    expect(ov.coins).toEqual([]);
    expect(ov.totalUsdValue).toBeNull();
    expect(ov.onchainTxCount).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("BlockVision client — success normalization", () => {
  it("normalizes coins + total + activity", async () => {
    const fetchMock = mockFetchByPath({
      "/sui/account/coins": () =>
        jsonResponse({
          code: 200,
          result: {
            usdValue: 42.5,
            coins: [
              { coinType: "0x2::sui::SUI", symbol: "SUI", name: "Sui", decimals: 9, balance: "1000000000", usdValue: 40, price: 4, verified: true, logo: "x" },
            ],
          },
        }),
      "/sui/account/activities": () =>
        jsonResponse({
          code: 200,
          result: { total: 7, data: [{ digest: "0xfeed", type: "swap", timestampMs: 123 }] },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const ov = await getWalletOverview(ADDR);
    expect(ov.degraded).toBe(false);
    expect(ov.totalUsdValue).toBeCloseTo(42.5);
    expect(ov.coins).toHaveLength(1);
    expect(ov.coins[0].symbol).toBe("SUI");
    expect(ov.onchainTxCount).toBe(7);
    expect(ov.recent[0].digest).toBe("0xfeed");
    vi.unstubAllGlobals();
  });
});

describe("BlockVision client — fail-soft", () => {
  it("returns null on HTTP error", async () => {
    vi.stubGlobal("fetch", () => jsonResponse({}, false, 500));
    expect(await fetchAccountCoins(ADDR)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("returns null when the envelope code is not 200", async () => {
    vi.stubGlobal("fetch", () => jsonResponse({ code: 401, message: "unauthorized" }));
    expect(await fetchAccountCoins(ADDR)).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("BlockVision client — TTL cache", () => {
  it("does not refetch the same path within the TTL", async () => {
    const fetchMock = mockFetchByPath({
      "/sui/account/coins": () => jsonResponse({ code: 200, result: { usdValue: 1, coins: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await fetchAccountCoins(ADDR);
    await fetchAccountCoins(ADDR);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
