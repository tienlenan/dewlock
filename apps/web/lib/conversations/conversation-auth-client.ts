"use client";

/**
 * Client-side session write-auth for conversations.
 *
 * Conversations autosave every ~1.5s — we can't prompt the user on each save.
 * This module caches a signed session token per wallet and reuses it for up to
 * 25 minutes (server accepts up to 30 min; 5 min margin prevents clock-skew races).
 * One wallet-signature prompt per session.
 *
 * Message format (identical to server's MSG_RE):
 *   dewlock-conversation-auth:<wallet>:<ts>
 */

type SignPersonalMessage = (input: { message: Uint8Array }) => Promise<{ signature: string }>;

interface CachedAuth {
  message: string;
  signature: string;
  expiresAt: number; // ms epoch
}

const REUSE_MS = 25 * 60_000; // 25 min — server window is 30 min, 5 min margin
const cache = new Map<string, CachedAuth>();

function buildMessage(wallet: string): string {
  return `dewlock-conversation-auth:${wallet}:${Date.now()}`;
}

/**
 * Return a valid {message, signature} auth pair for `wallet`, signing a fresh one
 * only when the cached token is absent or nearing expiry. One prompt per session.
 */
export async function ensureWriteAuth(
  wallet: string,
  signPersonalMessage: SignPersonalMessage,
): Promise<{ message: string; signature: string }> {
  const cached = cache.get(wallet);
  if (cached && Date.now() < cached.expiresAt) {
    return { message: cached.message, signature: cached.signature };
  }

  const message = buildMessage(wallet);
  const { signature } = await signPersonalMessage({
    message: new TextEncoder().encode(message),
  });

  const entry: CachedAuth = { message, signature, expiresAt: Date.now() + REUSE_MS };
  cache.set(wallet, entry);
  return { message, signature };
}

/** Invalidate the cached auth for a wallet (e.g. on wallet switch). */
export function clearWriteAuth(wallet?: string): void {
  if (wallet) cache.delete(wallet);
  else cache.clear();
}
