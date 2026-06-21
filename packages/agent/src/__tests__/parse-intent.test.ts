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

describe("parseIntent — limit order", () => {
  it("bare 'place limit order' → limit_order_form (no side)", () => {
    expect(parseIntent("place limit order")).toMatchObject({ action: "limit_order_form" });
    expect(parseIntent("place a limit order")).toMatchObject({ action: "limit_order_form" });
    const r = parseIntent("limit order");
    expect(r).toMatchObject({ action: "limit_order_form" });
    expect(r && "side" in r && r.side).toBeUndefined();
  });

  it("'limit buy' / 'limit sell' → limit_order_form with the side pre-selected", () => {
    expect(parseIntent("limit buy")).toMatchObject({ action: "limit_order_form", side: "BUY" });
    expect(parseIntent("place a limit sell order")).toMatchObject({ action: "limit_order_form", side: "SELL" });
  });

  it("the form's [[limit:…]] marker binds the EXACT order params → limit_order", () => {
    const cmd = "limit BUY 10 SUI at 2.8 USDC on SUI_USDC [[limit:pool=SUI_USDC|side=BUY|price=2.8|qty=10|exp=4102444800000]]";
    expect(parseIntent(cmd)).toEqual({
      action: "limit_order", poolKey: "SUI_USDC", side: "BUY",
      limitPrice: 2.8, limitQuantity: 10, expireTimestampMs: 4102444800000,
    });
  });

  it("a marker with a non-whitelisted pool is rejected → degrades to the form, never a bad order", () => {
    const cmd = "limit BUY 10 SUI on BADPOOL [[limit:pool=BADPOOL|side=BUY|price=2.8|qty=10|exp=4102444800000]]";
    expect(parseIntent(cmd)).toMatchObject({ action: "limit_order_form" });
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

describe("parseIntent — slippage clause (high-slippage demo)", () => {
  it("'swap 1 SUI to USDC with 30% slippage' → slippageBps 3000", () => {
    expect(parseIntent("swap 1 SUI to USDC with 30% slippage")).toMatchObject({
      action: "swap", coinInType: COIN_TYPES.SUI, coinOutType: COIN_TYPES.USDC,
      amount: { kind: "exact", human: "1" }, slippageBps: 3000,
    });
  });
  it("trailing 'slippage 2%' form → slippageBps 200", () => {
    expect(parseIntent("swap 5 SUI to USDC slippage 2%")).toMatchObject({
      action: "swap", coinInType: COIN_TYPES.SUI, coinOutType: COIN_TYPES.USDC, slippageBps: 200,
    });
  });
  it("no slippage clause → slippageBps undefined", () => {
    const r = parseIntent("swap 1 SUI to USDC");
    expect(r?.action).toBe("swap");
    expect((r as { slippageBps?: number }).slippageBps).toBeUndefined();
  });
});

describe("parseIntent — unverified raw 0x destination (coin_allowlist demo)", () => {
  const SCAM = "0xbadc0de000000000000000000000000000000000000000000000000000000bad::scam::SCAM";
  it("'swap 1 SUI to <raw 0x scam type>' → swap_unverified", () => {
    expect(parseIntent(`swap 1 SUI to ${SCAM}`)).toEqual({
      action: "swap_unverified", coinInType: COIN_TYPES.SUI, coinOutRaw: SCAM,
      amount: { kind: "exact", human: "1" },
    });
  });
  it("an allowlisted raw 0x destination stays a normal swap (not flagged unverified)", () => {
    const r = parseIntent(`swap 1 SUI to ${COIN_TYPES.USDC}`);
    expect(r).toMatchObject({ action: "swap", coinOutType: COIN_TYPES.USDC });
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

describe("parseIntent — swap-form binding (via + exact-type marker)", () => {
  it("'via <source>' is parsed (the swap card's command now binds deterministically)", () => {
    expect(parseIntent("swap 5 SUI to USDC via aftermath")).toMatchObject({
      action: "swap", coinInType: COIN_TYPES.SUI, coinOutType: COIN_TYPES.USDC,
      amount: { kind: "exact", human: "5" }, swapSource: "aftermath",
    });
    expect(parseIntent("swap 1 SUI to USDC via aggregator")).toMatchObject({ swapSource: "aggregator" });
  });

  it("an unknown via source is ignored (swapSource undefined, swap still parses)", () => {
    const r = parseIntent("swap 1 SUI to USDC via bogusdex");
    expect(r).toMatchObject({ action: "swap", coinInType: COIN_TYPES.SUI, coinOutType: COIN_TYPES.USDC });
    expect(r && "swapSource" in r && r.swapSource).toBeUndefined();
  });

  it("the exact-type marker binds the EXACT coin types + source (no symbol round-trip)", () => {
    const cmd = `swap 1 SUI to USDC via aftermath [[swap:in=${COIN_TYPES.SUI}|out=${COIN_TYPES.USDC}|src=aftermath]]`;
    expect(parseIntent(cmd)).toEqual({
      action: "swap", coinInType: COIN_TYPES.SUI, coinOutType: COIN_TYPES.USDC,
      amount: { kind: "exact", human: "1" }, swappable: true, swapSource: "aftermath",
    });
  });

  it("a marker with a non-allowlisted type is rejected → falls back to the readable command", () => {
    const cmd = `swap 1 SUI to USDC [[swap:in=0xdead::x::X|out=${COIN_TYPES.USDC}|src=cetus]]`;
    expect(parseIntent(cmd)).toMatchObject({
      action: "swap", coinInType: COIN_TYPES.SUI, coinOutType: COIN_TYPES.USDC,
    });
  });
});
