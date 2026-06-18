/**
 * Blockberry account-coins fetcher — free-tier fallback for the enriched portfolio
 * when BlockVision's (Pro-only) indexing API is unavailable.
 *
 * Maps Blockberry's getCoinsByWallet response onto the shared SuiVisionCoin shape so
 * the portfolio builder is reused (DRY). Provides what plain RPC cannot: a verified
 * flag, a logo, and a live unit price.
 *
 * Server-only: reads BLOCKBERRY_API_KEY (never NEXT_PUBLIC_*; never commit). Returns
 * null when no key / auth fails so the caller falls back to the plain-RPC path.
 *
 * Display-only: prices feed the portfolio VIEW. The Guardian keeps its own trusted
 * price source (getTrustedUsdPrice) — third-party market prices never drive enforcement.
 *
 * Docs: https://docs.blockberry.one/reference/getcoinsbywallet
 *   GET https://api.blockberry.one/sui/v1/coins/wallet/{address}?page=0&size=100
 *   header x-api-key; content[] fields: coinType, coinSymbol, coinName, decimals,
 *   totalBalance, coinPrice, imgUrl, verified, securityMessage, bridged.
 */

import { SuiVisionFetchError, type SuiVisionCoin } from "./suivision-coins";

const BLOCKBERRY_WALLET_COINS_URL = "https://api.blockberry.one/sui/v1/coins/wallet";

// Disable for the process once the key is rejected (avoids per-fetch noise).
let blockberryDisabled = false;

/**
 * Convert Blockberry's `totalBalance` to a native-unit integer string.
 * [needs live-env] Blockberry's getAccountBalance documents `balance` as native; we
 * treat getCoinsByWallet `totalBalance` the same (Sui's CoinBalance.totalBalance is
 * native). A fractional value is defensively scaled by decimals in case it's human.
 */
function toNativeBalanceString(totalBalance: unknown, decimals: number): string {
  const n = Number(totalBalance ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0";
  const native = Number.isInteger(n) ? n : Math.round(n * 10 ** decimals);
  return String(native);
}

/**
 * Fetch a wallet's coins from Blockberry.
 * @returns coin array, or null when no key / auth failure (caller uses RPC fallback).
 * @throws SuiVisionFetchError only on transient errors.
 */
export async function fetchBlockberryCoins(
  address: string,
): Promise<SuiVisionCoin[] | null> {
  const apiKey = process.env.BLOCKBERRY_API_KEY?.trim();
  if (!apiKey || blockberryDisabled) return null;

  const url = `${BLOCKBERRY_WALLET_COINS_URL}/${encodeURIComponent(address)}?page=0&size=100`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "x-api-key": apiKey },
  });

  const json = (await res.json().catch(() => ({}))) as {
    content?: Array<Record<string, unknown>>;
  };

  // Auth/forbidden → disable quietly + fall back to RPC.
  if (res.status === 401 || res.status === 403) {
    blockberryDisabled = true;
    console.info("[blockberry] key rejected — using plain-RPC portfolio fallback.");
    return null;
  }
  if (!res.ok) {
    throw new SuiVisionFetchError(`Blockberry HTTP ${res.status}`);
  }
  if (!Array.isArray(json.content)) return null;

  return json.content.map((c): SuiVisionCoin => {
    const decimals = Number(c.decimals ?? 9);
    const balance = toNativeBalanceString(c.totalBalance, decimals);
    const price = Number(c.coinPrice ?? 0);
    const human = Number(balance) / 10 ** decimals;
    return {
      coinType: String(c.coinType ?? ""),
      name: String(c.coinName ?? ""),
      symbol: String(c.coinSymbol ?? ""),
      decimals,
      balance,
      verified: Boolean(c.verified),
      // A non-empty security warning marks the coin as scam/suspicious.
      scam: typeof c.securityMessage === "string" && c.securityMessage.trim().length > 0,
      isLpToken: false,
      logo: String(c.imgUrl ?? ""),
      usdValue: Number.isFinite(price) ? human * price : 0,
      price: Number.isFinite(price) ? price : 0,
    };
  });
}
