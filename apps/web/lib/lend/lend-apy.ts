/**
 * lend-apy.ts — fail-soft live supply-APY source for the lend protocol picker.
 *
 * NAVI publishes per-reserve rates on a public read API; we read `currentSupplyRate`
 * (RAY-scaled, /1e27 → fraction → ×100 = APY%) keyed by canonical coin type. Suilend
 * has no equivalent public REST and its SDK is not clean Node-ESM, so its APY is left
 * unavailable (the card shows "—") rather than fabricated.
 *
 * Every path is fail-soft: a slow/broken upstream or an unexpected shape yields an
 * empty/partial result, never a throw and never a guessed number. Server-side only
 * (called from the /api/lend-options route); a short TTL cache shields the upstream.
 */

import { normalizeStructTag } from "@mysten/sui/utils";

const NAVI_POOLS_URL = "https://open-api.naviprotocol.io/api/navi/pools";
const FETCH_TIMEOUT_MS = 8000;
const TTL_MS = 60_000;
const RAY = 1e27;
// A sane band for an on-chain supply APY; anything outside is treated as a bad parse.
const MAX_PLAUSIBLE_APY_PCT = 200;

export interface LendApyByProtocol {
  navi: number | null;
  suilend: number | null;
}

interface CacheEntry {
  at: number;
  byType: Map<string, number>;
}
let naviCache: CacheEntry | null = null;

function canonical(coinType: string): string | null {
  try {
    return normalizeStructTag(coinType.startsWith("0x") ? coinType : `0x${coinType}`);
  } catch {
    return null;
  }
}

function toApyPct(rawRate: unknown): number | null {
  const n = typeof rawRate === "string" || typeof rawRate === "number" ? Number(rawRate) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const pct = (n / RAY) * 100;
  if (!Number.isFinite(pct) || pct <= 0 || pct > MAX_PLAUSIBLE_APY_PCT) return null;
  return pct;
}

/** Fetch NAVI supply APY by canonical coin type (cached, fail-soft → empty map). */
async function fetchNaviSupplyApy(): Promise<Map<string, number>> {
  if (naviCache && Date.now() - naviCache.at < TTL_MS) return naviCache.byType;

  const byType = new Map<string, number>();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(NAVI_POOLS_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: unknown };
    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const token = r.token as Record<string, unknown> | undefined;
      const type = canonical(String(token?.coinType ?? r.coinType ?? ""));
      const apy = toApyPct(r.currentSupplyRate);
      if (type && apy !== null) byType.set(type, apy);
    }
    naviCache = { at: Date.now(), byType };
  } catch {
    // Upstream slow/broken — serve the last good cache if any, else empty.
    if (naviCache) return naviCache.byType;
  } finally {
    clearTimeout(timer);
  }
  return byType;
}

/** Live supply APY for a coin across the built lending protocols (fail-soft). */
export async function getLendSupplyApy(coinType: string): Promise<LendApyByProtocol> {
  const key = canonical(coinType);
  const navi = await fetchNaviSupplyApy();
  return {
    navi: key ? navi.get(key) ?? null : null,
    suilend: null, // no public rate source wired — shown as "—", never fabricated
  };
}
