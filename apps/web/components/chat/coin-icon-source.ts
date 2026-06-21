/**
 * coin-icon-source — ordered icon-URL resolution for a coin, so a flaky CDN can
 * never strand a row on the text monogram (the "SUI logo loads sometimes" bug).
 *
 * CoinLogo tries the candidates in order, advancing on each <img> load error:
 *   1. Local app asset  — self-hosted under /logos/coins/<symbol>.<ext>. Served from
 *      our own origin: no rate limits, no CORS, no cold CDN — the only fully reliable
 *      source, and the real fix for the intermittent CoinGecko throttling.
 *   2. Curated remote logoUrl — the on-chain CoinMetadata / CoinGecko URL passed in.
 *   3. CoinGecko host swap — assets.coingecko.com ↔ coin-images.coingecko.com serve
 *      the same path; if one host is throttling, the other usually answers.
 *   4. (CoinLogo falls back to a tinted monogram when every candidate fails.)
 *
 * DeFiLlama's token-icon CDN does NOT serve Sui coins by address (verified 404), so
 * it is intentionally not in the chain — adding it would only add dead requests.
 */

// Self-hosted coin icons (downloaded from each token's canonical source into
// /public/logos/coins). Keyed by UPPERCASE symbol. Keep in sync with the logoUrl set
// in packages/sui popular-tokens.ts — add a coin's icon here when it's added there.
export const LOCAL_COIN_ICONS: Record<string, string> = {
  SUI: "/logos/coins/sui.png",
  USDC: "/logos/coins/usdc.png",
  USDT: "/logos/coins/usdt.png",
  DEEP: "/logos/coins/deep.svg",
  WETH: "/logos/coins/weth.png",
  WBTC: "/logos/coins/wbtc.png",
  CETUS: "/logos/coins/cetus.png",
  WAL: "/logos/coins/wal.svg",
  NS: "/logos/coins/ns.svg",
  BLUE: "/logos/coins/blue.png",
  HASUI: "/logos/coins/hasui.svg",
  AFSUI: "/logos/coins/afsui.svg",
  VSUI: "/logos/coins/vsui.png",
  SCA: "/logos/coins/sca.png",
  NAVX: "/logos/coins/navx.png",
  BUCK: "/logos/coins/buck.png",
  AUSD: "/logos/coins/ausd.svg",
  SEND: "/logos/coins/send.svg",
  TURBOS: "/logos/coins/turbos.jpg",
  FUD: "/logos/coins/fud.png",
  BLUB: "/logos/coins/blub.png",
  LOFI: "/logos/coins/lofi.png",
  // Resolution-only established Sui tokens (on-chain verified; recognition + display).
  USDY: "/logos/coins/usdy.png",
  FDUSD: "/logos/coins/fdusd.png",
  MAGMA: "/logos/coins/magma.png",
  XAUM: "/logos/coins/xaum.png",
  BCE: "/logos/coins/bce.png",
  MMT: "/logos/coins/mmt.png",
  TRUTH: "/logos/coins/truth.png",
  US: "/logos/coins/us.png",
  BLUAI: "/logos/coins/bluai.png",
  SUIUSDE: "/logos/coins/suiusde.png",
  ETHIRD: "/logos/coins/ethird.jpg",
  ALPHA: "/logos/coins/alpha.png",
  IKA: "/logos/coins/ika.jpg",
  SWEAT: "/logos/coins/sweat.png",
  AIA: "/logos/coins/aia.png",
  TAKE: "/logos/coins/take.png",
  XAGM: "/logos/coins/xagm.png",
  HAEDAL: "/logos/coins/haedal.jpg",
  DMC: "/logos/coins/dmc.png",
  XMN: "/logos/coins/xmn.png",
  LWA: "/logos/coins/lwa.jpg",
  MIU: "/logos/coins/miu.png",
  TATO: "/logos/coins/tato.png",
  HIPPO: "/logos/coins/hippo.png",
  EEARN: "/logos/coins/eearn.jpg",
  MEMEFI: "/logos/coins/memefi.png",
  PANS: "/logos/coins/pans.jpg",
  BALN: "/logos/coins/baln.png",
  AXOL: "/logos/coins/axol.png",
  ATTN: "/logos/coins/attn.png",
  WARPED: "/logos/coins/warped.png",
  ALKIMI: "/logos/coins/alkimi.png",
  BUT: "/logos/coins/but.png",
  FLX: "/logos/coins/flx.png",
  MANIFEST: "/logos/coins/manifest.png",
  UP: "/logos/coins/up.png",
  CHIRP: "/logos/coins/chirp.png",
  AAA: "/logos/coins/aaa.png",
  SUAI: "/logos/coins/suai.png",
  ARTFI: "/logos/coins/artfi.png",
};

/** assets.coingecko.com ↔ coin-images.coingecko.com — the same image on either host. */
function coinGeckoHostSwap(url: string): string | null {
  if (url.includes("assets.coingecko.com")) {
    return url.replace("assets.coingecko.com", "coin-images.coingecko.com");
  }
  if (url.includes("coin-images.coingecko.com")) {
    return url.replace("coin-images.coingecko.com", "assets.coingecko.com");
  }
  return null;
}

/**
 * Build the ordered, de-duped list of icon URLs to try for a coin. Empty when there
 * is neither a local asset nor a remote URL → the caller shows a monogram.
 */
export function resolveCoinIconCandidates(symbol?: string, logoUrl?: string | null): string[] {
  const out: string[] = [];
  const local = symbol ? LOCAL_COIN_ICONS[symbol.toUpperCase()] : undefined;
  if (local) out.push(local);
  if (logoUrl) {
    out.push(logoUrl);
    const alt = coinGeckoHostSwap(logoUrl);
    if (alt) out.push(alt);
  }
  return [...new Set(out)];
}
