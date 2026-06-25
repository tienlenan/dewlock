/**
 * NAVI health-factor simulation — fail-closed wrapper around getSimulatedHealthFactor.
 *
 * WHY this lives in @dewlock/sui (not @dewlock/agent): it statically require()s the
 * esbuild-prebundled `../sdk-bundles/navi.cjs` and type-imports `@naviprotocol/lending`.
 * Both only resolve from this package (the bundle dir and the SDK dependency live here,
 * alongside build-lend.ts). Placing it in the agent package made the require() resolve to
 * a non-existent `packages/agent/sdk-bundles/` — so every simulation threw and every
 * borrow/withdraw blocked. The agent imports this via `@dewlock/sui/navi-hf-simulation`.
 *
 * WHY a dedicated module: the NAVI SDK's getSimulatedHealthFactor calls devInspect
 * against the live NAVI contracts (contract-authoritative, not a hand-rolled formula).
 * This wrapper enforces the FAIL-CLOSED contract: any throw, undefined, Infinity,
 * or NaN from the simulation is re-thrown so the caller (HF gate) treats it as BLOCK.
 *
 * WHY NOT getHealthFactor: getHealthFactor reads the current on-chain state (before
 * the action). We need the projected post-tx HF, which requires passing the pending
 * operation type + amount to getSimulatedHealthFactor so NAVI's contracts compute
 * the resulting collateral/debt ratio.
 *
 * The PoolOperator enum discriminant getSimulatedHealthFactor expects:
 *   Supply = 1, Withdraw = 2, Borrow = 3, Repay = 4
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

/** Operation discriminant values from the NAVI PoolOperator enum. */
export const NAVI_OP = {
  Supply: 1,
  Withdraw: 2,
  Borrow: 3,
  Repay: 4,
} as const;

export type NaviOpType = (typeof NAVI_OP)[keyof typeof NAVI_OP];

export interface NaviOperation {
  /** PoolOperator discriminant (1=Supply, 2=Withdraw, 3=Borrow, 4=Repay). */
  type: NaviOpType;
  /** Amount in native units (number — NAVI SDK uses number internally). */
  amount: number;
}

/**
 * Simulate the post-tx health factor using NAVI's own contracts (devInspect).
 * THROWS on any failure — callers must treat a throw as BLOCK (never swallow it).
 *
 * @param walletAddress  The signing wallet.
 * @param coinType       Canonical on-chain coin type being borrowed/withdrawn.
 * @param operation      The pending operation (type + amount).
 * @param suiClient      Live SuiClient for the devInspect call.
 * @returns The projected post-tx health factor (> 0 number).
 * @throws  On any network error, NAVI API failure, or unreadable result.
 */
export async function simulateNaviHealthFactor(
  walletAddress: string,
  coinType: string,
  operation: NaviOperation,
  suiClient?: SuiJsonRpcClient,
): Promise<number> {
  let navi: typeof import("@naviprotocol/lending");
  try {
    // STATIC require of the esbuild-prebundled CJS copy — same pattern as build-lend.ts,
    // so Next's tracer ships it in the serverless function. Resolves only from this package.
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    navi = require("../sdk-bundles/navi.cjs") as typeof import("@naviprotocol/lending");
  } catch (err) {
    throw new Error(
      `NAVI SDK unavailable — cannot compute post-tx health factor: ` +
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // getSimulatedHealthFactor(address, coinType, operations[], opts?)
  // The opts object can include a `client` field for the devInspect call.
  const opts = suiClient ? { client: suiClient as never } : undefined;

  let hf: number;
  try {
    hf = await (navi as unknown as {
      getSimulatedHealthFactor(
        address: string,
        coinType: string,
        operations: NaviOperation[],
        opts?: unknown,
      ): Promise<number>;
    }).getSimulatedHealthFactor(walletAddress, coinType, [operation], opts);
  } catch (err) {
    // Re-throw with context so the HF gate can surface a meaningful block reason.
    throw new Error(
      `NAVI health-factor simulation failed — cannot verify post-tx safety: ` +
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Validate the returned value — undefined, Infinity, NaN are unverified states.
  // A partial read that returns 0 is also suspect (NAVI never returns 0 for a healthy
  // position; 0 means something didn't parse). All → throw so the gate blocks.
  if (hf === undefined || hf === null || !isFinite(hf) || isNaN(hf)) {
    throw new Error(
      `NAVI health-factor simulation returned an unverifiable value (${hf}) — ` +
      `cannot confirm post-tx safety. Blocking (fail-closed).`,
    );
  }

  return hf;
}
