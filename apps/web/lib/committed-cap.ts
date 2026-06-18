/**
 * Committed-cap derivation — single source for the user's risk cap shown in the
 * memory chip + persisted to memwal. The cap mirrors the SERVER-AUTHORITATIVE
 * Guardian caps (TX_USD_CAP / DAILY_USD_CAP) the wallet actually operates under.
 *
 * Entry format matches the conviction-streak parser (parseCapFromMemory):
 *   "risk cap: $X/tx, $Y/day; risk profile: <label>"
 */

/** Derive a risk-profile label from the per-tx cap size. */
export function riskProfileFor(txUsdCap: number): string {
  if (txUsdCap <= 100) return "conservative";
  if (txUsdCap <= 1000) return "balanced";
  return "aggressive";
}

export interface CommittedCap {
  txUsd: number;
  dailyUsd: number;
  profile: string;
  /** Canonical memwal entry string. */
  entry: string;
}

/** The committed cap derived from the server-enforced cap env vars (null if invalid). */
export function envCommittedCap(): CommittedCap | null {
  const txUsd = parseFloat(process.env.TX_USD_CAP ?? "5000");
  const dailyUsd = parseFloat(process.env.DAILY_USD_CAP ?? "20000");
  if (!Number.isFinite(txUsd) || !Number.isFinite(dailyUsd)) return null;
  const profile = riskProfileFor(txUsd);
  return {
    txUsd,
    dailyUsd,
    profile,
    entry: `risk cap: $${txUsd}/tx, $${dailyUsd}/day; risk profile: ${profile}`,
  };
}
