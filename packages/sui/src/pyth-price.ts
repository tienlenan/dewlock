/**
 * pyth-price.ts — live USD price oracle (Pyth Hermes) for the Guardian's trusted
 * price, fail-soft and SYNCHRONOUS at the read point.
 *
 * The Guardian cap reads `getTrustedUsdPrice` synchronously, so this module keeps a
 * sync in-memory cache that an out-of-band refresh populates from Hermes. A read is
 * never async and never throws.
 *
 * SAFETY (the cap consumes this): a low/stale/wide-confidence feed must NEVER loosen
 * the cap. So (a) updates are admitted only when fresh + the confidence band is tight,
 * and (b) the caller combines the cached price with a conservative floor via
 * `max(pyth, floor)` — see protocol-constants.getTrustedUsdPrice. A glitch-low feed is
 * then clamped up to the floor (tighter), never down.
 */

import { normalizeStructTag } from "@mysten/sui/utils";
import { COIN_TYPES, registerLivePriceProvider } from "./protocol-constants";

const HERMES_BASE = "https://hermes.pyth.network/v2/updates/price/latest";
const FETCH_TIMEOUT_MS = 8000;
const TTL_MS = 30_000;
// Reject a feed whose confidence interval is wider than this fraction of price, or
// whose publish time is older than this — treat as missing → caller uses the floor.
const MAX_CONF_RATIO = 0.02; // 2%
const MAX_STALENESS_S = 90;

// Pyth mainnet price-feed ids (verified against Hermes). wBTC→BTC/USD, WETH→ETH/USD.
function feedIdMap(): Record<string, string> {
  return {
    [COIN_TYPES.SUI]: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
    [COIN_TYPES.WETH]: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    [COIN_TYPES.wBTC]: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    [COIN_TYPES.DEEP]: "0x29bdd5248234e33bd93d3b81100b5fa32eaa5997843847e2c2cb16d7c6d9f7ff",
    [COIN_TYPES.CETUS]: "0xe5b274b2611143df055d6e7cd8d93fe1961716bcd4dca1cad87a83bc1e78c1ef",
    [COIN_TYPES.WAL]: "0xeba0732395fae9dec4bae12e52760b35fc1c5671e2da8b449c9af4efe5d54341",
    [COIN_TYPES.NS]: "0xbb5ff26e47a3a6cc7ec2fce1db996c2a145300edc5acaabe43bf9ff7c5dd5d32",
    [COIN_TYPES.BLUE]: "0x04cfeb7b143eb9c48e9b074125c1a3447b85f59c31164dc20c1beaa6f21f2b6b",
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

/** Parse one Hermes `parsed[]` entry into a validated USD price, or null. */
function toUsd(entry: unknown): number | null {
  const e = entry as { price?: { price?: string; expo?: number; conf?: string; publish_time?: number } };
  const p = e?.price;
  if (!p || p.price == null || p.expo == null) return null;
  const scale = 10 ** p.expo;
  const px = Number(p.price) * scale;
  const conf = p.conf != null ? Number(p.conf) * scale : 0;
  if (!Number.isFinite(px) || px <= 0) return null;
  if (conf > 0 && conf / px > MAX_CONF_RATIO) return null; // band too wide → distrust
  if (p.publish_time && Date.now() / 1000 - p.publish_time > MAX_STALENESS_S) return null;
  return px;
}

/**
 * Refresh the price cache from Hermes (fail-soft). De-duplicated: concurrent callers
 * share one in-flight request. On any error, the last good cache is retained.
 */
export async function refreshPythPrices(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const ids = Object.values(feedIdMap());
    const byId = new Map(Object.entries(feedIdMap()).map(([type, id]) => [id.replace(/^0x/, ""), type]));
    const url = `${HERMES_BASE}?${ids.map((id) => `ids[]=${id}`).join("&")}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { parsed?: unknown[] };
      const next = new Map<string, number>();
      for (const entry of json.parsed ?? []) {
        const id = String((entry as { id?: string }).id ?? "").replace(/^0x/, "");
        const coinType = byId.get(id);
        const usd = toUsd(entry);
        if (coinType && usd !== null) {
          const key = canonical(coinType);
          if (key) next.set(key, usd);
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
 * the feed. Triggers a background refresh when the cache is stale (never awaited here).
 */
export function getCachedPythPrice(coinType: string): number | undefined {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    void refreshPythPrices(); // fire-and-forget warm; this call still returns the last value
  }
  const key = canonical(coinType);
  if (!key || !cache) return undefined;
  return cache.byType.get(key);
}

// Wire this module's cache into the Guardian's trusted-price function the moment the
// module is loaded (e.g. by the agent route warmer). Until then, getTrustedUsdPrice
// uses its conservative floors. Registration is idempotent.
registerLivePriceProvider(getCachedPythPrice);
