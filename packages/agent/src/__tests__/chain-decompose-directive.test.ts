/**
 * chain-decompose-directive.test.ts — tests for buildChainDecomposeDirective.
 *
 * The directive is a plain string injected into the LLM prompt when the regex
 * chain parser fails on a chainable multi-action. We verify:
 *  - It mentions "decomposeIntent" (the tool the model must call)
 *  - It mentions the key field names: "steps", "command", "category", "amountFrom"
 *  - It includes the original user text
 *  - It tells the model NOT to call prepareTrade this turn
 *  - It is a non-empty string
 */

import { describe, it, expect } from "vitest";
import { buildChainDecomposeDirective } from "../intent/chain-decompose-directive";

describe("buildChainDecomposeDirective", () => {
  const sampleText =
    "Swap 1 SUI then send abc.sui and xyz.sui each 0.2 SUI. Finally lend 10 USDC on suilend.";

  it("returns a non-empty string", () => {
    const directive = buildChainDecomposeDirective(sampleText);
    expect(typeof directive).toBe("string");
    expect(directive.length).toBeGreaterThan(0);
  });

  it("mentions 'decomposeIntent' (the tool name the model must call)", () => {
    const directive = buildChainDecomposeDirective(sampleText);
    expect(directive).toContain("decomposeIntent");
  });

  it("mentions 'steps' field", () => {
    const directive = buildChainDecomposeDirective(sampleText);
    expect(directive).toMatch(/\bsteps\b/);
  });

  it("mentions 'command' field", () => {
    const directive = buildChainDecomposeDirective(sampleText);
    expect(directive).toMatch(/\bcommand\b/);
  });

  it("mentions 'category' field", () => {
    const directive = buildChainDecomposeDirective(sampleText);
    expect(directive).toMatch(/\bcategory\b/);
  });

  it("mentions 'amountFrom' field", () => {
    const directive = buildChainDecomposeDirective(sampleText);
    expect(directive).toMatch(/\bamountFrom\b/);
  });

  it("includes the original user text", () => {
    const directive = buildChainDecomposeDirective(sampleText);
    expect(directive).toContain(sampleText);
  });

  it("tells model NOT to call prepareTrade", () => {
    const directive = buildChainDecomposeDirective(sampleText);
    expect(directive).toMatch(/prepareTrade/);
    // The directive must explicitly say not to call it.
    expect(directive).toMatch(/[Dd]o NOT call prepareTrade/);
  });

  it("mentions 'explicit' and 'prev-output' amountFrom values", () => {
    const directive = buildChainDecomposeDirective(sampleText);
    expect(directive).toContain("explicit");
    expect(directive).toContain("prev-output");
  });

  it("works with a short text too", () => {
    const short = "swap 1 SUI then lend it";
    const directive = buildChainDecomposeDirective(short);
    expect(directive).toContain("decomposeIntent");
    expect(directive).toContain(short);
  });
});
