import "server-only";

/**
 * Top Sui stablecoin yield pools.
 *
 * WHY a raw keyless fetch (not the @defillama/api SDK): the SDK's Yields module
 * is Pro-key gated (🔐). The keyless source for APY data is the raw endpoint
 * `https://yields.llama.fi/pools` (verified 200, no key, ~11 MB, 60 Sui
 * stablecoin pools). We fetch it server-side ONLY, parse to the top-N, and cache
 * — the multi-MB payload never reaches the browser or the agent.
 *
 * The endpoint has no query filtering: filter in our code by
 * `chain === "Sui" && stablecoin === true`, sort by `apy` desc. Cached 5min.
 */

import { cachedJson, toEnvelope } from "./cache";
import { defillamaPool, defillamaProtocolIcon } from "./links";
import type { CachedDataset, EcosystemEnvelope, YieldItem } from "./types";

const POOLS_URL = "https://yields.llama.fi/pools";
const KEY = "ecosystem:stablecoin-yields";
const TTL_MS = 5 * 60_000;
// Large payload (~11 MB) but downloads in <1s — generous abort for a cold path.
const TIMEOUT_MS = 15_000;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 25;

interface LlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd?: number;
  apy?: number;
  apyBase?: number | null;
  apyReward?: number | null;
  stablecoin?: boolean;
}

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

async function loadYields(limit: number): Promise<CachedDataset<YieldItem>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(POOLS_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`yields.llama.fi ${res.status}`);
    // Response is { status, data: Pool[] }; tolerate a bare array defensively.
    const json = (await res.json()) as { data?: LlamaPool[] } | LlamaPool[];
    const pools = Array.isArray(json) ? json : json.data;
    if (!Array.isArray(pools)) throw new Error("yields.llama.fi: unexpected shape");

    const items: YieldItem[] = pools
      .filter((p) => p.chain === "Sui" && p.stablecoin === true && fin(p.apy))
      .sort((a, b) => (b.apy as number) - (a.apy as number))
      .slice(0, limit)
      .map((p) => ({
        project: p.project,
        symbol: p.symbol,
        apy: p.apy as number,
        apyBase: fin(p.apyBase) ? p.apyBase : null,
        apyReward: fin(p.apyReward) ? p.apyReward : null,
        tvlUsd: fin(p.tvlUsd) ? p.tvlUsd : 0,
        poolId: p.pool,
        stablecoin: true,
        image: defillamaProtocolIcon(p.project),
        url: defillamaPool(p.pool),
      }));

    return { items, asOf: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}

/** Top-N Sui stablecoin pools by APY (fail-soft envelope, serve-stale). */
export async function getStablecoinYields(limit = DEFAULT_LIMIT): Promise<EcosystemEnvelope<YieldItem>> {
  const n = Math.min(Math.max(1, Math.floor(limit) || DEFAULT_LIMIT), MAX_LIMIT);
  const res = await cachedJson<CachedDataset<YieldItem>>(`${KEY}:${n}`, TTL_MS, () => loadYields(n));
  return toEnvelope(res, "DefiLlama", "DefiLlama yields unreachable");
}
