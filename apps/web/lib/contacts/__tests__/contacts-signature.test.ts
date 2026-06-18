/**
 * Tests for the contacts write-signature verifier. The signature is bound to the payload
 * (sha256 of {op,name,address}) so a captured signature can't be replayed with a swapped
 * address. Reject cases short-circuit before the crypto check; the happy + body-swap cases
 * use a real Ed25519 keypair signature.
 */

import { describe, it, expect } from "vitest";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { verifyContactsSignature, contactsPayloadHash } from "../contacts-signature";

const NAME = "Thomas";
const ADDR = "0x" + "a".repeat(64);

async function signed(op: "upsert" | "delete" | "clear", name = "", address = "") {
  const kp = new Ed25519Keypair();
  const wallet = kp.toSuiAddress();
  const ts = Date.now();
  const message =
    op === "clear"
      ? `dewlock-contacts:clear:${wallet}:${ts}`
      : `dewlock-contacts:${op}:${wallet}:${ts}:${contactsPayloadHash(op, name, op === "upsert" ? address : "")}`;
  const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(message));
  return { wallet, message, signature };
}

describe("verifyContactsSignature", () => {
  it("accepts a fresh, payload-matching upsert signature", async () => {
    const { wallet, message, signature } = await signed("upsert", NAME, ADDR);
    expect(await verifyContactsSignature({ op: "upsert", wallet, message, signature, name: NAME, address: ADDR })).toBe(true);
  });

  it("rejects a body-swap: same signature, different address", async () => {
    const { wallet, message, signature } = await signed("upsert", NAME, ADDR);
    const swapped = "0x" + "b".repeat(64);
    expect(await verifyContactsSignature({ op: "upsert", wallet, message, signature, name: NAME, address: swapped })).toBe(false);
  });

  it("rejects a stale timestamp (> 5 min)", async () => {
    const kp = new Ed25519Keypair();
    const wallet = kp.toSuiAddress();
    const old = Date.now() - 6 * 60_000;
    const message = `dewlock-contacts:upsert:${wallet}:${old}:${contactsPayloadHash("upsert", NAME, ADDR)}`;
    const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(message));
    expect(await verifyContactsSignature({ op: "upsert", wallet, message, signature, name: NAME, address: ADDR })).toBe(false);
  });

  it("rejects a wallet that doesn't match the message", async () => {
    const { message, signature } = await signed("upsert", NAME, ADDR);
    const other = "0x" + "9".repeat(64);
    expect(await verifyContactsSignature({ op: "upsert", wallet: other, message, signature, name: NAME, address: ADDR })).toBe(false);
  });

  it("rejects a malformed message", async () => {
    const { wallet, signature } = await signed("upsert", NAME, ADDR);
    expect(await verifyContactsSignature({ op: "upsert", wallet, message: "garbage", signature, name: NAME, address: ADDR })).toBe(false);
  });

  it("accepts a valid clear signature (no payload)", async () => {
    const { wallet, message, signature } = await signed("clear");
    expect(await verifyContactsSignature({ op: "clear", wallet, message, signature })).toBe(true);
  });
});
