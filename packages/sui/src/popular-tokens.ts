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

  // ── Established Sui tokens auto-discovered from the CoinGecko Sui token list, then EACH
  //    on-chain verified via suix_getCoinMetadata (symbol + decimals matched the listed
  //    address — the same anti-clone check as above). Most are swappable:false (recognition +
  //    logo only; a value-move fail-closes at the Guardian — not in COIN_TYPES). A handful of
  //    memes were promoted to swappable:true after adding COIN_TYPES + a live CoinGecko feed
  //    (price-oracle.idMap); their ROUTE is not pre-verified — the Guardian gates liquidity
  //    live (min-out + ≤5% price-impact; stale/missing feed fail-closes the cap). ──
  { symbol: "USDY", coinType: "0x960b531667636f39e85867775f52f6b1f220a058c4de786905bdf761e06a56bb::usdy::USDY", decimals: 6, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/31700/large/usdy_%281%29.png?1696530524" },
  { symbol: "FDUSD", coinType: "0xf16e6b723f242ec745dfd7634ad072c42d5c1d9ac9d62a39c381303eaa57693a::fdusd::FDUSD", decimals: 6, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/31079/large/FDUSD_icon_black.png?1731097953" },
  { symbol: "MAGMA", coinType: "0x9f854b3ad20f8161ec0886f15f4a1752bf75d22261556f14cc8d3a1c5d50e529::magma::MAGMA", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/71100/large/magma.png?1765796989" },
  { symbol: "XAUM", coinType: "0x9d297676e7a4b771ab023291377b2adfaa4938fb9080b8d12430e4b108b836a9::xaum::XAUM", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/51962/large/xaum_200px_logo_1x.png?1733560735" },
  { symbol: "BCE", coinType: "0x34d12f761847a05dfa33a1692440588f4b5f7f24be619334e29d74e083f5e64e::bce::BCE", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/70260/large/bitcastle_Logo_RGB_Blue_03.png?1761300014" },
  { symbol: "MMT", coinType: "0x35169bc93e1fddfcf3a82a9eae726d349689ed59e4b065369af8789fe59f8608::mmt::MMT", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/69899/large/4_icon_PFP_RGB.png?1762090516" },
  { symbol: "TRUTH", coinType: "0x0a48f85a3905cfa49a652bdb074d9e9fabad27892d54afaa5c9e0adeb7ac3cdf::swarm_network_token::SWARM_NETWORK_TOKEN", decimals: 8, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/69599/large/truth.png?1759208403" },
  { symbol: "US", coinType: "0xee962a61432231c2ede6946515beb02290cb516ad087bb06a731e922b2a5f57a::us::US", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/70693/large/us-icon.png?1763129786" },
  { symbol: "BLUAI", coinType: "0xf8bfaf1cfefdc539a00e0bc37213c8f339cb411a6b0c4c023ed92f36c68d0fb6::bluwhale_ai::BLUWHALE_AI", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/70201/large/bluwhale.png?1761018866" },
  { symbol: "SUIUSDE", coinType: "0x41d587e5336f1c86cad50d38a7136db99333bb9bda91cea4ba69115defeb1402::sui_usde::SUI_USDE", decimals: 6, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/102172002/large/suiusdecorrect.png?1770891184" },
  { symbol: "ETHIRD", coinType: "0x89b0d4407f17cc1b1294464f28e176e29816a40612f7a553313ea0a797a5f803::ethird::ETHIRD", decimals: 6, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/102172295/large/ember_third_eye.jpg?1772682778" },
  { symbol: "ALPHA", coinType: "0xfe3afec26c59e874f3c1d60b8203cb3852d2bb2aa415df9548b8d688e6683f93::alpha::ALPHA", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/39087/large/Alpha_Logo_200_200.png?1720460811" },
  { symbol: "IKA", coinType: "0x7262fb2f7a3a14c888c438a3cd9b912469a58cf60f367352c46584262e8299aa::ika::IKA", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/67598/large/ika.jpg?1753770879" },
  { symbol: "SWEAT", coinType: "0xf0b202ef3e107ff4fc0142bbb9a607bf73b8f6460c5026d5c21c6f2e0a9a1083::coin::COIN", decimals: 8, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/25057/large/Sweat_-_logo-nov-2025.png?1762411781" },
  { symbol: "AIA", coinType: "0x99cc0e7834326ec6ac571421e9b8e042e9eb63062771c77ac592bd194180b5da::deagent_token::DEAGENT_TOKEN", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/69053/large/DA-AIA.png?1757348456" },
  { symbol: "TAKE", coinType: "0x76a49ebaf991fa2d4cb6a352af14425d453fe2ba6802b5ed2361b227150b6689::take::TAKE", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/68577/large/overtake.png?1756118725" },
  { symbol: "XAGM", coinType: "0x64bddec0f898ccaa022b8a6e0a5f75d80f53177b87a9795dd15aefe9ac12ee6c::xagm::XAGM", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/102172552/large/XAGM_icon.png?1773848751" },
  { symbol: "HAEDAL", coinType: "0x3a304c7feba2d819ea57c3542d68439ca2c386ba02159c740f7b406e592c62ea::haedal::HAEDAL", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/55420/large/haedal.jpg?1745917281" },
  { symbol: "DMC", coinType: "0x4c981f3ff786cdb9e514da897ab8a953647dae2ace9679e8358eec1e3e8871ac::dmc::DMC", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/66778/large/DMC_Token_Icon_Black.png?1750490833" },
  { symbol: "XMN", coinType: "0x97c7571f4406cdd7a95f3027075ab80d3e9c937c2a567690d31e14ab1872ccee::xmn::XMN", decimals: 6, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/69065/large/xmn-token-3000w.png?1757412455" },
  { symbol: "LWA", coinType: "0x3332b178c1513f32bca9cf711b0318c2bca4cb06f1a74211bac97a1eeb7f7259::LWA::LWA", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/12252/large/lwa.jpeg?1716452759" },
  { symbol: "MIU", coinType: "0x32a976482bf4154961bf20bfa3567a80122fdf8e8f8b28d752b609d8640f7846::miu::MIU", decimals: 3, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/54420/large/miu_200_blue.png?1739602159" },
  { symbol: "TATO", coinType: "0x04deb377c33bfced1ab81cde96918e2538fe78735777150b0064ccf7df5e1c81::tato::TATO", decimals: 9, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/70687/large/TATO-Token-transparent-200x200px.png?1769615505" },
  { symbol: "HIPPO", coinType: "0x8993129d72e733985f7f1a00396cbd055bad6f817fee36576ce483c8bbb8b87b::sudeng::SUDENG", decimals: 9, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/50450/large/sudeng.png?1753214629" },
  { symbol: "EEARN", coinType: "0x34469c8accdd673df02600265cbbad3688577f0e716866e257f88d448d463492::eearn::EEARN", decimals: 6, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/102172278/large/ember_earn.jpg?1772596945" },
  { symbol: "MEMEFI", coinType: "0x506a6fc25f1c7d52ceb06ea44a3114c9380f8e2029b4356019822f248b49e411::memefi::MEMEFI", decimals: 9, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/51175/large/memefi.png?1730289107" },
  { symbol: "PANS", coinType: "0xc9523f683256502be15ec4979098d510f67b6d3f0df02eebf124515014433270::pans::PANS", decimals: 9, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/67541/large/Logo.jpg?1775468005" },
  { symbol: "BALN", coinType: "0x3ae6be8e58c0e0715764971b750709e67c6de33e38bbecafe25b5f3dd5080a39::balanced_token::BALANCED_TOKEN", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/15303/large/balance_tokens.png?1696514953" },
  { symbol: "AXOL", coinType: "0xf00eb7ab086967a33c04a853ad960e5c6b0955ef5a47d50b376d83856dc1215e::axol::AXOL", decimals: 9, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/50412/large/AXOL.png?1727667274" },
  { symbol: "ATTN", coinType: "0x0ef38abcdaaafedd1e2d88929068a3f65b59bf7ee07d7e8f573c71df02d27522::attn::ATTN", decimals: 6, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/56075/large/attn_png_CMC.png?1748344466" },
  { symbol: "WARPED", coinType: "0x50c9c77f29de11a2abdbe60e0869a026dc47c94bfc4e7d461c80313b079d44d2::warped::WARPED", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/33307/large/WarpedGames_Logo_Main_Isotype_Color-TransparentBG.png?1763209428" },
  { symbol: "ALKIMI", coinType: "0x1a8f4bc33f8ef7fbc851f156857aa65d397a6a6fd27a7ac2ca717b51f2fd9489::alkimi::ALKIMI", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/68374/large/Token_circle.png?1755523677" },
  { symbol: "BUT", coinType: "0xbc858cb910b9914bee64fff0f9b38855355a040c49155a17b265d9086d256545::but::BUT", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/53585/large/BUT_logo.png?1736792424" },
  { symbol: "FLX", coinType: "0x6dae8ca14311574fdfe555524ea48558e3d1360d1607d1c7f98af867e3b7976c::flx::FLX", decimals: 8, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/33317/large/logo_flx.png?1701435649" },
  { symbol: "MANIFEST", coinType: "0xc466c28d87b3d5cd34f3d5c088751532d71a38d93a8aae4551dd56272cfb4355::manifest::MANIFEST", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/68309/large/Untitled_design_%2868%29.png?1758713257" },
  { symbol: "UP", coinType: "0x87dfe1248a1dc4ce473bd9cb2937d66cdc6c30fee63f3fe0dbb55c7a09d35dec::up::UP", decimals: 6, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/55718/large/Diamond_Only_200x200.png?1747209511" },
  { symbol: "CHIRP", coinType: "0x1ef4c0b20340b8c6a59438204467ca71e1e7cbe918526f9c2c6c5444517cd5ca::chirp::CHIRP", decimals: 10, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/52894/large/Chirp_Icon_Round1.png?1734608014" },
  { symbol: "AAA", coinType: "0xd976fda9a9786cda1a36dee360013d775a5e5f206f8e20f84fad3385e99eeb2d::aaa::AAA", decimals: 6, swappable: true, logoUrl: "https://coin-images.coingecko.com/coins/images/50318/large/aaaCat_200x200.png?1727129223" },
  { symbol: "SUAI", coinType: "0xbc732bc5f1e9a9f4bdf4c0672ee538dbf56c161afe04ff1de2176efabdf41f92::suai::SUAI", decimals: 6, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/52807/large/suag_logo.png?1734360654" },
  { symbol: "ARTFI", coinType: "0x706fa7723231e13e8d37dad56da55c027f3163094aa31c867ca254ba0e0dc79f::artfi::ARTFI", decimals: 9, swappable: false, logoUrl: "https://coin-images.coingecko.com/coins/images/38242/large/ARTFI_TOKEN_200_200.png?1716968882" },
];

/** Stable memwal lines for the symbol→address mapping cache (one per token). */
export function popularTokenMemwalLines(): string[] {
  return POPULAR_TOKENS.map(
    (t) =>
      `token map: ${t.symbol} = ${t.coinType} | decimals:${t.decimals} | swappable:${t.swappable}`,
  );
}
