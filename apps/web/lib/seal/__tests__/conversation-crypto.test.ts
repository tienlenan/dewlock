/**
 * conversation-crypto unit tests (CI-safe — SealClient + Transaction mocked).
 * The REAL end-to-end round-trip (encrypt → SessionKey → seal_approve PTB → decrypt against
 * the published testnet policy + live key servers) is proven by the opt-in script
 * `live-roundtrip-check.mjs` (run: `node apps/web/lib/seal/__tests__/live-roundtrip-check.mjs`).
 * These tests lock the magic-tag framing + the read-path discriminator.
 */

import { describe, it, expect, vi } from "vitest";

// Echo SealClient: encrypt returns the data as the ciphertext, decrypt returns it back.
vi.mock("../seal-client", () => ({
  getSealClient: () => ({
    encrypt: async ({ data }: { data: Uint8Array }) => ({ encryptedObject: data, key: new Uint8Array() }),
    decrypt: async ({ data }: { data: Uint8Array }) => data,
  }),
  sealSuiClient: () => ({}),
  isSealUsable: () => true,
}));

// Minimal Transaction stub (the decrypt PTB build is exercised live, not here).
vi.mock("@mysten/sui/transactions", () => ({
  Transaction: class {
    pure = { vector: () => ({}) };
    moveCall() {}
    async build() {
      return new Uint8Array();
    }
  },
}));

import { encryptConversation, decryptConversation, isSealCiphertext } from "../conversation-crypto";

const ADDR = "0x" + "ab".repeat(32);

describe("conversation-crypto", () => {
  it("isSealCiphertext recognises only the dseal1 tag", () => {
    expect(isSealCiphertext("dseal1:AAAA")).toBe(true);
    expect(isSealCiphertext('[{"role":"user","text":"hi"}]')).toBe(false); // legacy plaintext JSON
    expect(isSealCiphertext("")).toBe(false);
    expect(isSealCiphertext(null)).toBe(false);
    expect(isSealCiphertext(undefined)).toBe(false);
  });

  it("encrypt tags the ciphertext; decrypt strips the tag and recovers the bytes", async () => {
    const plaintext = new TextEncoder().encode(JSON.stringify([{ role: "user", text: "secret" }]));
    const tagged = await encryptConversation(plaintext, ADDR);

    expect(tagged.startsWith("dseal1:")).toBe(true);
    expect(isSealCiphertext(tagged)).toBe(true);

    const back = await decryptConversation(tagged, ADDR, {} as never);
    expect(new TextDecoder().decode(back)).toBe(new TextDecoder().decode(plaintext));
  });
});
