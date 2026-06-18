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
 * Coins additionally fall back to the official Sui JSON-RPC (getAllBalances + on-chain
 * CoinMetadata + trusted prices) when BlockVision's account endpoint is unavailable —
 * so the portfolio value renders without any third-party indexer / Blockberry. The
 * activity feed stays indexer-only (null when unavailable).
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

/**
 * Official Sui JSON-RPC fallback for the wallet's coins, used when BlockVision's
 * account endpoint is unavailable (no key / Indexing API trial exhausted). Reuses the
 * agent's getPortfolio tool whose final tier is the official Sui RPC (getAllBalances +
 * on-chain CoinMetadata + the trusted price source) — no third-party indexer / Blockberry
 * required. Lazy require keeps the Mastra tool out of this lib's bundle (resolved at
 * runtime via serverExternalPackages, same pattern as the API routes). Fail-soft → null.
 */
async function fetchRpcCoins(
  account: string,
): Promise<{ coins: BvCoin[]; totalUsdValue: number } | null> {
  try {
    // Register + warm the live USD price oracle (CoinGecko) so non-SUI/non-stable coins
    // (WAL/CETUS/DEEP/…) are priced on this route. The agent route warms it on its own;
    // this dashboard route otherwise leaves the provider cold → those coins read as $0.
    try {
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      const { refreshUsdPrices } = require("@dewlock/sui/price-oracle") as {
        refreshUsdPrices: () => Promise<void>;
      };
      await refreshUsdPrices();
    } catch {
      /* fail-soft — coins without a warm price show as unpriced, never fabricated */
    }
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const { getPortfolio } = require("@dewlock/agent/tools/get-portfolio") as {
      getPortfolio: {
        execute: (i: { walletAddress: string }) => Promise<{
          balances: Array<{
            coinType: string;
            displayTicker: string;
            nativeBalance: string;
            estimatedUsdValue: number | null;
            decimals: number;
            iconUrl: string | null;
            priceUsd: number | null;
            verified: boolean;
          }>;
          totalEstimatedUsdValue: number;
        }>;
      };
    };
    const p = await getPortfolio.execute({ walletAddress: account });
    const coins: BvCoin[] = p.balances.map((b) => ({
      coinType: b.coinType,
      symbol: b.displayTicker,
      name: b.displayTicker,
      decimals: b.decimals,
      balance: b.nativeBalance,
      usdValue: b.estimatedUsdValue ?? 0,
      price: b.priceUsd ?? 0,
      verified: b.verified,
      logo: b.iconUrl ?? "",
    }));
    return { coins, totalUsdValue: p.totalEstimatedUsdValue };
  } catch {
    return null; // fail-soft — caller surfaces an honest degraded state
  }
}

/** Combined wallet overview — coins + activity, fail-soft + degraded flag. */
export async function getWalletOverview(account: string): Promise<WalletOverview> {
  const [bvCoins, actsRes] = await Promise.all([
    fetchAccountCoins(account),
    fetchAccountActivities(account),
  ]);
  // Coins: BlockVision's enriched account endpoint first, else fall back to the official
  // Sui JSON-RPC (no Blockberry needed). Activity (onchainTxCount/recent) remains
  // indexer-only and stays null when unavailable — surfaced honestly as "—" by the UI.
  const coinsRes = bvCoins ?? (await fetchRpcCoins(account));
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
