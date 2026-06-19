/**
 * Tests for the conversation session write-auth verifier.
 *
 * The message format is `dewlock-conversation-auth:<wallet>:<ts>`.
 * A session token is valid for 30 minutes; one signature covers all saves in that window.
 * Reject cases short-circuit before the crypto check; happy + staleness cases use a real
 * Ed25519 keypair to exercise the full verification path.
 */

import { describe, it, expect } from "vitest";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { verifyConversationAuth } from "../conversation-auth";

async function freshAuth(wallet?: string) {
  const kp = new Ed25519Keypair();
  const addr = wallet ?? kp.toSuiAddress();
  const message = `dewlock-conversation-auth:${addr}:${Date.now()}`;
  const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(message));
  return { wallet: addr, message, signature, kp };
}

describe("verifyConversationAuth", () => {
  it("accepts a fresh valid signature", async () => {
    const { wallet, message, signature } = await freshAuth();
    expect(await verifyConversationAuth({ wallet, message, signature })).toBe(true);
  });

  it("rejects a stale timestamp (> 30 min)", async () => {
    const kp = new Ed25519Keypair();
    const addr = kp.toSuiAddress();
    const old = Date.now() - 31 * 60_000;
    const message = `dewlock-conversation-auth:${addr}:${old}`;
    const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(message));
    expect(await verifyConversationAuth({ wallet: addr, message, signature })).toBe(false);
  });

  it("rejects a wallet mismatch (signed by different keypair)", async () => {
    const kp = new Ed25519Keypair();
    const other = new Ed25519Keypair();
    const addr = kp.toSuiAddress();
    // Sign with `kp` but claim wallet is `other`
    const message = `dewlock-conversation-auth:${addr}:${Date.now()}`;
    const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(message));
    expect(await verifyConversationAuth({ wallet: other.toSuiAddress(), message, signature })).toBe(false);
  });

  it("rejects a message wallet that doesn't match the wallet param", async () => {
    const kp = new Ed25519Keypair();
    const addr = kp.toSuiAddress();
    const other = "0x" + "9".repeat(64);
    const message = `dewlock-conversation-auth:${addr}:${Date.now()}`;
    const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(message));
    // wallet param is `other` but message encodes `addr`
    expect(await verifyConversationAuth({ wallet: other, message, signature })).toBe(false);
  });

  it("rejects a malformed message", async () => {
    const { wallet, signature } = await freshAuth();
    expect(await verifyConversationAuth({ wallet, message: "not-the-right-format", signature })).toBe(false);
  });

  it("rejects an invalid wallet address format", async () => {
    const { message, signature } = await freshAuth();
    expect(await verifyConversationAuth({ wallet: "not-an-address", message, signature })).toBe(false);
  });

  it("rejects an empty signature", async () => {
    const { wallet, message } = await freshAuth();
    expect(await verifyConversationAuth({ wallet, message, signature: "" })).toBe(false);
  });
});
