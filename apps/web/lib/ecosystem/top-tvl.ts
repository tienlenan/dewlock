import "server-only";

/**
 * Top Sui protocols by TVL via the official @defillama/api SDK
 * (`client.tvl.getProtocols()` — free, no key; same data as /protocols). We
 * reuse the exact Sui filter + Sui-slice logic from lib/metrics/tvl.ts on the
 * typed Protocol[] result, sort by the Sui-chain slice, and shape the top-N.
 *
 * Server-side only (DefiLlama free API sends no CORS headers). Cached 5min.
 */

import { DefiLlama } from "@defillama/api";
import { cachedJson, toEnvelope } from "./cache";
import { defillamaProtocol, defillamaChainSui } from "./links";
import type { CachedDataset, EcosystemEnvelope, TvlItem } from "./types";

const KEY = "ecosystem:top-tvl";
const TTL_MS = 5 * 60_000; // protocol TVL moves slowly
const SDK_TIMEOUT_MS = 9_000; // fail fast → serve-stale, like the sibling loaders
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

/** Race a promise against a timeout so a hung SDK call rejects into serve-stale. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("DefiLlama SDK timeout")), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), t]);
}

/** Minimal shape we read off the SDK's Protocol[] (it carries much more). */
interface SdkProtocol {
  name: string;
  slug?: string;
  category?: string;
  logo?: string;
  chains?: string[];
  tvl?: number;
  chainTvls?: Record<string, number>;
}

/** Sui-chain TVL slice (0 when absent/non-finite) — mirrors metrics/tvl.ts. */
function suiSlice(p: SdkProtocol): number {
  const v = p.chainTvls?.Sui != null ? p.chainTvls.Sui : p.tvl;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

async function loadTopTvl(limit: number): Promise<CachedDataset<TvlItem>> {
  const client = new DefiLlama();
  const all = (await withTimeout(client.tvl.getProtocols(), SDK_TIMEOUT_MS)) as SdkProtocol[];
  if (!Array.isArray(all)) throw new Error("DefiLlama protocols: unexpected shape");

  const items = all
    .filter((p) => p.chains?.includes("Sui") || p.chainTvls?.Sui != null)
    .map((p) => ({ p, tvlSui: suiSlice(p) }))
    .filter((x) => x.tvlSui > 0)
    .sort((a, b) => b.tvlSui - a.tvlSui)
    .slice(0, limit)
    .map(({ p, tvlSui }) => ({
      name: p.name,
      slug: p.slug ?? "",
      category: p.category ?? "—",
      tvlSui,
      image: typeof p.logo === "string" ? p.logo : null,
      url: p.slug ? defillamaProtocol(p.slug) : defillamaChainSui(),
    }));

  return { items, asOf: new Date().toISOString() };
}

/** Top-N Sui protocols by Sui-chain TVL (fail-soft envelope, serve-stale). */
export async function getTopTvlProtocols(limit = DEFAULT_LIMIT): Promise<EcosystemEnvelope<TvlItem>> {
  const n = Math.min(Math.max(1, Math.floor(limit) || DEFAULT_LIMIT), MAX_LIMIT);
  const res = await cachedJson<CachedDataset<TvlItem>>(`${KEY}:${n}`, TTL_MS, () => loadTopTvl(n));
  return toEnvelope(res, "DefiLlama", "DefiLlama unreachable");
}
