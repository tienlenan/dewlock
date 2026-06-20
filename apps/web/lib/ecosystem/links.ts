/**
 * Outbound link builders for the ecosystem cards. Pure functions; each VALIDATES
 * the id/slug it embeds ([A-Za-z0-9-_] / canonical 0x coinType) so a source-
 * provided value can never inject a crafted URL — on a malformed id we fall back
 * to the source's safe landing page. URL formats verified against the research
 * report (defillama.com/protocol/{slug}, /yields/pool/{id}, coingecko.com/en/coins/{id}).
 */

const SLUG_RE = /^[A-Za-z0-9._-]+$/;
const POOL_ID_RE = /^[A-Za-z0-9-]+$/;
const COIN_ID_RE = /^[a-z0-9-]+$/i;
// Canonical Sui coin type: 0x<hex>::module::TYPE
const COIN_TYPE_RE = /^0x[0-9a-fA-F]+::[A-Za-z0-9_]+::[A-Za-z0-9_]+$/;

/** DefiLlama protocol page, keyed by slug. */
export function defillamaProtocol(slug: string): string {
  return SLUG_RE.test(slug)
    ? `https://defillama.com/protocol/${slug}`
    : defillamaChainSui();
}

/** DefiLlama yield-pool page, keyed by pool id (UUID). */
export function defillamaPool(poolId: string): string {
  return POOL_ID_RE.test(poolId)
    ? `https://defillama.com/yields/pool/${poolId}`
    : defillamaYields();
}

/** DefiLlama protocol icon, keyed by protocol slug — null when malformed. The
 *  yields /pools `project` field is this same slug namespace as the TVL `logo`. */
export function defillamaProtocolIcon(slug: string): string | null {
  return SLUG_RE.test(slug) ? `https://icons.llamao.fi/icons/protocols/${slug}` : null;
}

/** DefiLlama Sui chain overview (case-sensitive "Sui"). */
export function defillamaChainSui(): string {
  return "https://defillama.com/chain/Sui";
}

/** DefiLlama yields landing page. */
export function defillamaYields(): string {
  return "https://defillama.com/yields";
}

/** CoinGecko coin page, keyed by coin id. */
export function coingeckoCoin(id: string): string {
  return COIN_ID_RE.test(id)
    ? `https://www.coingecko.com/en/coins/${id}`
    : coingeckoSuiMemeCategory();
}

/** CoinGecko Sui-meme category page (the "View all" footer link). */
export function coingeckoSuiMemeCategory(): string {
  return "https://www.coingecko.com/en/categories/sui-meme";
}

/** SuiVision coin page, keyed by canonical coin type — null when not resolvable. */
export function suivisionCoin(coinType: string): string | null {
  return COIN_TYPE_RE.test(coinType) ? `https://suivision.xyz/coin/${coinType}` : null;
}

/** GeckoTerminal pool page, keyed by pool address (best-effort fallback rows). */
export function geckoterminalPool(poolAddress: string): string | null {
  return /^0x[0-9a-fA-F]+$/.test(poolAddress)
    ? `https://www.geckoterminal.com/sui/pools/${poolAddress}`
    : null;
}
