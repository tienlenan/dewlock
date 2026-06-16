/**
 * Hand-built (SDK-free) Wormhole Sui redeem PTB — `complete_transfer`.
 *
 * The source-chain lock/burn is wallet-driven (Wormhole Connect); the ONLY leg a
 * keyless server can own is this Sui-side redeem. We build it directly (no
 * @wormhole-foundation/sdk-sui, which hard-deps @mysten/sui v1) so the bytes are
 * exactly what the user signs (WYSIWYS), and the Guardian's bridge gates verify
 * the VAA + recipient before the user signs.
 *
 * [needs live-env]: the exact `complete_transfer` argument list (TokenBridgeState,
 * WormholeState, CoinMetadata, Clock object ids) must be pinned against the live
 * Wormhole Sui deployment before a mainnet redeem. The fixture path (demo/tests)
 * builds a placeholder PTB; the live path is best-effort and lazy.
 */

import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { WORMHOLE_WTT_PACKAGE } from "./../allowlist";

type SuiClient = SuiJsonRpcClient;

export const REDEEM_TARGET = `${WORMHOLE_WTT_PACKAGE}::complete_transfer::complete_transfer` as const;

export interface RedeemSpec {
  senderAddress: string;
  /** The signed VAA bytes (base64) authorizing the redeem. */
  vaaBase64: string;
  /** The Sui coin type being redeemed (must match the VAA's mapped asset). */
  coinType: string;
}

export interface RedeemBuildResult {
  txBytes: string;
  isFixture: boolean;
}

export class RedeemBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedeemBuildError";
  }
}

function isFixtureMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "fixture";
}

/**
 * Build the unsigned Sui redeem PTB. Throws RedeemBuildError on any error —
 * callers treat a throw as BLOCK.
 */
export async function buildRedeem(client: SuiClient, spec: RedeemSpec): Promise<RedeemBuildResult> {
  const { senderAddress, vaaBase64 } = spec;
  if (!vaaBase64) throw new RedeemBuildError("Missing VAA bytes for redeem.");

  if (isFixtureMode()) {
    const tx = new Transaction();
    tx.setSender(senderAddress);
    const [coin] = tx.splitCoins(tx.gas, [0n]);
    tx.mergeCoins(tx.gas, [coin]);
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: true };
  }

  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);
    const vaaBytes = Array.from(Buffer.from(vaaBase64, "base64"));
    // [needs live-env] complete_transfer also consumes shared state objects + Clock;
    // pin those object ids against the live deployment. The VAA bytes + coin type
    // arg are the WYSIWYS-critical inputs and are encoded here.
    tx.moveCall({
      target: REDEEM_TARGET,
      typeArguments: [spec.coinType],
      arguments: [tx.pure.vector("u8", vaaBytes)],
    });
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: false };
  } catch (err) {
    throw new RedeemBuildError(`Redeem PTB construction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
