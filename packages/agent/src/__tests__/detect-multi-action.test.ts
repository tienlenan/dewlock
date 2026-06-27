import { describe, it, expect } from "vitest";
import { detectMultiAction, parseMultiRecipientSend } from "../intent/detect-multi-action";

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

describe("parseMultiRecipientSend", () => {
  const clauses = (text: string) => {
    const r = parseMultiRecipientSend(text);
    return r?.kind === "steps" ? r.steps.map((s) => s.clause) : null;
  };

  it("fans a same-amount send out into one step per recipient (and)", () => {
    expect(clauses("send 0.2 SUI to Alice and Bob")).toEqual([
      "send 0.2 SUI to Alice",
      "send 0.2 SUI to Bob",
    ]);
  });

  it("handles a comma-separated recipient list (3 recipients)", () => {
    expect(clauses("send 1 USDC to alice, bob, carol")).toEqual([
      "send 1 USDC to alice",
      "send 1 USDC to bob",
      "send 1 USDC to carol",
    ]);
  });

  it("every step is an explicit-amount send", () => {
    const r = parseMultiRecipientSend("send 0.5 SUI to A and B");
    expect(r?.kind).toBe("steps");
    if (r?.kind === "steps") {
      expect(r.steps.every((s) => s.category === "send" && s.amountFrom === "explicit")).toBe(true);
    }
  });

  it("strips 'each' from the synthesized commands", () => {
    expect(clauses("send 0.2 SUI each to Alice and Bob")).toEqual([
      "send 0.2 SUI to Alice",
      "send 0.2 SUI to Bob",
    ]);
  });

  it("preserves multi-word contact names", () => {
    expect(clauses("send 0.2 SUI to Mom Wallet and Bob")).toEqual([
      "send 0.2 SUI to Mom Wallet",
      "send 0.2 SUI to Bob",
    ]);
  });

  it("routes per-recipient amounts to the LLM decomposer", () => {
    expect(parseMultiRecipientSend("send 0.2 SUI to Alice and 0.3 to Bob")).toEqual({ kind: "needsLlm" });
  });

  it("keeps digit-containing recipients deterministic (address / numeric name)", () => {
    // A 0x address or a .sui name with digits has digits but is NOT a per-recipient amount.
    expect(clauses("send 0.2 SUI to alice and 0xbeef0001")).toEqual([
      "send 0.2 SUI to alice",
      "send 0.2 SUI to 0xbeef0001",
    ]);
    expect(clauses("send 1 SUI to alice and 888-l.sui")).toEqual([
      "send 1 SUI to alice",
      "send 1 SUI to 888-l.sui",
    ]);
  });

  it("single-recipient send is NOT a multi-recipient send", () => {
    expect(parseMultiRecipientSend("send 0.2 SUI to Alice")).toBeNull();
  });

  it("a real multi-verb chain is left to parseChainSteps (null)", () => {
    expect(parseMultiRecipientSend("swap 1 SUI to USDC and lend it on navi")).toBeNull();
    expect(parseMultiRecipientSend("send 0.2 SUI to Alice and swap 1 SUI to USDC")).toBeNull();
  });

  it("a non-send first verb is not a multi-recipient send", () => {
    expect(parseMultiRecipientSend("lend 1 SUI to navi and suilend")).toBeNull();
  });
});
