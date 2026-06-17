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

/**
 * Fetch a wallet's coins from BlockVision (SuiVision backend).
 * @returns coin array, or null when BLOCKVISION_API_KEY is unset (RPC fallback).
 * @throws SuiVisionFetchError on HTTP / API error (caller falls back to RPC).
 */
export async function fetchSuiVisionCoins(
  address: string,
): Promise<SuiVisionCoin[] | null> {
  const apiKey = process.env.BLOCKVISION_API_KEY;
  if (!apiKey) return null;

  const url = `${BLOCKVISION_COINS_URL}?account=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new SuiVisionFetchError(`BlockVision HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    code?: number;
    message?: string;
    result?: { coins?: unknown[] };
  };
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
