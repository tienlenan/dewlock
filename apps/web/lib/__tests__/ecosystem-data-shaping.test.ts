/**
 * Ecosystem data-layer unit tests — Sui/stablecoin filtering, market-cap/APY
 * sorting, DTO shaping, fail-soft, serve-stale, and link builders. All network
 * is mocked (DefiLlama SDK + global fetch) — no live calls in CI.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Server modules import "server-only" (throws outside an RSC bundle) — stub it.
vi.mock("server-only", () => ({}));

// Mock the @defillama/api SDK for Top TVL (no live SDK call).
const PROTOCOLS_FIXTURE = [
  { name: "NAVI Lending", slug: "navi-lending", category: "Lending", logo: "https://icons.llamao.fi/icons/protocols/navi-lending", chains: ["Sui"], chainTvls: { Sui: 100, Ethereum: 5 }, tvl: 105 },
  { name: "Cetus", slug: "cetus", category: "Dexes", chains: ["Sui", "Aptos"], chainTvls: { Sui: 50 }, tvl: 80 },
  { name: "EthOnly", slug: "eth-only", category: "Lending", chains: ["Ethereum"], chainTvls: { Ethereum: 999 }, tvl: 999 },
  { name: "ZeroSui", slug: "zero-sui", category: "Misc", chains: ["Sui"], chainTvls: { Sui: 0 }, tvl: 0 },
];
vi.mock("@defillama/api", () => ({
  DefiLlama: class {
    tvl = { getProtocols: async () => PROTOCOLS_FIXTURE };
  },
}));

import { getTopTvlProtocols } from "@/lib/ecosystem/top-tvl";
import { getStablecoinYields } from "@/lib/ecosystem/stablecoin-yields";
import { getTrendingTokens } from "@/lib/ecosystem/trending-tokens";
import { cachedJson, toEnvelope, __clearEcosystemCache } from "@/lib/ecosystem/cache";
import type { CachedDataset } from "@/lib/ecosystem/types";
import * as links from "@/lib/ecosystem/links";

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  __clearEcosystemCache();
  vi.unstubAllGlobals();
});

describe("getTopTvlProtocols (DefiLlama SDK)", () => {
  it("keeps Sui protocols, drops non-Sui + zero-TVL, sorts by Sui slice desc, builds links", async () => {
    const env = await getTopTvlProtocols(10);
    expect("items" in env).toBe(true);
    if (!("items" in env)) return;
    expect(env.items.map((i) => i.name)).toEqual(["NAVI Lending", "Cetus"]);
    expect(env.items[0].tvlSui).toBe(100);
    expect(env.items[0].url).toBe("https://defillama.com/protocol/navi-lending");
    expect(env.items[0].category).toBe("Lending");
    expect(env.items[0].image).toBe("https://icons.llamao.fi/icons/protocols/navi-lending");
    expect(env.items[1].image).toBeNull(); // Cetus fixture has no logo → null
    expect(env.source).toBe("DefiLlama");
    expect(env.asOf).toBeTruthy();
  });

  it("respects the limit", async () => {
    const env = await getTopTvlProtocols(1);
    if (!("items" in env)) throw new Error("expected items");
    expect(env.items).toHaveLength(1);
    expect(env.items[0].name).toBe("NAVI Lending");
  });
});

describe("getStablecoinYields (raw keyless /pools)", () => {
  const POOLS = [
    { pool: "p1", chain: "Sui", project: "ember", symbol: "USDC", apy: 15.4, apyBase: 2, apyReward: 13.4, tvlUsd: 1000, stablecoin: true },
    { pool: "p2", chain: "Sui", project: "navi", symbol: "USDT", apy: 8.1, apyBase: 8.1, apyReward: 0, tvlUsd: 5000, stablecoin: true },
    { pool: "p3", chain: "Sui", project: "x", symbol: "SUI", apy: 99, stablecoin: false },
    { pool: "p4", chain: "Ethereum", project: "y", symbol: "USDC", apy: 50, stablecoin: true },
    { pool: "p5", chain: "Sui", project: "z", symbol: "DAI", apy: Number.NaN, stablecoin: true },
  ];

  it("filters Sui+stablecoin, drops non-finite apy, sorts apy desc, shapes + links", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ status: "success", data: POOLS })));
    const env = await getStablecoinYields(8);
    if (!("items" in env)) throw new Error("expected items");
    expect(env.items.map((i) => i.poolId)).toEqual(["p1", "p2"]);
    expect(env.items[0].apy).toBe(15.4);
    expect(env.items[0].url).toBe("https://defillama.com/yields/pool/p1");
    expect(env.items[0].stablecoin).toBe(true);
    expect(env.items[0].image).toBe("https://icons.llamao.fi/icons/protocols/ember");
  });

  it("fail-soft: source down with no prior cache → unavailable (never throws)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const env = await getStablecoinYields(8);
    expect("unavailable" in env).toBe(true);
  });
});

describe("getTrendingTokens (CoinGecko + GeckoTerminal)", () => {
  const SUI_MEME = [
    { id: "sudeng", symbol: "hippo", name: "sudeng", image: "https://x/img.png", current_price: 0.00082, market_cap: 22_600_000, total_volume: 9_800_000, price_change_percentage_24h: 34.3 },
    { id: "lofi", symbol: "lofi", name: "LOFI", current_price: 0.01, market_cap: 5_000_000, total_volume: 100_000, price_change_percentage_24h: -3 },
  ];

  it("ranks by market cap desc, volume from total_volume, builds CoinGecko links", async () => {
    // Provide out-of-order to prove the loader enforces market-cap desc.
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      String(url).includes("sui-meme") ? okJson([SUI_MEME[1], SUI_MEME[0]]) : okJson([]),
    ));
    const env = await getTrendingTokens(10);
    if (!("items" in env)) throw new Error("expected items");
    expect(env.items.map((i) => i.id)).toEqual(["sudeng", "lofi"]);
    expect(env.items[0].symbol).toBe("HIPPO");
    expect(env.items[0].volume24hUsd).toBe(9_800_000);
    expect(env.items[0].coingeckoUrl).toBe("https://www.coingecko.com/en/coins/sudeng");
    expect(env.items[0].source).toBe("CoinGecko");
  });

  it("falls back to sui-ecosystem when sui-meme is sparse", async () => {
    const ECO = [{ id: "cetus", symbol: "cetus", name: "Cetus", market_cap: 200_000_000, current_price: 0.2, total_volume: 1_000_000 }];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("sui-meme")) return okJson([]);
      if (u.includes("sui-ecosystem")) return okJson(ECO);
      return okJson([]);
    }));
    const env = await getTrendingTokens(10);
    if (!("items" in env)) throw new Error("expected items");
    expect(env.items.map((i) => i.id)).toEqual(["cetus"]);
  });

  it("last-resort GeckoTerminal fallback when both CoinGecko categories are empty", async () => {
    const GT = { data: [{ attributes: { name: "DEEP/SUI", address: "0xabc", price_usd: "0.0082", volume_usd: { h24: 45_600_000 } } }] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("coingecko")) return okJson([]);
      if (u.includes("geckoterminal")) return okJson(GT);
      return okJson({});
    }));
    const env = await getTrendingTokens(10);
    if (!("items" in env)) throw new Error("expected items");
    expect(env.items[0].symbol).toBe("DEEP");
    expect(env.items[0].volume24hUsd).toBe(45_600_000);
    expect(env.items[0].source).toBe("GeckoTerminal");
  });
});

describe("cache serve-stale", () => {
  it("loader throws but a last-good exists → returns cached value with stale: true", async () => {
    __clearEcosystemCache();
    // ttlMs 0 → every call is a fresh miss, so the loader runs each time.
    const good: CachedDataset<number> = { items: [1, 2], asOf: "2026-06-20T00:00:00.000Z" };
    const r1 = await cachedJson("k", 0, async () => good);
    expect(r1.stale).toBe(false);
    expect(r1.value).toEqual(good);

    const r2 = await cachedJson("k", 0, async () => { throw new Error("source blip"); });
    expect(r2.stale).toBe(true);
    expect(r2.value).toEqual(good);
  });

  it("loader throws with NO last-good → value null (caller maps to unavailable)", async () => {
    __clearEcosystemCache();
    const r = await cachedJson("never", 0, async () => { throw new Error("down"); });
    expect(r.value).toBeNull();
  });

  it("toEnvelope flags stale + preserves the original asOf", () => {
    const stale = toEnvelope<number>({ value: { items: [9], asOf: "T" }, stale: true }, "DefiLlama", "x");
    expect(stale).toEqual({ asOf: "T", source: "DefiLlama", items: [9], stale: true });
    const none = toEnvelope<number>({ value: null, stale: false }, "DefiLlama", "down");
    expect(none).toEqual({ unavailable: true, reason: "down" });
  });
});

describe("links builders (exact formats + reject malformed ids)", () => {
  it("builds the documented URLs", () => {
    expect(links.defillamaProtocol("navi-lending")).toBe("https://defillama.com/protocol/navi-lending");
    expect(links.defillamaPool("f601349e-4074-47e0-842e-2c6578490040")).toBe("https://defillama.com/yields/pool/f601349e-4074-47e0-842e-2c6578490040");
    expect(links.defillamaChainSui()).toBe("https://defillama.com/chain/Sui");
    expect(links.coingeckoCoin("sudeng")).toBe("https://www.coingecko.com/en/coins/sudeng");
    expect(links.suivisionCoin("0x2::sui::SUI")).toBe("https://suivision.xyz/coin/0x2::sui::SUI");
  });

  it("rejects malformed ids → safe landing fallback / null", () => {
    expect(links.defillamaProtocol("bad slug!")).toBe("https://defillama.com/chain/Sui");
    expect(links.defillamaPool("../../etc")).toBe("https://defillama.com/yields");
    expect(links.suivisionCoin("not-a-coin-type")).toBeNull();
  });
});
