"use client";

/**
 * Conversation content encryption (client-only). Seal-encrypts the serialized-messages JSON to
 * the owner's address so only their wallet can decrypt; the server stores the tagged ciphertext
 * opaquely. The identity is `normalizeSuiAddress(owner)` (the canonical 32-byte hex form) passed
 * to BOTH encrypt and the decrypt `seal_approve` PTB, so it always matches the Move policy's
 * `bcs::to_bytes(&sender)` — the single most important parity (see the Phase-4 round-trip test).
 */

import { Transaction } from "@mysten/sui/transactions";
import { fromHex, normalizeSuiAddress, toBase64, fromBase64 } from "@mysten/sui/utils";
import type { SessionKey, SealCompatibleClient } from "@mysten/seal";
import { getSealClient } from "./seal-client";
import { DEWLOCK_SEAL_PACKAGE_ID, SEAL_THRESHOLD } from "./seal-config";

/** Tags our ciphertext so the read path distinguishes it from legacy plaintext JSON records. */
const MAGIC = "dseal1:";

export function isSealCiphertext(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(MAGIC);
}

/** Seal-encrypt `jsonBytes` to `ownerAddress`. Returns a tagged base64 string. No signature needed. */
export async function encryptConversation(
  jsonBytes: Uint8Array,
  ownerAddress: string,
  suiClient: SealCompatibleClient,
): Promise<string> {
  const id = normalizeSuiAddress(ownerAddress);
  const client = getSealClient(suiClient);
  const { encryptedObject } = await client.encrypt({
    threshold: SEAL_THRESHOLD,
    packageId: DEWLOCK_SEAL_PACKAGE_ID,
    id,
    data: jsonBytes,
  });
  // `client.encrypt` also returns `key` (backup symmetric key) — intentionally discarded, never stored/logged.
  return MAGIC + toBase64(encryptedObject);
}

/** Decrypt a tagged ciphertext for `ownerAddress` using a live SessionKey (one signature/session). */
export async function decryptConversation(
  tagged: string,
  ownerAddress: string,
  sessionKey: SessionKey,
  suiClient: SealCompatibleClient,
): Promise<Uint8Array> {
  const ciphertext = fromBase64(tagged.slice(MAGIC.length));
  const id = normalizeSuiAddress(ownerAddress);
  const tx = new Transaction();
  tx.moveCall({
    target: `${DEWLOCK_SEAL_PACKAGE_ID}::seal_policy::seal_approve`,
    arguments: [tx.pure.vector("u8", fromHex(id))],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
  const client = getSealClient(suiClient);
  return client.decrypt({ data: ciphertext, sessionKey, txBytes });
}
