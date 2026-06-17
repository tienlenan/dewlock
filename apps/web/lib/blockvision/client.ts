/**
 * Shared server-side BlockVision (SuiVision backend) client for the dashboard.
 *
 * Powers the per-wallet "full on-chain footprint" view (portfolio USD + on-chain
 * activity) and — in the protocol-wide dashboard (Phase 5) — coin market data.
 *
 * Server-only: reads BLOCKVISION_API_KEY (never NEXT_PUBLIC_, never committed).
 * Account endpoints are Pro-tier + trial-limited, so every call is:
 *   - TTL-cached (cuts repeat calls during a dashboard session),
 *   - timeout-bounded (AbortController),
 *   - FAIL-SOFT — any error / missing key returns a degraded result, never throws
 *     and never fabricates a number. Absence is surfaced honestly to the UI.
 *
 * BlockVision conventions (from the agent's suivision-coins fetcher): success is
 * `code === 200`, the query param is `account=`, auth header is `x-api-key`.
 *
 * Server-boundary: this module is only imported by the nodejs-runtime route
 * (`/api/user-stats`). The key is read solely from process.env (never a
 * NEXT_PUBLIC_ var), so it cannot reach the client bundle.
 */

const DEFAULT_BASE = "https://api.blockvision.org/v2";
const CACHE_TTL_MS = 60_000;
const TIMEOUT_MS = 8_000;

function baseUrl(): string {
  return process.env.BLOCKVISION_BASE_URL?.replace(/\/+$/, "") ?? DEFAULT_BASE;
}

// ---------------------------------------------------------------------------
// Normalized DTOs
// ---------------------------------------------------------------------------

export interface BvCoin {
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  usdValue: number;
  price: number;
  verified: boolean;
  logo: string;
}

export interface BvActivity {
  digest: string;
  type: string;
  timestampMs: number | null;
}

export interface WalletOverview {
  /** true when the key is unset or any source was unavailable. */
  degraded: boolean;
  /** Total portfolio USD across coins, or null when unavailable. */
  totalUsdValue: number | null;
  coins: BvCoin[];
  /** Full on-chain tx count (null when the API doesn't surface a total). */
  onchainTxCount: number | null;
  recent: BvActivity[];
}

// ---------------------------------------------------------------------------
// Low-level cached + timed-out GET — returns the `result` object or null.
// ---------------------------------------------------------------------------

interface CacheEntry {
  at: number;
  value: unknown;
}
const cache = new Map<string, CacheEntry>();

async function bvGet(path: string, account: string): Promise<unknown | null> {
  const apiKey = process.env.BLOCKVISION_API_KEY;
  if (!apiKey) return null;

  const url = `${baseUrl()}${path}?account=${encodeURIComponent(account)}`;
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "x-api-key": apiKey },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: number; result?: unknown };
    if (json.code !== 200 || json.result == null) return null;
    cache.set(url, { at: Date.now(), value: json.result });
    return json.result;
  } catch {
    return null; // timeout / network / parse — fail soft
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Typed fetchers (defensive parsing — third-party shape may drift)
// ---------------------------------------------------------------------------

export async function fetchAccountCoins(
  account: string,
): Promise<{ coins: BvCoin[]; totalUsdValue: number } | null> {
  const result = (await bvGet("/sui/account/coins", account)) as {
    coins?: Array<Record<string, unknown>>;
    usdValue?: unknown;
  } | null;
  if (!result?.coins) return null;
  const coins: BvCoin[] = result.coins.map((c) => ({
    coinType: String(c.coinType ?? ""),
    symbol: String(c.symbol ?? ""),
    name: String(c.name ?? ""),
    decimals: Number(c.decimals ?? 9),
    balance: String(c.balance ?? "0"),
    usdValue: Number(c.usdValue ?? 0),
    price: Number(c.price ?? 0),
    verified: Boolean(c.verified),
    logo: String(c.logo ?? ""),
  }));
  const totalUsdValue =
    result.usdValue != null
      ? Number(result.usdValue)
      : coins.reduce((sum, c) => sum + c.usdValue, 0);
  return { coins, totalUsdValue };
}

export async function fetchAccountActivities(
  account: string,
): Promise<{ total: number | null; recent: BvActivity[] } | null> {
  const result = (await bvGet("/sui/account/activities", account)) as {
    data?: Array<Record<string, unknown>>;
    total?: unknown;
  } | null;
  if (!result?.data) return null;
  const recent: BvActivity[] = result.data.slice(0, 6).map((a) => ({
    digest: String(a.digest ?? a.txDigest ?? ""),
    type: String(a.type ?? a.category ?? "transaction"),
    timestampMs: a.timestampMs != null ? Number(a.timestampMs) : null,
  }));
  const total = result.total != null ? Number(result.total) : null;
  return { total, recent };
}

/** Combined wallet overview — coins + activity, fail-soft + degraded flag. */
export async function getWalletOverview(account: string): Promise<WalletOverview> {
  const [coinsRes, actsRes] = await Promise.all([
    fetchAccountCoins(account),
    fetchAccountActivities(account),
  ]);
  return {
    degraded: coinsRes == null || actsRes == null,
    totalUsdValue: coinsRes?.totalUsdValue ?? null,
    coins: coinsRes?.coins ?? [],
    onchainTxCount: actsRes?.total ?? null,
    recent: actsRes?.recent ?? [],
  };
}

/** Test-only: clear the module cache between cases. */
export function __clearBlockVisionCache(): void {
  cache.clear();
}
