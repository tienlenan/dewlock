/**
 * Curated registry of popular Sui tokens with ON-CHAIN-VERIFIED coin types.
 *
 * Every non-allowlist address here was confirmed via CoinMetadata (the on-chain
 * symbol + decimals matched the expected symbol) — never hand-trusted. This is the
 * defense against the symbol-collision / scam-clone attack: a wrong address resolves
 * to a different symbol and is rejected before it can ever reach this list.
 *
 * `swappable` marks coin types that are ALSO in the Guardian allowlist (COIN_TYPES).
 * Resolution-only entries (swappable:false) exist so the copilot can answer/recognise
 * a token by symbol, but a value-move in a non-allowlisted token still fail-closes at
 * the Guardian — the mapping never widens what can be swapped.
 *
 * Memes (BLUB, LOFI, Suiyan, AAA Cat, …) are intentionally absent until their mainnet
 * addresses are supplied + verified the same way — resolving a meme by ticker is unsafe.
 */

import { COIN_TYPES } from "./protocol-constants";

export interface PopularToken {
  symbol: string;
  coinType: string;
  decimals: number;
  /** true when the type is also in the Guardian swap allowlist (COIN_TYPES). */
  swappable: boolean;
  /** Display-only logo URL (HTTP-200 verified). Absent → the UI shows ticker initials. */
  logoUrl?: string;
}

export const POPULAR_TOKENS: readonly PopularToken[] = [
  // Allowlisted (swappable) — already in COIN_TYPES + verified. Logo URLs HTTP-200 verified.
  { symbol: "SUI", coinType: COIN_TYPES.SUI, decimals: 9, swappable: true, logoUrl: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png" },
  { symbol: "USDC", coinType: COIN_TYPES.USDC, decimals: 6, swappable: true, logoUrl: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
  { symbol: "USDT", coinType: COIN_TYPES.USDT, decimals: 6, swappable: true, logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png" },
  { symbol: "DEEP", coinType: COIN_TYPES.DEEP, decimals: 6, swappable: true },
  { symbol: "WETH", coinType: COIN_TYPES.WETH, decimals: 8, swappable: true },
  { symbol: "WBTC", coinType: COIN_TYPES.wBTC, decimals: 8, swappable: true },
  // Promoted to swappable — on-chain CoinMetadata verified, each has a Pyth USD feed
  // (cap pricing) AND routes to USDC through the Cetus aggregator (verified live).
  { symbol: "CETUS", coinType: "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS", decimals: 9, swappable: true, logoUrl: "https://assets.coingecko.com/coins/images/30256/small/cetus.png" },
  { symbol: "WAL", coinType: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL", decimals: 9, swappable: true },
  { symbol: "NS", coinType: "0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS", decimals: 6, swappable: true },
  { symbol: "BLUE", coinType: "0xe1b45a0e641b9955a20aa0ad1c1f4ad86aad8afb07296d4085e349a50e90bdca::blue::BLUE", decimals: 9, swappable: true },
];

/** Stable memwal lines for the symbol→address mapping cache (one per token). */
export function popularTokenMemwalLines(): string[] {
  return POPULAR_TOKENS.map(
    (t) =>
      `token map: ${t.symbol} = ${t.coinType} | decimals:${t.decimals} | swappable:${t.swappable}`,
  );
}
