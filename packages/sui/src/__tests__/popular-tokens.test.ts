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
  it("every entry is a well-formed coin type with positive decimals + a valid ticker", () => {
    const TICKER_RE = /^[A-Za-z][A-Za-z0-9]*$/; // mixed-case allowed (e.g. haSUI, afSUI, vSUI)
    for (const t of POPULAR_TOKENS) {
      expect(t.coinType, t.symbol).toMatch(COIN_TYPE_RE);
      expect(t.decimals, t.symbol).toBeGreaterThan(0);
      // Symbol case is display-only — the resolver matches case-insensitively
      // (parse-intent uppercases both the registry key and the query), so the
      // canonical mixed-case staking tickers are safe and must not be mangled.
      expect(t.symbol, `${t.symbol} ticker`).toMatch(TICKER_RE);
    }
  });

  it("swappable=true ONLY for coin types in the Guardian allowlist", () => {
    for (const t of POPULAR_TOKENS) {
      if (t.swappable) expect(allowlisted.has(t.coinType), `${t.symbol} swappable`).toBe(true);
    }
  });

  it("has no duplicate symbols (case-insensitive — the resolver's key space)", () => {
    const keys = POPULAR_TOKENS.map((t) => t.symbol.toUpperCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("serializes one memwal line per token", () => {
    const lines = popularTokenMemwalLines();
    expect(lines).toHaveLength(POPULAR_TOKENS.length);
    expect(lines.every((l) => l.startsWith("token map: "))).toBe(true);
  });
});
