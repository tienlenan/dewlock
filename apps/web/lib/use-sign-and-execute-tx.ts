"use client";

/**
 * React signing hook — wraps dapp-kit's useSignAndExecuteTransaction with the
 * WYSIWYS assertion: digest(signedBytes) must equal the Guardian-approved digest
 * before the wallet executes. A mutated PTB is refused at this boundary.
 *
 * WHY this lives in the app (not @dewlock/sui): @dewlock/sui is in Next's
 * serverExternalPackages (it holds the heavy server SDKs). A dapp-kit React hook
 * inside an externalized package resolves a DIFFERENT @mysten/dapp-kit context
 * instance during SSR than apps/web's provider stack → "Could not find
 * SuiClientContext". Keeping the hook in the app's own module graph makes it share
 * the exact provider context. The pure digest util + WysiwysError stay in the
 * package (framework-agnostic) and are imported here.
 */

import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import { sha256HexBytes, WysiwysError } from "@dewlock/sui/sign";

// Re-export so signing call sites import the hook + the error class from one place
// (and `instanceof WysiwysError` matches the exact class the hook throws).
export { WysiwysError };

export interface SignAndExecuteOptions {
  /** Called immediately before the wallet signs (use for loading state). */
  onBeforeSign?: () => void;
  /**
   * Guardian-approved digest from the prepareTrade tool result.
   * When provided, the hook asserts digest(ptbBytes) === approvedDigest before
   * calling mutateAsync. A mismatch throws WysiwysError (What You See Is What You
   * Sign): if the bytes changed between approval and signing, we refuse.
   */
  approvedDigest?: string;
}

/**
 * Drop-in hook for signing a Guardian-approved PTB and executing it on-chain.
 * Asserts WYSIWYS digest equality before the wallet prompt when approvedDigest is set.
 *
 * Usage:
 *   const { signAndExecute } = useSignAndExecuteTx({ approvedDigest });
 *   const result = await signAndExecute({ transaction: tx });
 */
export function useSignAndExecuteTx(options?: SignAndExecuteOptions) {
  const client = useSuiClient();
  const { mutateAsync } = useSignAndExecuteTransaction<SuiTransactionBlockResponse>({
    execute: async ({ bytes, signature }) => {
      // WYSIWYS assertion: verify PTB digest before execution.
      // `bytes` is the base64-encoded PTB the wallet will sign.
      if (options?.approvedDigest) {
        const rawBytes = Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0));
        const actualDigest = await sha256HexBytes(rawBytes);

        if (actualDigest !== options.approvedDigest) {
          throw new WysiwysError(options.approvedDigest, actualDigest);
        }
      }

      return client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      });
    },
  });

  async function signAndExecute(params: {
    transaction: { toJSON: () => Promise<string> } | string;
  }): Promise<SuiTransactionBlockResponse> {
    options?.onBeforeSign?.();
    return mutateAsync({
      transaction: params.transaction as Parameters<typeof mutateAsync>[0]["transaction"],
    });
  }

  return { signAndExecute };
}
