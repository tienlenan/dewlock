"use client";

/**
 * SessionKey manager. One wallet personal-message signature creates a session-scoped key that
 * unlocks many decrypts (no signer baked in — we sign via dapp-kit's useSignPersonalMessage,
 * the same prompt the app already uses for memory/contacts). Cached per address IN MEMORY only
 * (dies on reload, by design). TTL covers a realistic session; on expiry the next decrypt
 * transparently re-creates + re-prompts.
 */

import { SessionKey, type SealCompatibleClient } from "@mysten/seal";
import { DEWLOCK_SEAL_PACKAGE_ID } from "./seal-config";

const TTL_MIN = 30;

type SignPersonalMessage = (input: { message: Uint8Array }) => Promise<{ signature: string }>;

const sessions = new Map<string, SessionKey>();

/** Return a live SessionKey for `address`, creating + signing one if absent/expired (one prompt). */
export async function ensureSessionKey(
  address: string,
  suiClient: SealCompatibleClient,
  signPersonalMessage: SignPersonalMessage,
): Promise<SessionKey> {
  const existing = sessions.get(address);
  if (existing && !existing.isExpired()) return existing;

  const sk = await SessionKey.create({
    address,
    packageId: DEWLOCK_SEAL_PACKAGE_ID,
    ttlMin: TTL_MIN,
    suiClient,
  });
  const { signature } = await signPersonalMessage({ message: sk.getPersonalMessage() });
  await sk.setPersonalMessageSignature(signature);
  sessions.set(address, sk);
  return sk;
}

/** Drop cached session key(s) — e.g. on wallet switch. */
export function clearSessionKey(address?: string): void {
  if (address) sessions.delete(address);
  else sessions.clear();
}
