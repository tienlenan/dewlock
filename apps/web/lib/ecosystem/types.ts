/**
 * Shared DTOs + fail-soft envelope for the Sui-ecosystem discovery features
 * (stablecoin yields, top TVL, trending tokens). One small top-N shape per
 * dataset — the heavy upstream payload (yields /pools is ~11 MB) is filtered
 * server-side and NEVER reaches the browser or the agent.
 *
 * Envelope discipline mirrors lib/metrics/metric.ts: a source that fails yields
 * `{ unavailable }` (or a stale last-good with `stale: true`) — never a fabricated
 * number. `asOf` + `source` drive the card's attribution badge.
 */

/** A Sui stablecoin yield pool (DefiLlama raw keyless yields.llama.fi/pools). */
export interface YieldItem {
  /** DefiLlama project slug (e.g. "ember-protocol"). */
  project: string;
  /** Pool symbol (e.g. "USDC"). */
  symbol: string;
  /** Total APY (%). */
  apy: number;
  /** Base APY (%) — null when the source omits it. */
  apyBase: number | null;
  /** Reward APY (%) — null when the source omits it. */
  apyReward: number | null;
  /** Pool TVL in USD. */
  tvlUsd: number;
  /** DefiLlama pool id (UUID) — keys the outbound pool link. */
  poolId: string;
  stablecoin: boolean;
  /** Project icon URL (DefiLlama, from the project slug) — null when not resolvable. */
  image: string | null;
  /** Outbound DefiLlama pool URL. */
  url: string;
}

/** A Sui protocol ranked by its Sui-chain TVL slice (DefiLlama SDK). */
export interface TvlItem {
  name: string;
  /** DefiLlama protocol slug — keys the outbound protocol link. */
  slug: string;
  category: string;
  /** Sui-chain TVL slice in USD. */
  tvlSui: number;
  /** Protocol icon URL (DefiLlama) — null when absent (card renders a fallback). */
  image: string | null;
  /** Outbound DefiLlama protocol URL. */
  url: string;
}

/** A trending Sui token (CoinGecko markets; GeckoTerminal supplement). */
export interface TokenItem {
  /** CoinGecko coin id (e.g. "sudeng") — keys the outbound CoinGecko link. */
  id: string;
  symbol: string;
  name: string;
  /** Logo URL — null when the source omits it (card renders a fallback). */
  image: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
  /** Primary outbound link. */
  coingeckoUrl: string;
  /** Secondary outbound link (explorer / DEX) — null when not resolvable. */
  explorerUrl: string | null;
  /** Attribution source ("CoinGecko" / "GeckoTerminal"). */
  source: string;
}

/**
 * Fail-soft envelope. On success: `items` + attribution (`asOf`, `source`),
 * with `stale: true` when a transient source error forced a last-good serve.
 * On total failure (no value ever cached): `{ unavailable, reason }`.
 */
export type EcosystemEnvelope<T> =
  | { asOf: string; source: string; items: T[]; stale?: boolean }
  | { unavailable: true; reason: string };

/** Internal cached payload — carries the original fetch time so a stale serve
 *  reports the real "as of" (not the time it was re-served). */
export interface CachedDataset<T> {
  items: T[];
  asOf: string;
}
