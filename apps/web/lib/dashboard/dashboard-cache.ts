"use client";

/**
 * Last-good dashboard data cache (localStorage) for instant, stable paints.
 *
 * memwal recall is slow + variable (5-15s, sometimes fails), so the dashboard reads the
 * last successful response from here FIRST (instant, no cold skeleton / no blank on a flaky
 * recall), then revalidates in the background and overwrites the cache. Walrus/memwal stays
 * the source of truth — this is a read-through cache, never authoritative.
 */

const PREFIX = "dewlock:dashcache:";

/** Read a cached value by key (per wallet/path). Null on miss, parse error, or SSR. */
export function readDashCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.localStorage.getItem(PREFIX + key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

/** Write a fresh value to the cache. Best-effort (ignores quota / private-mode errors). */
export function writeDashCache(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded / private mode — cache is best-effort */
  }
}
