/**
 * Test: resolveCoinDecimals — the decimals the tx-preview card formats with.
 *
 * Regression for the "swap output renders ~1000× off" bug: the sign card used to
 * hardcode decimals for 3 coins and default everything else to 9, so a 6-decimal swap
 * output (~44 tokens) rendered as 0.04. The Guardian now resolves real decimals per coin
 * type (curated map → on-chain CoinMetadata → 9) and threads them into the preview.
 */

import { describe, it, expect, vi } from "vitest";
import { resolveCoinDecimals } from "../guardian";
import { COIN_TYPES } from "../allowlist";

type SuiClientArg = Parameters<typeof resolveCoinDecimals>[1];

const UNKNOWN = "0xabc1230000000000000000000000000000000000000000000000000000000000::meme::MEME";

function mockClient(meta: unknown) {
  return { getCoinMetadata: vi.fn(async () => meta) } as unknown as SuiClientArg & {
    getCoinMetadata: ReturnType<typeof vi.fn>;
  };
}

describe("resolveCoinDecimals", () => {
  it("returns curated decimals for a known coin WITHOUT an on-chain call (fast path)", async () => {
    const client = mockClient({ decimals: 999 }); // wrong on purpose — must NOT be used
    const d = await resolveCoinDecimals(COIN_TYPES.USDC, client);
    expect(d).toBe(6);
    expect(client.getCoinMetadata).not.toHaveBeenCalled();
  });

  it("resolves an UNKNOWN token's decimals from on-chain CoinMetadata (the 0.04-vs-44 bug)", async () => {
    const client = mockClient({ decimals: 6 });
    const d = await resolveCoinDecimals(UNKNOWN, client);
    expect(d).toBe(6); // a 6-decimal token now formats correctly, not as if it had 9
    expect(client.getCoinMetadata).toHaveBeenCalledWith({ coinType: UNKNOWN });
  });

  it("defaults to 9 when on-chain metadata is missing", async () => {
    expect(await resolveCoinDecimals(UNKNOWN, mockClient(null))).toBe(9);
  });

  it("defaults to 9 when the metadata lookup throws (fail-soft)", async () => {
    const client = { getCoinMetadata: vi.fn(async () => { throw new Error("rpc down"); }) } as unknown as SuiClientArg;
    expect(await resolveCoinDecimals(UNKNOWN, client)).toBe(9);
  });
});
