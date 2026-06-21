/**
 * lending-positions.ts — read-only NAVI lending state for the positions UI.
 *
 * Lives in @dewlock/sui (not the agent package) because it STATIC-requires the
 * esbuild-prebundled NAVI CJS copy (sdk-bundles/navi.cjs) via a relative path —
 * the same pattern build-lend.ts uses so Next's tracer ships the SDK in the
 * serverless function (a bare/dynamic import would not resolve at runtime).
 *
 * Read-only: returns the user's SUPPLIED amounts + health factor. Supply and
 * health are read independently (Promise.allSettled) so one failing read degrades
 * only its half. `getHealthFactor` is the read build-lend.ts already relies on;
 * `getLendingPositions` provides the supplied rows (USD-priced by the SDK).
 */

export interface NaviSuppliedRow {
  coinType: string;
  symbol: string;
  /** Supplied amount in human units (SDK-scaled). */
  amount: number;
  /** USD value of the supplied amount (SDK price map). */
  valueUsd: number;
}

export interface NaviLendingRead {
  supplied: NaviSuppliedRow[];
  /** Account health factor (>1 is safe); null when unavailable or no debt. */
  healthFactor: number | null;
}

/**
 * Read NAVI supplied positions + health factor for a wallet. Best-effort per half:
 * a failed positions read still returns the health factor and vice-versa. Throws
 * only if the SDK itself cannot be loaded (the caller wraps this in allSettled).
 */
export async function readNaviLending(address: string): Promise<NaviLendingRead> {
  let navi: typeof import("@naviprotocol/lending");
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    navi = require("../sdk-bundles/navi.cjs") as typeof import("@naviprotocol/lending");
  } catch (err) {
    throw new Error(`Failed to load NAVI SDK: ${err instanceof Error ? err.message : String(err)}`);
  }

  const [positionsRes, healthRes] = await Promise.allSettled([
    navi.getLendingPositions(address),
    navi.getHealthFactor(address),
  ]);

  const supplied: NaviSuppliedRow[] = [];
  if (positionsRes.status === "fulfilled") {
    for (const p of positionsRes.value) {
      const s = p["navi-lending-supply"];
      if (s && Number(s.amount) > 0) {
        supplied.push({
          coinType: s.token.coinType,
          symbol: s.token.symbol,
          amount: Number(s.amount),
          valueUsd: Number(s.valueUSD),
        });
      }
    }
  }

  const healthFactor =
    healthRes.status === "fulfilled" && Number.isFinite(healthRes.value) ? healthRes.value : null;

  return { supplied, healthFactor };
}
