/**
 * Wallet-signature verification for conversation writes (server-only).
 *
 * Conversations autosave every ~1.5s, so we use a SESSION-level auth rather than
 * per-write payload binding (which would require a wallet prompt on every autosave).
 * The signed message is: `dewlock-conversation-auth:<wallet>:<ts>`
 * Valid for 30 minutes; one signature per session reused across all autosaves.
 *
 * This closes the unauthenticated-write / blob-poisoning hole — any POST or DELETE
 * must prove wallet control. The client caches the auth token and re-signs only when
 * it nears expiry (see conversation-auth-client.ts).
 */

import { verifyPersonalMessageSignature } from "@mysten/sui/verify";

const SIG_MAX_AGE_MS = 30 * 60_000; // 30 minutes — matches client cache TTL
const WALLET_RE = /^0x[0-9a-fA-F]{1,64}$/;
const MSG_RE = /^dewlock-conversation-auth:(0x[0-9a-fA-F]{1,64}):(\d+)$/;

function freshTs(raw: string): boolean {
  const ts = Number(raw);
  return Number.isFinite(ts) && Math.abs(Date.now() - ts) <= SIG_MAX_AGE_MS;
}

/**
 * Verify a conversation session-auth signature.
 * Returns true only when: message shape matches, wallet matches, ts is fresh (<=30 min),
 * and the personal-message signature recovers to `wallet`.
 */
export async function verifyConversationAuth(args: {
  wallet: string;
  message: string;
  signature: string;
}): Promise<boolean> {
  const { wallet, message, signature } = args;
  if (!WALLET_RE.test(wallet)) return false;

  const m = MSG_RE.exec(message);
  if (!m) return false;
  if (m[1].toLowerCase() !== wallet.toLowerCase()) return false;
  if (!freshTs(m[2])) return false;

  try {
    const pubkey = await verifyPersonalMessageSignature(
      new TextEncoder().encode(message),
      signature,
    );
    return pubkey.toSuiAddress().toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}
