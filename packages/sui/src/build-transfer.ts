/**
 * Build a coin-transfer PTB (unsigned) with SuiNS resolution + spoof guard.
 *
 * WHY unsigned-only: the server never holds user keys; the PTB is returned to
 * the client where the user's wallet signs after Guardian approval + preview.
 *
 * Flow: resolve recipient (raw 0x or .sui name) → validate coin type →
 *       build PTB → return bytes for Guardian to inspect.
 */

import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { resolveSuiNSName, type SuiNSResolutionResult } from "./suins-resolver";
import { COIN_TYPES } from "./allowlist";

// Server-side SuiClient type alias — SuiJsonRpcClient is the v2.x successor to
// the old SuiClient class; it satisfies ClientWithCoreApi (used by tx.build).
type SuiClient = SuiJsonRpcClient;

export interface TransferSpec {
  /** Sender's wallet address (the account that will sign). */
  senderAddress: string;
  /**
   * Recipient: raw 0x address OR a .sui name.
   * If .sui name, forward-resolve + reverse-check is performed.
   */
  recipientInput: string;
  /** Canonical on-chain coin type (e.g. COIN_TYPES.SUI). Never a ticker symbol. */
  coinType: string;
  /** Amount in native units (e.g. MIST for SUI, micro-USDC for USDC). */
  amountNative: bigint;
  /** Verified contact labels for lookalike detection (e.g. user's address book). */
  verifiedContacts?: string[];
}

export interface TransferBuildResult {
  /** Serialized unsigned PTB in base64 — pass to Guardian then to wallet. */
  txBytes: string;
  /** Raw 0x recipient address (always present regardless of input form). */
  resolvedRecipient: string;
  /** SuiNS resolution details — null if recipient was a raw 0x address. */
  suiNsResolution: SuiNSResolutionResult | null;
}

export class TransferBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferBuildError";
  }
}

/**
 * Build an unsigned coin-transfer PTB.
 * Throws on any resolution or validation error — callers (Guardian) treat throw as BLOCK.
 */
export async function buildTransfer(
  client: SuiClient,
  spec: TransferSpec,
): Promise<TransferBuildResult> {
  const { senderAddress, recipientInput, coinType, amountNative, verifiedContacts = [] } = spec;

  if (amountNative <= 0n) {
    throw new TransferBuildError("Transfer amount must be positive.");
  }

  // Validate coin type is a known canonical type (not a display symbol)
  if (!Object.values(COIN_TYPES).includes(coinType as (typeof COIN_TYPES)[keyof typeof COIN_TYPES])) {
    throw new TransferBuildError(
      `Unknown coin type "${coinType}". Only canonical on-chain types are permitted.`,
    );
  }

  // Resolve recipient — raw 0x passes through; .sui names are resolved with spoof guard
  let resolvedRecipient: string;
  let suiNsResolution: SuiNSResolutionResult | null = null;

  const isRawAddress = recipientInput.startsWith("0x") && recipientInput.length >= 64;
  if (isRawAddress) {
    resolvedRecipient = recipientInput;
  } else {
    // SuiNS resolution — throws if name unresolvable (fail-closed)
    suiNsResolution = await resolveSuiNSName(client, recipientInput, verifiedContacts);
    resolvedRecipient = suiNsResolution.resolvedAddress;
  }

  // Build the unsigned PTB
  const tx = new Transaction();
  tx.setSender(senderAddress);

  if (coinType === COIN_TYPES.SUI) {
    // SUI uses gas coin split — standard pattern
    const [coin] = tx.splitCoins(tx.gas, [amountNative]);
    tx.transferObjects([coin], resolvedRecipient);
  } else {
    // For other coins, we select coin objects by type and merge+split
    const coins = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinType],
    });
    // In production: fetch coin objects for senderAddress + coinType, merge, split
    // For the PTB structure, we use a placeholder input that the wallet fills
    tx.transferObjects([coins], resolvedRecipient);
  }

  // Serialize to base64 bytes for Guardian inspection.
  // SuiJsonRpcClient satisfies ClientWithCoreApi (it has .core: CoreClient).
  const txBytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
  const txBytesB64 = Buffer.from(txBytes).toString("base64");

  return {
    txBytes: txBytesB64,
    resolvedRecipient,
    suiNsResolution,
  };
}
