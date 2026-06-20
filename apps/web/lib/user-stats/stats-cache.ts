import "server-only";

/**
 * Redis cache for the derived per-wallet user-stats response.
 *
 * The cache is a MIRROR of the value derived from the authoritative source (the on-chain
 * receipt / action log) — never written with arbitrary client values. Reads are a fast
 * read-through; a miss re-derives + writes; a confirmed action re-derives (via `?fresh=1`)
 * and overwrites. So the dashboard and the copilot read the SAME cached value (consistent),
 * and repeated loads are instant instead of paying the slow memwal recall every time.
 *
 * Fail-soft: when Redis isn't configured, every call is a no-op and the route derives live
 * exactly as before. Short TTL — level/badges only change on a (refresh-forcing) action,
 * and the portfolio figure is informational.
 */

import { getRedis, isRedisConfigured } from "@/lib/redis-client";

const KEY = (wallet: string) => `userstats:${wallet.toLowerCase()}`;
/** Idle staleness bound; a confirmed action forces a fresh re-derive that overwrites this. */
const TTL_SECONDS = 60;

/** Cached stats for a wallet, or null on miss / when caching is unavailable. */
export async function readStatsCache<T>(wallet: string): Promise<T | null> {
  if (!isRedisConfigured()) return null;
  try {
    return (await getRedis().get<T>(KEY(wallet))) ?? null;
  } catch {
    return null;
  }
}

/** Mirror a freshly-derived stats payload into the cache (best-effort). */
export async function writeStatsCache(wallet: string, data: unknown): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await getRedis().set(KEY(wallet), data, { ex: TTL_SECONDS });
  } catch {
    /* cache write is best-effort — a miss just re-derives next time */
  }
}

/** Drop a wallet's cached stats (e.g. on a confirmed action, to force a re-derive). */
export async function invalidateStatsCache(wallet: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await getRedis().del(KEY(wallet));
  } catch {
    /* best-effort */
  }
}
