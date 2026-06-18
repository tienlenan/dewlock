import { describe, it, expect } from "vitest";
import { detectMultiAction } from "../intent/detect-multi-action";

describe("detectMultiAction", () => {
  it("send + swap in one message → multi", () => {
    const r = detectMultiAction("send 5 SUI to 0xabc and swap 10 USDC to SUI");
    expect(r.multi).toBe(true);
    expect(r.actions).toEqual(["send", "swap"]);
  });
  it("a single swap with a 'to' preposition is NOT multi", () => {
    expect(detectMultiAction("swap 5 SUI to USDC").multi).toBe(false);
  });
  it("one value action + a read-only view is NOT multi", () => {
    expect(detectMultiAction("swap 5 SUI to USDC and show my portfolio").multi).toBe(false);
  });
  it("lend + bridge → multi", () => {
    const r = detectMultiAction("lend 1 SUI to navi then bridge USDC");
    expect(r.multi).toBe(true);
    expect(r.actions).toEqual(["lend", "bridge"]);
  });
  it("empty / single read-only → not multi", () => {
    expect(detectMultiAction("").multi).toBe(false);
    expect(detectMultiAction("my portfolio").multi).toBe(false);
  });
  it("a recipient NAME that is a verb keyword is not a second action", () => {
    // Contacts named "Lend" / "Bridge" / "Swap" must not false-trigger the guard.
    expect(detectMultiAction("send 5 SUI to Lend").multi).toBe(false);
    expect(detectMultiAction("transfer 1 SUI to Bridge").multi).toBe(false);
    expect(detectMultiAction("pay Swap 10 USDC").multi).toBe(false);
  });
});
