/**
 * Tests for client-side conversation-title encryption.
 * Runs in the node test env (WebCrypto + atob/btoa available; no localStorage, which
 * title-crypto guards via `typeof window`). ensureTitleKey exercises the real
 * wallet-signature → HKDF → AES-GCM derivation with a deterministic Ed25519 keypair.
 */

import { describe, it, expect } from "vitest";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { encryptTitle, decryptTitle, ensureTitleKey } from "../title-crypto";

function genKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

describe("title-crypto", () => {
  it("encrypt → decrypt round-trips", async () => {
    const key = await genKey();
    const enc = await encryptTitle("How's my portfolio?", key);
    expect(enc).not.toContain("How"); // ciphertext, not plaintext
    expect(await decryptTitle(enc, key)).toBe("How's my portfolio?");
  });

  it("produces a fresh ciphertext each call (random IV) but decrypts the same", async () => {
    const key = await genKey();
    const a = await encryptTitle("same title", key);
    const b = await encryptTitle("same title", key);
    expect(a).not.toBe(b);
    expect(await decryptTitle(a, key)).toBe("same title");
    expect(await decryptTitle(b, key)).toBe("same title");
  });

  it("fails to decrypt with a different key (AES-GCM auth tag)", async () => {
    const k1 = await genKey();
    const k2 = await genKey();
    const enc = await encryptTitle("secret", k1);
    await expect(decryptTitle(enc, k2)).rejects.toBeDefined();
  });

  it("round-trips unicode titles", async () => {
    const key = await genKey();
    const title = "Số dư ví của tôi 🪙 → swap?";
    expect(await decryptTitle(await encryptTitle(title, key), key)).toBe(title);
  });

  it("ensureTitleKey derives a usable AES-GCM key from a wallet signature", async () => {
    const kp = new Ed25519Keypair();
    const wallet = kp.toSuiAddress();
    const sign = (input: { message: Uint8Array }) => kp.signPersonalMessage(input.message);
    const key = await ensureTitleKey(wallet, sign);
    const enc = await encryptTitle("derived", key);
    expect(await decryptTitle(enc, key)).toBe("derived");
  });
});
