/**
 * price-oracle.ts — live USD price oracle (CoinGecko) for the Guardian's trusted
 * price, fail-soft and SYNCHRONOUS at the read point.
 *
 * WHY CoinGecko (was Pyth Hermes): the public Hermes endpoint is keyless but heavily
 * rate-limited from serverless IPs, and Pyth's free tier offers no API key to lift the
 * limit. CoinGecko's free tier covers every coin we price — including the Sui-ecosystem
 * tokens DEEP/CETUS/WAL/NS/BLUE — in ONE batched call, works keyless, and OPTIONALLY
 * accepts a free Demo API key (COINGECKO_API_KEY → `x-cg-demo-api-key`) for a higher
 * rate limit. SUI itself is priced live off the DEX (fetchSuiUsdPrice), not here.
 *
 * The Guardian cap reads getTrustedUsdPrice synchronously, so this keeps a sync
 * in-memory cache that an out-of-band refresh populates. A read is never async and
 * never throws.
 *
 * SAFETY (the cap consumes this): UNDER-valuing is the dangerous direction — it would
 * let a larger amount pass. So (a) stale entries are rejected (last_updated_at older
 * than MAX_STALENESS_S → treated as missing), and (b) the caller combines the cached
 * price with a conservative floor via `max(price, floor)` for the high-value coins
 * (ETH/BTC/DEEP) — see protocol-constants.getTrustedUsdPrice — so a glitch-low/stale
 * value clamps UP to the floor (tighter), never down. CoinGecko exposes no confidence
 * band, but spot prices are robust and the floor covers the dangerous direction; the
 * non-floored Sui-ecosystem coins are low unit-value, bounding any residual impact.
 */

import { normalizeStructTag } from "@mysten/sui/utils";
import { COIN_TYPES, registerLivePriceProvider } from "./protocol-constants";

const CG_BASE = "https://api.coingecko.com/api/v3/simple/price";
const FETCH_TIMEOUT_MS = 8000;
const TTL_MS = 30_000;
// Reject an entry whose last update is older than this — treat as missing → caller
// uses the floor. Lenient: simple/price can lag a few minutes and the floors already
// bound the high-value coins.
const MAX_STALENESS_S = 600; // 10 min

// CoinGecko coin ids for each priced coin (verified via /search). WETH→ethereum (ETH/USD),
// wBTC→bitcoin (BTC/USD) — the wrapped assets track the underlying.
function idMap(): Record<string, string> {
  return {
    [COIN_TYPES.SUI]: "sui",
    [COIN_TYPES.WETH]: "ethereum",
    [COIN_TYPES.wBTC]: "bitcoin",
    [COIN_TYPES.DEEP]: "deep",
    [COIN_TYPES.CETUS]: "cetus-protocol",
    [COIN_TYPES.WAL]: "walrus-2",
    [COIN_TYPES.NS]: "suins-token",
    [COIN_TYPES.BLUE]: "bluefin",
  };
}

interface Cache {
  at: number;
  byType: Map<string, number>;
}
let cache: Cache | null = null;
let inflight: Promise<void> | null = null;

function canonical(coinType: string): string | null {
  try {
    return normalizeStructTag(coinType.startsWith("0x") ? coinType : `0x${coinType}`);
  } catch {
    return null;
  }
}

/** Parse one CoinGecko price entry into a validated USD price, or null. */
function toUsd(entry: unknown): number | null {
  const e = entry as { usd?: number; last_updated_at?: number };
  const px = e?.usd;
  if (px == null || !Number.isFinite(px) || px <= 0) return null;
  if (e.last_updated_at && Date.now() / 1000 - e.last_updated_at > MAX_STALENESS_S) return null;
  return px;
}

/**
 * Refresh the price cache from CoinGecko (fail-soft). De-duplicated: concurrent callers
 * share one in-flight request. On any error, the last good cache is retained.
 */
export async function refreshUsdPrices(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const map = idMap();
    const idToType = new Map(Object.entries(map).map(([type, id]) => [id, type]));
    const params = new URLSearchParams({
      ids: Object.values(map).join(","),
      vs_currencies: "usd",
      include_last_updated_at: "true",
    });
    const url = `${CG_BASE}?${params.toString()}`;
    const headers: Record<string, string> = { accept: "application/json" };
    // Optional free Demo API key — lifts the keyless rate limit. Absent → keyless.
    const key = process.env.COINGECKO_API_KEY;
    if (key) headers["x-cg-demo-api-key"] = key;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Record<string, unknown>;
      const next = new Map<string, number>();
      for (const [id, entry] of Object.entries(json)) {
        const coinType = idToType.get(id);
        const usd = toUsd(entry);
        if (coinType && usd !== null) {
          const k = canonical(coinType);
          if (k) next.set(k, usd);
        }
      }
      if (next.size > 0) cache = { at: Date.now(), byType: next }; // atomic swap
    } catch {
      // keep the last good cache
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Synchronous cached USD price for a coin, or undefined when the cache is cold/missing
 * the coin. Triggers a background refresh when the cache is stale (never awaited here).
 */
export function getCachedUsdPrice(coinType: string): number | undefined {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    void refreshUsdPrices(); // fire-and-forget warm; this call still returns the last value
  }
  const key = canonical(coinType);
  if (!key || !cache) return undefined;
  return cache.byType.get(key);
}

// Wire this module's cache into the Guardian's trusted-price function the moment the
// module is loaded (e.g. by the agent route warmer). Until then, getTrustedUsdPrice
// uses its conservative floors. Registration is idempotent.
registerLivePriceProvider(getCachedUsdPrice);
