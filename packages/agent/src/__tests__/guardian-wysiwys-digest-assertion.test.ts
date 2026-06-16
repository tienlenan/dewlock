/**
 * Test: WYSIWYS digest assertion at the sign boundary.
 *
 * Hardening point #3: the sign hook must assert digest(signedBytes) === approvedDigest
 * before calling mutateAsync. A mutated PTB (digest ≠ approved) is refused.
 *
 * We test:
 *  - sha256 correctness (Node crypto, same algorithm as Web Crypto in the hook)
 *  - WysiwysError class shape and message format
 *  - The assertWysiwys logic (reproduced inline — matches sign.ts implementation)
 *
 * useSignAndExecuteTx (React hook) cannot run in vitest/Node — that path is
 * covered by the manual browser checklist. The deterministic digest math
 * and WysiwysError contract are fully testable here.
 *
 * WysiwysError is imported directly from the source file path to avoid pulling
 * @mysten/dapp-kit (browser-only) via the sign.ts "use client" module.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

// Import WysiwysError from sign.ts source — vitest handles "use client" directive
// gracefully in node environment (ignores it), but dapp-kit imports would fail.
// We mock the dapp-kit module to avoid browser-only import issues.
import { vi } from "vitest";

vi.mock("@mysten/dapp-kit", () => ({
  useSignAndExecuteTransaction: vi.fn(),
  useSuiClient: vi.fn(),
}));

// Now safe to import from sign.ts
import { WysiwysError } from "@dewlock/sui/sign";

// ---------------------------------------------------------------------------
// SHA-256 helper (matches sign.ts sha256HexBytes logic — Node crypto equivalent)
// ---------------------------------------------------------------------------

function sha256HexNode(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Base64 encoding helper
function encodeB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Reproduce the exact WYSIWYS check from sign.ts execute callback.
 * This mirrors: atob(bytes) → Uint8Array → sha256 → compare.
 */
function assertWysiwys(signedBytesB64: string, approvedDigest: string): void {
  const rawBytes = Uint8Array.from(atob(signedBytesB64), (c) => c.charCodeAt(0));
  const actualDigest = sha256HexNode(rawBytes);
  if (actualDigest !== approvedDigest) {
    throw new WysiwysError(approvedDigest, actualDigest);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WYSIWYS digest assertion (sign boundary)", () => {
  it("passes when signed bytes match the Guardian-approved digest", () => {
    const ptbBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const b64 = encodeB64(ptbBytes);
    const approvedDigest = sha256HexNode(ptbBytes);

    expect(() => assertWysiwys(b64, approvedDigest)).not.toThrow();
  });

  it("throws WysiwysError when PTB bytes differ from approved (mutation attack)", () => {
    const approvedBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const mutatedBytes = new Uint8Array([1, 2, 3, 4, 99]); // last byte changed

    const approvedDigest = sha256HexNode(approvedBytes);
    const mutatedB64 = encodeB64(mutatedBytes);

    expect(() => assertWysiwys(mutatedB64, approvedDigest)).toThrow(WysiwysError);
  });

  it("WysiwysError message includes both digests", () => {
    const approvedBytes = new Uint8Array([10, 20, 30]);
    const mutatedBytes = new Uint8Array([10, 20, 99]);

    const approvedDigest = sha256HexNode(approvedBytes);
    const mutatedDigest = sha256HexNode(mutatedBytes);
    const mutatedB64 = encodeB64(mutatedBytes);

    let caught: WysiwysError | null = null;
    try {
      assertWysiwys(mutatedB64, approvedDigest);
    } catch (err) {
      caught = err as WysiwysError;
    }

    expect(caught).not.toBeNull();
    expect(caught!.approvedDigest).toBe(approvedDigest);
    expect(caught!.actualDigest).toBe(mutatedDigest);
    expect(caught!.message).toContain(approvedDigest);
    expect(caught!.message).toContain(mutatedDigest);
    expect(caught!.message).toContain("WYSIWYS assertion failed");
  });

  it("WysiwysError is an instance of Error", () => {
    const err = new WysiwysError("abc", "def");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("WysiwysError");
  });

  it("single-bit flip in PTB produces a different digest (SHA-256 avalanche)", () => {
    const original = new Uint8Array(32).fill(0xaa);
    const flipped = new Uint8Array(32).fill(0xaa);
    flipped[15] = 0xab;

    const d1 = sha256HexNode(original);
    const d2 = sha256HexNode(flipped);
    expect(d1).not.toBe(d2);
  });

  it("digest is deterministic: same bytes → same digest every time", () => {
    const bytes = new Uint8Array([5, 10, 15, 20, 25]);
    const d1 = sha256HexNode(bytes);
    const d2 = sha256HexNode(bytes);
    expect(d1).toBe(d2);
  });

  it("digest is a 64-character hex string (SHA-256 = 32 bytes = 64 hex chars)", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const digest = sha256HexNode(bytes);
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws when approvedDigest is empty string (no bypass via empty string)", () => {
    const ptbBytes = new Uint8Array([1, 2, 3]);
    const b64 = encodeB64(ptbBytes);
    const realDigest = sha256HexNode(ptbBytes);

    // Empty string ≠ real digest → throws
    expect(() => assertWysiwys(b64, "")).toThrow(WysiwysError);
    // Real digest matches → passes
    expect(() => assertWysiwys(b64, realDigest)).not.toThrow();
  });
});
