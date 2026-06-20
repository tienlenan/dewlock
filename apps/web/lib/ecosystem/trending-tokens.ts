import "server-only";

/**
 * Trending Sui tokens — keyless CoinGecko (primary) + GeckoTerminal (fallback).
 *
 * Primary: CoinGecko `/coins/markets?category=sui-meme` ranked by market cap. Its
 * per-token `total_volume` is the reliable 24h-volume column (per token, no fuzzy
 * join). If `sui-meme` is sparse (< 3) we widen to `sui-ecosystem`. Only when BOTH
 * CoinGecko categories come back empty do we fall back to GeckoTerminal's Sui
 * trending pools (DEX pairs → token rows, volume from h24) as a last resort.
 *
 * Server-side only; cached 60s (CoinGecko free = 10 calls/min). An optional
 * COINGECKO_DEMO_KEY lifts the rate limit but is never required.
 */

import { cachedJson, toEnvelope } from "./cache";
import { coingeckoCoin, geckoterminalPool } from "./links";
import type { CachedDataset, EcosystemEnvelope, TokenItem } from "./types";

const CG_MARKETS = "https://api.coingecko.com/api/v3/coins/markets";
const GT_TRENDING = "https://api.geckoterminal.com/api/v3/networks/sui/trending_pools";
const KEY = "ecosystem:trending-tokens";
const TTL_MS = 60_000;
const TIMEOUT_MS = 9_000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const MIN_PRIMARY = 3; // widen to sui-ecosystem when sui-meme returns fewer

interface CgCoin {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
}

interface GtPool {
  attributes?: {
    name?: string;
    address?: string;
    price_usd?: string;
    volume_usd?: { h24?: number | string };
  };
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const numStr = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function cgUrl(category: string): string {
  const u = new URL(CG_MARKETS);
  u.searchParams.set("vs_currency", "usd");
  u.searchParams.set("category", category);
  u.searchParams.set("order", "market_cap_desc");
  u.searchParams.set("per_page", "20");
  u.searchParams.set("page", "1");
  return u.toString();
}

async function fetchCoinGecko(category: string): Promise<CgCoin[]> {
  const headers: Record<string, string> = {};
  const demoKey = process.env.COINGECKO_DEMO_KEY;
  if (demoKey) headers["x-cg-demo-api-key"] = demoKey;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(cgUrl(category), { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? (json as CgCoin[]) : [];
  } finally {
    clearTimeout(timer);
  }
}

function mapCoinGecko(coins: CgCoin[], limit: number): TokenItem[] {
  // Enforce market-cap-desc as an invariant (don't rely solely on the API order).
  return [...coins]
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, limit)
    .map((c) => ({
    id: c.id,
    symbol: (c.symbol ?? "").toUpperCase(),
    name: c.name,
    image: c.image ?? null,
    priceUsd: num(c.current_price),
    marketCapUsd: num(c.market_cap),
    change24hPct: num(c.price_change_percentage_24h),
    volume24hUsd: num(c.total_volume),
    coingeckoUrl: coingeckoCoin(c.id),
    explorerUrl: null, // markets endpoint omits the Sui coinType
    source: "CoinGecko",
  }));
}

async function fetchGeckoTerminal(): Promise<GtPool[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GT_TRENDING, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const json = (await res.json()) as { data?: GtPool[] };
    return Array.isArray(json.data) ? json.data : [];
  } finally {
    clearTimeout(timer);
  }
}

/** DEX-pair fallback → token rows (base symbol from "BASE/QUOTE", h24 volume). */
function mapGeckoTerminal(pools: GtPool[], limit: number): TokenItem[] {
  return pools.slice(0, limit).map((p, i) => {
    const a = p.attributes ?? {};
    const pairName = a.name ?? "";
    const baseSymbol = pairName.split("/")[0]?.trim() || `POOL${i + 1}`;
    const poolUrl = a.address ? geckoterminalPool(a.address) : null;
    return {
      id: `gt-${i}`,
      symbol: baseSymbol.toUpperCase(),
      name: pairName || baseSymbol,
      image: null,
      priceUsd: numStr(a.price_usd),
      marketCapUsd: null,
      change24hPct: null,
      volume24hUsd: numStr(a.volume_usd?.h24),
      coingeckoUrl: poolUrl ?? "https://www.geckoterminal.com/sui/pools",
      explorerUrl: null,
      source: "GeckoTerminal",
    };
  });
}

async function loadTokens(limit: number): Promise<CachedDataset<TokenItem>> {
  // Primary: sui-meme (lets a real fetch error propagate → serve-stale).
  let coins = await fetchCoinGecko("sui-meme");
  let usedCategory = "sui-meme";

  // Widen to the broader ecosystem when memes are sparse (best-effort).
  if (coins.length < MIN_PRIMARY) {
    try {
      const eco = await fetchCoinGecko("sui-ecosystem");
      if (eco.length > coins.length) {
        coins = eco;
        usedCategory = "sui-ecosystem";
      }
    } catch {
      // keep whatever sui-meme returned
    }
  }

  if (coins.length > 0) {
    console.log(`[ecosystem/tokens] CoinGecko category=${usedCategory} count=${coins.length}`);
    return { items: mapCoinGecko(coins, limit), asOf: new Date().toISOString() };
  }

  // Last resort: GeckoTerminal trending pools (rare — CoinGecko categories empty).
  console.log("[ecosystem/tokens] CoinGecko empty → GeckoTerminal trending fallback");
  const pools = await fetchGeckoTerminal();
  return { items: mapGeckoTerminal(pools, limit), asOf: new Date().toISOString() };
}

/** Top-N trending Sui tokens by market cap (fail-soft envelope, serve-stale). */
export async function getTrendingTokens(limit = DEFAULT_LIMIT): Promise<EcosystemEnvelope<TokenItem>> {
  const n = Math.min(Math.max(1, Math.floor(limit) || DEFAULT_LIMIT), MAX_LIMIT);
  const res = await cachedJson<CachedDataset<TokenItem>>(`${KEY}:${n}`, TTL_MS, () => loadTokens(n));
  return toEnvelope(res, "CoinGecko", "Token data unreachable");
}
