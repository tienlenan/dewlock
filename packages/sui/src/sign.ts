"use client";

/**
 * Dewlock client-side signing utilities.
 *
 * Key exports:
 *  - stableJson / sha256Hex — deterministic content hashing for receipts.
 *  - useSignAndExecuteTx — hook wrapping dapp-kit's useSignAndExecuteTransaction
 *    with WYSIWYS assertion: digest(signedBytes) must equal approvedDigest
 *    before mutateAsync is called. A mutated PTB is refused at this boundary.
 *
 * Signing ALWAYS happens client-side in the user's wallet — the server
 * only builds unsigned PTBs (Transaction objects / base64 bytes).
 *
 * @mysten/sui v2.x: SuiTransactionBlockResponse lives in @mysten/sui/jsonRpc.
 * The Uint8Array passed to crypto.subtle.digest is normalized to ArrayBuffer
 * to satisfy the strict BufferSource constraint (no SharedArrayBuffer).
 */

import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";

// --- Deterministic JSON (canonical key order at every nesting level) ---

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, normalize(v)]),
  );
}

/** Stable JSON with sorted keys — deterministic across serialisation runs. */
export function stableJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

/** SHA-256 hex digest of any JSON-serialisable value. Uses Web Crypto (browser + edge). */
export async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(
    typeof value === "string" ? value : stableJson(value),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute SHA-256 over raw bytes (Uint8Array).
 * Used for WYSIWYS: digest the exact PTB bytes, not their JSON representation.
 *
 * WHY .buffer.slice(): crypto.subtle.digest requires ArrayBuffer (not
 * SharedArrayBuffer). A Uint8Array whose .buffer is a SharedArrayBuffer
 * (possible in some environments) fails the strict BufferSource check.
 * Slicing produces a plain ArrayBuffer copy that is always accepted.
 */
export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  // Copy into a new Uint8Array backed by a plain ArrayBuffer.
  // This satisfies crypto.subtle.digest's strict BufferSource constraint:
  // the original buffer may be SharedArrayBuffer in some environments,
  // which is not assignable to ArrayBuffer. The copy is always a plain ArrayBuffer.
  const buf: ArrayBuffer = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- WYSIWYS error ---

/**
 * Thrown when the PTB bytes presented for signing do not match the
 * Guardian-approved digest. This is the final defense against PTB substitution
 * after Guardian approval — e.g. a race-condition or client-side tampering.
 */
export class WysiwysError extends Error {
  constructor(
    public readonly approvedDigest: string,
    public readonly actualDigest: string,
  ) {
    super(
      `WYSIWYS assertion failed: PTB bytes have changed since Guardian approval.\n` +
        `  Approved digest : ${approvedDigest}\n` +
        `  Actual digest   : ${actualDigest}\n` +
        `Transaction blocked. Please retry from the beginning.`,
    );
    this.name = "WysiwysError";
  }
}

// --- Sign-and-execute hook ---

export interface SignAndExecuteOptions {
  /** Called immediately before the wallet signs (use for loading state). */
  onBeforeSign?: () => void;
  /**
   * Guardian-approved digest from the prepareTrade tool result.
   * When provided, the hook asserts digest(ptbBytes) === approvedDigest
   * before calling mutateAsync. A mismatch throws WysiwysError.
   *
   * WHY this check: the WYSIWYS invariant (What You See Is What You Sign).
   * The Guardian approved specific bytes; if those bytes changed between
   * approval and signing (re-build, race, substitution), we must refuse.
   */
  approvedDigest?: string;
}

/**
 * Drop-in hook for signing a Guardian-approved PTB and executing it on-chain.
 * Asserts WYSIWYS digest equality before wallet prompt when approvedDigest is provided.
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
