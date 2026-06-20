import "server-only";

/**
 * cachedJson — read-through cache for the ecosystem datasets with serve-stale.
 *
 * Uses Upstash Redis when configured (serverless-safe, shared across instances),
 * else an in-process Map (mirrors lib/metrics/tvl.ts). On a fresh miss it runs the
 * loader; on loader failure it serves the last-good value (`stale: true`) so a
 * transient source blip never blanks the card. Only when NO value has ever been
 * cached does it return `{ value: null }` (the caller maps that to `unavailable`).
 *
 * The loader returns a `CachedDataset` carrying the original `asOf`, so a stale
 * serve reports the real fetch time — the card's "updated Xm ago" stays honest.
 */

import { getRedis, isRedisConfigured } from "@/lib/redis-client";
import type { CachedDataset, EcosystemEnvelope } from "./types";

interface MemEntry {
  at: number;
  value: unknown;
}

// In-process fallback when Redis is absent (local dev / no creds).
const mem = new Map<string, MemEntry>();

// Last-good kept for 24h so serve-stale survives well past the fresh TTL.
const LAST_GOOD_TTL_S = 24 * 60 * 60;

export interface CacheResult<T> {
  value: T | null;
  /** True when `value` is a last-good served because the fresh load failed. */
  stale: boolean;
}

/**
 * Read `key` fresh, else run `loader` and cache it, else serve the last-good
 * value as stale. `loader` should THROW on a real fetch/parse failure (so the
 * stale path engages); an empty-but-successful result is a valid cached value.
 */
export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<CacheResult<T>> {
  // 1) Fresh hit.
  if (isRedisConfigured()) {
    try {
      const fresh = await getRedis().get<T>(key);
      if (fresh != null) return { value: fresh, stale: false };
    } catch {
      // Redis read failure → fall through to the loader.
    }
  } else {
    const e = mem.get(key);
    if (e && Date.now() - e.at < ttlMs) return { value: e.value as T, stale: false };
  }

  // 2) Fresh miss → load + cache.
  try {
    const loaded = await loader();
    if (loaded != null) {
      if (isRedisConfigured()) {
        try {
          const r = getRedis();
          const ttlS = Math.max(1, Math.ceil(ttlMs / 1000));
          await r.set(key, loaded, { ex: ttlS });
          await r.set(`${key}:last`, loaded, { ex: LAST_GOOD_TTL_S });
        } catch {
          // Cache write is best-effort — never fail the request on it.
        }
      } else {
        mem.set(key, { at: Date.now(), value: loaded });
      }
      return { value: loaded, stale: false };
    }
  } catch {
    // Loader failed → serve the last-good value below.
  }

  // 3) Serve stale (last-good), if any.
  if (isRedisConfigured()) {
    try {
      const last = await getRedis().get<T>(`${key}:last`);
      if (last != null) return { value: last, stale: true };
    } catch {
      // No reachable last-good → unavailable.
    }
  } else {
    const e = mem.get(key);
    if (e) return { value: e.value as T, stale: true };
  }

  return { value: null, stale: false };
}

/**
 * Map a cache result to the public envelope. Preserves the original `asOf`
 * and flags `stale` so the card renders "updated Xm ago" instead of an error.
 */
export function toEnvelope<T>(
  res: CacheResult<CachedDataset<T>>,
  source: string,
  reason: string,
): EcosystemEnvelope<T> {
  if (!res.value) return { unavailable: true, reason };
  const base = { asOf: res.value.asOf, source, items: res.value.items };
  return res.stale ? { ...base, stale: true } : base;
}

/** Test-only: clear the in-process cache between cases (mirrors __clearTvlCache). */
export function __clearEcosystemCache(): void {
  mem.clear();
}
