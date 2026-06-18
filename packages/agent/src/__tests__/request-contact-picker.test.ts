/**
 * Tests: requestContactPicker — pure tool that shapes directive-supplied candidates into
 * a contact-picker card spec. No IO, no building, no signing.
 */

import { describe, it, expect } from "vitest";
import { requestContactPicker } from "../tools/request-contact-picker";

const run = (input: unknown) =>
  (requestContactPicker as unknown as { execute: (i: unknown) => Promise<Record<string, unknown>> }).execute(input);

describe("requestContactPicker", () => {
  it("builds a title from the match count + query and passes candidates through", async () => {
    const candidates = [
      { name: "Thomas", address: "0x" + "a".repeat(64) },
      { name: "Thomas S", address: "0x" + "b".repeat(64) },
    ];
    const out = await run({ query: "thomas", amountHuman: "1", coinSymbol: "SUI", candidates });
    expect(out.title).toContain("2");
    expect(out.title).toContain("thomas");
    expect(out.candidates).toEqual(candidates);
    expect(out.amountHuman).toBe("1");
    expect(out.coinSymbol).toBe("SUI");
  });
});
