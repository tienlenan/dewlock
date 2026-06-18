/**
 * Wallet-signature verification for contacts writes (server-only).
 *
 * The namespace is keyed only by the public wallet address, so a write must prove wallet
 * control. Critically, the signed message is BOUND TO THE PAYLOAD (a sha256 of the
 * {op,name,address}) — a wallet+ts-only signature could otherwise be replayed within the
 * freshness window with a swapped address (book poisoning). Clear-all carries no body.
 *
 * Message formats (the client builds the identical string before signing):
 *   upsert: dewlock-contacts:upsert:<wallet>:<ts>:<payloadHash>
 *   delete: dewlock-contacts:delete:<wallet>:<ts>:<payloadHash>
 *   clear:  dewlock-contacts:clear:<wallet>:<ts>
 */

import { createHash } from "node:crypto";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";

export type ContactsOp = "upsert" | "delete" | "clear";

const SIG_MAX_AGE_MS = 5 * 60_000; // signed write valid for 5 minutes
const WALLET_RE = /^0x[0-9a-fA-F]{1,64}$/;

/**
 * Canonical payload hash — MUST be computed identically on client + server. Normalizes
 * name (trim) and address (trim + lowercase) so casing/whitespace can't break the match.
 */
export function contactsPayloadHash(op: ContactsOp, name = "", address = ""): string {
  const canonical = JSON.stringify([op, name.trim(), address.trim().toLowerCase()]);
  return createHash("sha256").update(canonical).digest("hex");
}

function freshTs(raw: string): boolean {
  const ts = Number(raw);
  return Number.isFinite(ts) && Math.abs(Date.now() - ts) <= SIG_MAX_AGE_MS;
}

/**
 * Verify a contacts write signature: message shape + wallet match + freshness +
 * payload-hash match (for upsert/delete) + the personal-message signature itself.
 */
export async function verifyContactsSignature(args: {
  op: ContactsOp;
  wallet: string;
  message: string;
  signature: string;
  name?: string;
  address?: string;
}): Promise<boolean> {
  const { op, wallet, message, signature, name, address } = args;
  if (!WALLET_RE.test(wallet)) return false;

  if (op === "clear") {
    const m = /^dewlock-contacts:clear:(0x[0-9a-fA-F]{1,64}):(\d+)$/.exec(message);
    if (!m || m[1].toLowerCase() !== wallet.toLowerCase() || !freshTs(m[2])) return false;
  } else {
    const re = new RegExp(
      `^dewlock-contacts:${op}:(0x[0-9a-fA-F]{1,64}):(\\d+):([0-9a-f]{64})$`,
    );
    const m = re.exec(message);
    if (!m || m[1].toLowerCase() !== wallet.toLowerCase() || !freshTs(m[2])) return false;
    // delete binds only the name; upsert binds name + address.
    const expected = contactsPayloadHash(op, name, op === "upsert" ? address : "");
    if (m[3] !== expected) return false;
  }

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
