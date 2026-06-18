/**
 * Guards the popular-token registry: every entry is a well-formed coin type, and
 * any token flagged swappable MUST actually be in the Guardian allowlist (COIN_TYPES)
 * — so the resolution cache can never imply a non-allowlisted token is swappable.
 */

import { describe, it, expect } from "vitest";
import { POPULAR_TOKENS, popularTokenMemwalLines } from "../popular-tokens";
import { COIN_TYPES } from "../protocol-constants";

const allowlisted = new Set<string>(Object.values(COIN_TYPES));
const COIN_TYPE_RE = /^0x[0-9a-fA-F]+::[A-Za-z0-9_]+::[A-Za-z0-9_]+$/;

describe("popular-tokens registry", () => {
  it("every entry is a well-formed coin type with positive decimals", () => {
    for (const t of POPULAR_TOKENS) {
      expect(t.coinType, t.symbol).toMatch(COIN_TYPE_RE);
      expect(t.decimals, t.symbol).toBeGreaterThan(0);
      expect(t.symbol).toBe(t.symbol.toUpperCase());
    }
  });

  it("swappable=true ONLY for coin types in the Guardian allowlist", () => {
    for (const t of POPULAR_TOKENS) {
      if (t.swappable) expect(allowlisted.has(t.coinType), `${t.symbol} swappable`).toBe(true);
    }
  });

  it("has no duplicate symbols", () => {
    const symbols = POPULAR_TOKENS.map((t) => t.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("serializes one memwal line per token", () => {
    const lines = popularTokenMemwalLines();
    expect(lines).toHaveLength(POPULAR_TOKENS.length);
    expect(lines.every((l) => l.startsWith("token map: "))).toBe(true);
  });
});
