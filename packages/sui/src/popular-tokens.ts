/**
 * Curated registry of popular Sui tokens with ON-CHAIN-VERIFIED coin types.
 *
 * Every non-allowlist address here was confirmed via CoinMetadata (the on-chain
 * symbol + decimals matched the expected symbol) — never hand-trusted. This is the
 * defense against the symbol-collision / scam-clone attack: a wrong address resolves
 * to a different symbol and is rejected before it can ever reach this list. Logo URLs
 * are the token's on-chain CoinMetadata iconUrl (or a stable CDN), HTTP-200 verified.
 *
 * `swappable` marks coin types that are ALSO in the Guardian allowlist (COIN_TYPES).
 * Resolution-only entries (swappable:false) exist so the copilot can answer/recognise
 * a token by symbol AND the portfolio can show its logo, but a value-move in a
 * non-allowlisted token still fail-closes at the Guardian — the mapping never widens
 * what can be swapped. To make one swappable: add it to COIN_TYPES + a price feed +
 * confirm a route, then flip the flag.
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
  // ── Swappable (in COIN_TYPES + the Guardian allowlist) — verified + priced + routable. ──
  { symbol: "SUI", coinType: COIN_TYPES.SUI, decimals: 9, swappable: true, logoUrl: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png" },
  { symbol: "USDC", coinType: COIN_TYPES.USDC, decimals: 6, swappable: true, logoUrl: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
  { symbol: "USDT", coinType: COIN_TYPES.USDT, decimals: 6, swappable: true, logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png" },
  { symbol: "DEEP", coinType: COIN_TYPES.DEEP, decimals: 6, swappable: true, logoUrl: "https://images.deepbook.tech/icon.svg" },
  { symbol: "WETH", coinType: COIN_TYPES.WETH, decimals: 8, swappable: true, logoUrl: "https://bridge-assets.sui.io/eth.png" },
  { symbol: "WBTC", coinType: COIN_TYPES.wBTC, decimals: 8, swappable: true, logoUrl: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png" },
  { symbol: "CETUS", coinType: "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS", decimals: 9, swappable: true, logoUrl: "https://assets.coingecko.com/coins/images/30256/small/cetus.png" },
  { symbol: "WAL", coinType: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL", decimals: 9, swappable: true, logoUrl: "https://www.walrus.xyz/wal-icon.svg" },
  { symbol: "NS", coinType: "0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS", decimals: 6, swappable: true, logoUrl: "https://token-image.suins.io/icon.svg" },
  { symbol: "BLUE", coinType: "0xe1b45a0e641b9955a20aa0ad1c1f4ad86aad8afb07296d4085e349a50e90bdca::blue::BLUE", decimals: 9, swappable: true, logoUrl: "https://bluefin.io/images/square.png" },

  // ── Liquid-staking SUI, DeFi governance/stables, and major memes — swappable. Each was
  //    promoted only after BOTH a CoinGecko USD feed AND a live Cetus-aggregator USDC route
  //    were verified, and the feed price matched the route's implied price (so the cap reads
  //    real market value). All are in COIN_TYPES; the Guardian fail-closes if a feed goes
  //    stale at sign time. ──
  { symbol: "haSUI", coinType: "0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d::hasui::HASUI", decimals: 9, swappable: true, logoUrl: "https://assets.haedal.xyz/logos/hasui.svg" },
  { symbol: "afSUI", coinType: "0xf325ce1300e8dac124071d3152c5c5ee6174914f8bc2161e88329cf579246efc::afsui::AFSUI", decimals: 9, swappable: true, logoUrl: "https://aftermath.finance/coins/afsui.svg" },
  { symbol: "vSUI", coinType: "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT", decimals: 9, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/33243/small/voloSUI_%283%29.png" },
  { symbol: "SCA", coinType: "0x7016aae72cfc67f2fadf55769c0a7dd54291a583b63051a5ed71081cce836ac6::sca::SCA", decimals: 9, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/34648/small/sca.png" },
  { symbol: "NAVX", coinType: "0xa99b8952d4f7d947ea77fe0ecdcc9e5fc0bcab2841d6e2a5aa00c3044e5544b5::navx::NAVX", decimals: 9, swappable: true, logoUrl: "https://arweave.net/FNGKLRGBS7D4lXxsmz4_F-xkMQs9DIRsTQT_q0Nn-iI" },
  { symbol: "BUCK", coinType: "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK", decimals: 9, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/33846/small/buck-icon.png" },
  { symbol: "AUSD", coinType: "0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD", decimals: 6, swappable: true, logoUrl: "https://static.agora.finance/ausd-token-icon.svg" },
  { symbol: "SEND", coinType: "0xb45fcfcc2cc07ce0702cc2d229621e046c906ef14d9b25e8e4d25f6e8763fef7::send::SEND", decimals: 6, swappable: true, logoUrl: "https://suilend-assets.s3.us-east-2.amazonaws.com/SEND/SEND.svg" },
  { symbol: "TURBOS", coinType: "0x5d1f47ea69bb0de31c313d7acf89b890dbb8991ea8e03c6c355171f84bb1ba4a::turbos::TURBOS", decimals: 9, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/30349/small/ggut-eKC_400x400.jpg" },
  // Verified Sui memes
  { symbol: "FUD", coinType: "0x76cb819b01abed502bee8a702b4c2d547532c12f25001c9dea795a5e631c26f1::fud::FUD", decimals: 5, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/33610/small/pug-head.png" },
  { symbol: "BLUB", coinType: "0xfa7ac3951fdca92c5200d468d31a365eb03b2be9936fde615e69f0c1274ad3a0::BLUB::BLUB", decimals: 2, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/39356/small/Frame_38.png" },
  { symbol: "LOFI", coinType: "0xf22da9a24ad027cccb5f2d496cbe91de953d363513db08a3a734d361c7c17503::LOFI::LOFI", decimals: 9, swappable: true, logoUrl: "https://i.ibb.co/fM8QZXh/LOFI-PFP.png" },
];

/** Stable memwal lines for the symbol→address mapping cache (one per token). */
export function popularTokenMemwalLines(): string[] {
  return POPULAR_TOKENS.map(
    (t) =>
      `token map: ${t.symbol} = ${t.coinType} | decimals:${t.decimals} | swappable:${t.swappable}`,
  );
}
