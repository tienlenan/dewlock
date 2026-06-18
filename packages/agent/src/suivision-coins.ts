/**
 * SuiVision (BlockVision) account-coins fetcher.
 *
 * Powers the portfolio / assets list with the same enriched coin data shown on
 * suivision.xyz — verified flag, logo (avatar), unit price, and USD value — in a
 * single call, which plain Sui RPC cannot provide (no price, no verified flag).
 *
 * Server-only: reads BLOCKVISION_API_KEY. NEVER expose the key to the browser
 * (no NEXT_PUBLIC_*) and never commit it. Returns null when no key is set so the
 * caller can fall back to the plain-RPC portfolio path.
 *
 * Display-only: the prices here feed the portfolio VIEW. The Guardian's spend-cap
 * gate keeps its own trusted price source (getTrustedUsdPrice) — market prices
 * from a third party must never drive value-moving enforcement.
 */

const BLOCKVISION_COINS_URL = "https://api.blockvision.org/v2/sui/account/coins";

export interface SuiVisionCoin {
  coinType: string;
  name: string;
  symbol: string;
  decimals: number;
  /** Native-unit balance (integer string, e.g. MIST for SUI). */
  balance: string;
  verified: boolean;
  scam: boolean;
  isLpToken: boolean;
  /** Token logo / avatar URL ("" when none). */
  logo: string;
  /** USD value of the held balance. */
  usdValue: number;
  /** Unit price in USD. */
  price: number;
}

export class SuiVisionFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuiVisionFetchError";
  }
}

// The Sui Indexing API (account/coins) is a PRO-tier BlockVision product. On a
// free/trial key it returns 403 (code -32609 "trial used" / -32002 "invalid apikey").
// Once we see that, disable the path for the process so we don't waste a call +
// log noise on every portfolio fetch — the plain-RPC portfolio path takes over.
// (Free BlockVision keys still work as an RPC node via SUI_RPC_URL.)
let indexingDisabled = false;
const PRO_GATED_CODES = new Set([-32609, -32002]);

/**
 * Fetch a wallet's coins from BlockVision's (Pro-tier) Sui Indexing API.
 * @returns coin array, or null when no key / the indexing API is unavailable
 *   (free tier) — the caller then uses the plain-RPC portfolio path.
 * @throws SuiVisionFetchError only on transient errors (caller falls back per-call).
 */
export async function fetchSuiVisionCoins(
  address: string,
): Promise<SuiVisionCoin[] | null> {
  const apiKey = process.env.BLOCKVISION_API_KEY?.trim();
  if (!apiKey || indexingDisabled) return null;

  const url = `${BLOCKVISION_COINS_URL}?account=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "x-api-key": apiKey },
  });

  // Parse the body even on !ok — BlockVision returns a JSON {code,message} on 403.
  const json = (await res.json().catch(() => ({}))) as {
    code?: number;
    message?: string;
    result?: { coins?: unknown[] };
  };

  // Pro-tier gate / bad key → disable the indexing path quietly + use RPC fallback.
  if (PRO_GATED_CODES.has(json.code ?? 0) || res.status === 403) {
    indexingDisabled = true;
    console.info(
      `[suivision] indexing API unavailable on this key (${json.message ?? `HTTP ${res.status}`}); ` +
        "using plain-RPC portfolio. Set SUI_RPC_URL to a BlockVision RPC for higher limits.",
    );
    return null;
  }

  if (!res.ok) {
    throw new SuiVisionFetchError(`BlockVision HTTP ${res.status}`);
  }

  if (json.code !== 200 || !json.result?.coins) {
    throw new SuiVisionFetchError(
      json.message ?? `BlockVision returned code ${json.code}`,
    );
  }

  return (json.result.coins as Array<Record<string, unknown>>).map((c) => ({
    coinType: String(c.coinType ?? ""),
    name: String(c.name ?? ""),
    symbol: String(c.symbol ?? ""),
    decimals: Number(c.decimals ?? 9),
    balance: String(c.balance ?? "0"),
    verified: Boolean(c.verified),
    scam: Boolean(c.scam),
    isLpToken: Boolean(c.isLpToken),
    logo: String(c.logo ?? ""),
    usdValue: Number(c.usdValue ?? 0),
    price: Number(c.price ?? 0),
  }));
}
