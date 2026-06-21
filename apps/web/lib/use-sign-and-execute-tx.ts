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
import { Transaction } from "@mysten/sui/transactions";
import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import { sha256HexBytes, WysiwysError } from "@dewlock/sui/sign";

/** base64 → bytes (browser-safe; no Buffer). */
function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Re-export so signing call sites import the hook + the error class from one place
// (and `instanceof WysiwysError` matches the exact class the hook throws).
export { WysiwysError };

export interface SignAndExecuteOptions {
  /** Called immediately before the wallet signs (use for loading state). */
  onBeforeSign?: () => void;
  /**
   * Guardian-approved digest over the TransactionKind (gas-agnostic). After the wallet
   * builds + signs (filling gas with FRESH coin versions), the hook re-derives the kind
   * from the signed bytes and asserts its digest === approvedDigest. A mismatch throws
   * WysiwysError (What You See Is What You Sign): if the programmable content changed
   * between Guardian approval and signing, we refuse. Gas/sender are intentionally NOT
   * part of the digest — that's exactly what lets the wallet supply a non-stale gas coin.
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
      // WYSIWYS assertion over the TransactionKind. `bytes` is the FULL TransactionData the
      // wallet built + signed (it added a fresh gas coin). Re-derive the gas-less kind from
      // it and compare to the Guardian-approved kind digest — so a wallet-chosen gas coin
      // can't trip the check, but any change to the programmable content still does.
      if (options?.approvedDigest) {
        const kindBytes = await Transaction.from(bytes).build({ onlyTransactionKind: true });
        const actualDigest = await sha256HexBytes(kindBytes);

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
    // A base64 string is the Guardian-approved gas-less TransactionKind. Reconstruct a
    // Transaction the wallet finalizes — it sets the sender and selects the gas coin at the
    // CURRENT version at sign time, so a single/​churning gas coin can't go stale between
    // build and sign. A Transaction object (legacy/standalone callers) is passed through.
    const transaction =
      typeof params.transaction === "string"
        ? Transaction.fromKind(b64ToBytes(params.transaction))
        : params.transaction;
    return mutateAsync({
      transaction: transaction as Parameters<typeof mutateAsync>[0]["transaction"],
    });
  }

  return { signAndExecute };
}
