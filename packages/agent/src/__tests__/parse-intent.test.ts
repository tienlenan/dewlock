/**
 * Intent parser phrase table — locks routing + the counter-asset default
 * (USDC→SUI, else→USDC), "all" amounts, lend≠portfolio, and the LLM-fallback
 * (null) cases for ambiguous / unknown-symbol / contextual input.
 */

import { describe, it, expect } from "vitest";
import { parseIntent } from "../intent/parse-intent";
import { COIN_TYPES } from "../allowlist";

describe("parseIntent — routing", () => {
  it("'lending' and 'lend' → lend flow (NOT portfolio), no args", () => {
    expect(parseIntent("lending")).toEqual({ action: "lend", verb: "deposit", amount: { kind: "none" } });
    expect(parseIntent("lend")).toEqual({ action: "lend", verb: "deposit", amount: { kind: "none" } });
    expect(parseIntent("repay")).toEqual({ action: "lend", verb: "repay", amount: { kind: "none" } });
  });

  it("lend fully parses amount + coin + protocol (no re-ask loop)", () => {
    // Complete command — every field captured so it can build directly.
    expect(parseIntent("deposit 1 SUI to navi")).toEqual({
      action: "lend", verb: "deposit", amount: { kind: "exact", human: "1" },
      coinType: COIN_TYPES.SUI, protocol: "navi",
    });
    // Amount + coin, protocol omitted → protocol stays undefined (picker decides).
    expect(parseIntent("lend 1 SUI")).toEqual({
      action: "lend", verb: "deposit", amount: { kind: "exact", human: "1" }, coinType: COIN_TYPES.SUI,
    });
    // Coin only.
    expect(parseIntent("supply USDC")).toEqual({
      action: "lend", verb: "deposit", amount: { kind: "none" }, coinType: COIN_TYPES.USDC,
    });
    // "all" + coin + protocol.
    expect(parseIntent("repay all USDC on suilend")).toEqual({
      action: "lend", verb: "repay", amount: { kind: "all" }, coinType: COIN_TYPES.USDC, protocol: "suilend",
    });
  });

  it("read-only intents route correctly", () => {
    expect(parseIntent("portfolio")?.action).toBe("portfolio");
    expect(parseIntent("my balances")?.action).toBe("portfolio");
    expect(parseIntent("protocols")?.action).toBe("protocols");
    expect(parseIntent("badges")?.action).toBe("stats");
    expect(parseIntent("my address")?.action).toBe("receive");
  });

  it("bare 'swap' → swap_form", () => {
    expect(parseIntent("swap")).toEqual({ action: "swap_form" });
  });
});

describe("parseIntent — swap/sell defaults", () => {
  it("'sell all USDC' → USDC→SUI, all", () => {
    expect(parseIntent("sell all USDC")).toEqual({
      action: "swap", coinInType: COIN_TYPES.USDC, coinOutType: COIN_TYPES.SUI,
      amount: { kind: "all" }, swappable: true,
    });
  });

  it("'swap USDC' → USDC→SUI, none", () => {
    const r = parseIntent("swap USDC");
    expect(r).toMatchObject({ action: "swap", coinInType: COIN_TYPES.USDC, coinOutType: COIN_TYPES.SUI });
  });

  it("'sell SUI' → SUI→USDC (counter-asset default)", () => {
    expect(parseIntent("sell SUI")).toMatchObject({
      action: "swap", coinInType: COIN_TYPES.SUI, coinOutType: COIN_TYPES.USDC,
    });
  });

  it("'swap 5 SUI to USDC' → exact amount, explicit destination", () => {
    expect(parseIntent("swap 5 SUI to USDC")).toEqual({
      action: "swap", coinInType: COIN_TYPES.SUI, coinOutType: COIN_TYPES.USDC,
      amount: { kind: "exact", human: "5" }, swappable: true,
    });
  });

  it("'send 2 SUI' → send intent", () => {
    expect(parseIntent("send 2 SUI")).toEqual({
      action: "send", coinType: COIN_TYPES.SUI, amount: { kind: "exact", human: "2" },
    });
  });
});

describe("parseIntent — LLM fallback (null)", () => {
  it("contextual replies → null", () => {
    for (const t of ["yes", "do it", "the second one", "ok", "confirm"]) {
      expect(parseIntent(t)).toBeNull();
    }
  });
  it("unknown / non-whitelisted symbol → null (clarify, never guess an address)", () => {
    expect(parseIntent("sell ZORPCOIN")).toBeNull();
    expect(parseIntent("swap FOO to BAR")).toBeNull();
  });
  it("verified meme symbol → swappable swap intent against its verified coin type", () => {
    // BLUB is a verified, allowlisted meme (price feed + aggregator route confirmed),
    // so a sell resolves to a swappable swap intent against its exact coin type — the
    // deterministic path, never an LLM-guessed address.
    const intent = parseIntent("sell BLUB");
    expect(intent).toMatchObject({ action: "swap", swappable: true });
    expect(intent && "coinInType" in intent && intent.coinInType).toContain("::BLUB::BLUB");
  });
  it("same in/out → null", () => {
    expect(parseIntent("swap SUI to SUI")).toBeNull();
  });
  it("free-form prose → null", () => {
    expect(parseIntent("what's the best way to earn yield on my sui?")).toBeNull();
  });
});
