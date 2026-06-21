/**
 * Test: wallet-switch detection — the gate that purges the previous wallet's local
 * conversation state. The cross-wallet leak this guards against: logging out of wallet
 * A and into wallet B must NOT leave A's conversations loaded for B.
 */

import { describe, it, expect } from "vitest";
import { isWalletSwitch } from "../wallet-switch";

const A = "0x" + "a".repeat(64);
const B = "0x" + "b".repeat(64);

describe("isWalletSwitch", () => {
  it("false on initial mount / first connect (no previous wallet → nothing to purge)", () => {
    expect(isWalletSwitch(undefined, A)).toBe(false);
    expect(isWalletSwitch(undefined, undefined)).toBe(false);
  });

  it("false on a no-op re-render (same wallet)", () => {
    expect(isWalletSwitch(A, A)).toBe(false);
  });

  it("TRUE when switching to a different wallet (the leak case)", () => {
    expect(isWalletSwitch(A, B)).toBe(true);
  });

  it("TRUE on logout (wallet → disconnected) so the thread is cleared", () => {
    expect(isWalletSwitch(A, undefined)).toBe(true);
  });
});
