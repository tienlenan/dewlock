import { describe, it, expect } from "vitest";
import { parsePayInAnyCoin, buildPayInAnyCoinLegs } from "../pay-in-any-coin";
import { COIN_TYPES } from "../protocol-constants";

describe("parsePayInAnyCoin", () => {
  it("parses 'pay 0.5 USDC to <0x>' with 6-decimal scaling", () => {
    const p = parsePayInAnyCoin("pay 0.5 USDC to 0xabc");
    expect(p).toEqual({ amountNative: 500_000n, coinOut: COIN_TYPES.USDC, symbol: "USDC", recipient: "0xabc" });
  });

  it("parses 'pay 5 SUI to @bob' with 9-decimal scaling", () => {
    const p = parsePayInAnyCoin("pay 5 SUI to @bob");
    expect(p?.amountNative).toBe(5_000_000_000n);
    expect(p?.coinOut).toBe(COIN_TYPES.SUI);
    expect(p?.recipient).toBe("@bob");
  });

  it("strips a trailing punctuation from the recipient", () => {
    expect(parsePayInAnyCoin("pay 1 USDC to bob.sui.")?.recipient).toBe("bob.sui");
  });

  it("returns null for a non-pay verb, unknown symbol, or non-positive amount", () => {
    expect(parsePayInAnyCoin("swap 5 SUI to USDC")).toBeNull();
    expect(parsePayInAnyCoin("pay 5 XYZ to bob")).toBeNull();
    expect(parsePayInAnyCoin("pay 0 USDC to bob")).toBeNull();
  });
});

describe("buildPayInAnyCoinLegs", () => {
  const RECIP = "0x" + "b".repeat(64);
  // reverse quote: 0.01 USDC ~= 3_000_000 MIST SUI.
  const quote = (async () => ({ estimatedAmountOut: 3_000_000n, minAmountOut: 2_985_000n })) as never;

  it("sizes the swap from a reverse quote + margin and pays the exact amount chained", async () => {
    const legs = await buildPayInAnyCoinLegs({
      heldCoin: COIN_TYPES.SUI,
      coinOut: COIN_TYPES.USDC,
      amountOut: 10_000n,
      recipient: RECIP,
      marginBps: 800,
      quote,
    });
    expect(legs).toHaveLength(2);
    // swap leg: 3_000_000 * 10800/10000 = 3_240_000, SUI -> USDC
    expect(legs[0]).toMatchObject({ actionType: "swap", coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountInNative: 3_240_000n });
    // send leg: EXACT 10_000 USDC to recipient, chained from the swap output
    expect(legs[1]).toMatchObject({ actionType: "send", coinTypeIn: COIN_TYPES.USDC, amountInNative: 10_000n, recipient: RECIP, amountFrom: "prev-output" });
  });

  it("rejects paying in the coin you already hold", async () => {
    await expect(
      buildPayInAnyCoinLegs({ heldCoin: COIN_TYPES.USDC, coinOut: COIN_TYPES.USDC, amountOut: 1n, recipient: RECIP, quote }),
    ).rejects.toThrow();
  });
});
