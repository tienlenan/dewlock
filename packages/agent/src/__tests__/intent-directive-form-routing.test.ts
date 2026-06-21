/**
 * buildIntentDirective — missing-arg actions render an input FORM (requestActionForm),
 * complete actions build directly (prepareTrade). Locks the "sell SUI → nothing" fix.
 */

import { describe, it, expect } from "vitest";
import { buildIntentDirective } from "../intent/intent-directive";

const WALLET = "0x" + "a".repeat(64);
const RECIPIENT = "0x" + "b".repeat(64);

describe("buildIntentDirective — form routing for missing args", () => {
  it("'sell SUI' (no amount) → getSwapForm with the pair pre-filled (not prose)", async () => {
    const d = (await buildIntentDirective("sell SUI", WALLET)) ?? "";
    expect(d).toContain("Call ONLY `getSwapForm`");
    expect(d).toContain('coinTypeIn:');
    expect(d).toContain('coinTypeOut:');
  });

  it("'swap' (bare) → getSwapForm picker, not a prose question", async () => {
    const d = (await buildIntentDirective("swap", WALLET)) ?? "";
    expect(d).toContain("Call ONLY `getSwapForm`");
    expect(d).not.toContain("Ask concisely");
  });

  it("'portfolio' → calls BOTH getPortfolio and getDefiPositions (BM accounts visible)", async () => {
    const d = (await buildIntentDirective("portfolio", WALLET)) ?? "";
    expect(d).toContain("getPortfolio");
    expect(d).toContain("getDefiPositions");
  });

  it("'my positions' → portfolio intent that also calls getDefiPositions (BM source)", async () => {
    const d = (await buildIntentDirective("my positions", WALLET)) ?? "";
    expect(d).toContain("getPortfolio");
    expect(d).toContain("getDefiPositions");
  });

  it("'send USDC' (no amount/recipient) → requestActionForm send needs amount+recipient", async () => {
    const d = (await buildIntentDirective("send USDC", WALLET)) ?? "";
    expect(d).toContain("requestActionForm");
    expect(d).toContain('formAction: "send"');
    expect(d).toContain("amount");
    expect(d).toContain("recipient");
  });

  it("'lending' → requestActionForm lend (never getPortfolio/prepareTrade)", async () => {
    const d = (await buildIntentDirective("lending", WALLET)) ?? "";
    expect(d).toContain("Call ONLY `requestActionForm`");
    expect(d).toContain('formAction: "lend"');
    // Protocol is chosen via the picker, never asked for in the form.
    expect(d).not.toContain("protocol");
  });

  it("'lend 1 SUI' (amount+coin, no protocol) → getLendOptions picker, not a form", async () => {
    const d = (await buildIntentDirective("lend 1 SUI", WALLET)) ?? "";
    expect(d).toContain("Call ONLY `getLendOptions`");
    expect(d).toContain('amountHuman: "1"');
    // Distinctive markers of the OTHER routes must be absent (the picker text
    // mentions those tool names only inside its "do NOT call …" guidance).
    expect(d).not.toContain('formAction:');
    expect(d).not.toContain('actionType:');
  });

  it("'deposit 1 SUI to navi' (complete) → prepareTrade lend_deposit, no form/picker", async () => {
    const d = (await buildIntentDirective("deposit 1 SUI to navi", WALLET)) ?? "";
    expect(d).toContain("prepareTrade");
    expect(d).toContain('actionType: "lend_deposit"');
    expect(d).toContain('lendingProtocol: "navi"');
    expect(d).not.toContain("requestActionForm");
    expect(d).not.toContain("getLendOptions");
  });

  it("'deposit SUI' (coin, no amount) → form asks amount only (no protocol)", async () => {
    const d = (await buildIntentDirective("deposit SUI", WALLET)) ?? "";
    expect(d).toContain("Call ONLY `requestActionForm`");
    expect(d).toContain('needs: ["amount"]');
    expect(d).not.toContain("protocol");
  });

  it("'swap 5 SUI to USDC' (complete) → prepareTrade, not a form", async () => {
    const d = (await buildIntentDirective("swap 5 SUI to USDC", WALLET)) ?? "";
    expect(d).toContain("prepareTrade");
    expect(d).not.toContain("requestActionForm");
  });

  it("'send 2 SUI to 0x…' (complete) → prepareTrade transfer, not a form", async () => {
    const d = (await buildIntentDirective(`send 2 SUI to ${RECIPIENT}`, WALLET)) ?? "";
    expect(d).toContain("prepareTrade");
    expect(d).not.toContain("requestActionForm");
  });

  it("'place limit order' (bare) → getLimitOrderForm, never getPortfolio/getDefiPositions", async () => {
    const d = (await buildIntentDirective("place limit order", WALLET)) ?? "";
    expect(d).toContain("Call ONLY `getLimitOrderForm`");
    expect(d).toContain("do NOT call getPortfolio, getDefiPositions");
    // The form route never emits build args (those belong to the marker path).
    expect(d).not.toContain('actionType:');
  });

  it("'limit buy' (bare) → getLimitOrderForm with side pre-selected", async () => {
    const d = (await buildIntentDirective("limit buy", WALLET)) ?? "";
    expect(d).toContain("Call ONLY `getLimitOrderForm`");
    expect(d).toContain('side: "BUY"');
  });

  it("'swap USDC to zzz fake junk' (unknown destination) → plain reply, NO form/build", async () => {
    const d = (await buildIntentDirective("swap USDC to zzz fake junk", WALLET)) ?? "";
    expect(d).toContain("recognised, verified token on Dewlock");
    expect(d).toContain("Do NOT call getSwapForm");
    // Must not instruct a build (no prepareTrade actionType args for this path).
    expect(d).not.toContain('actionType:');
  });

  it("the form's [[limit:…]] marker (complete) → prepareTrade limit_order, not a form", async () => {
    const cmd = "limit BUY 10 SUI at 2.8 USDC on SUI_USDC [[limit:pool=SUI_USDC|side=BUY|price=2.8|qty=10|exp=4102444800000]]";
    const d = (await buildIntentDirective(cmd, WALLET)) ?? "";
    expect(d).toContain("prepareTrade");
    expect(d).toContain('actionType: "limit_order"');
    expect(d).toContain('poolKey: "SUI_USDC"');
    expect(d).toContain('side: "BUY"');
    expect(d).toContain("limitPrice: 2.8");
    expect(d).toContain("expireTimestampMs: 4102444800000");
    expect(d).not.toContain("getLimitOrderForm");
  });
});
