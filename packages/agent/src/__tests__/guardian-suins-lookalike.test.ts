/**
 * Test: SuiNS lookalike gate.
 *
 * Hardening point #8: homoglyph-normalized edit-distance ≤ 2 against verified
 * contacts triggers a block. The demo case is "888-l.sui" vs "888.sui".
 *
 * Imports from guardian-gates.ts and allowlist.ts (pure modules, no SDK deps).
 */

import { describe, it, expect } from "vitest";
import {
  normalizeHomoglyphs,
  editDistance,
  LOOKALIKE_EDIT_DISTANCE_THRESHOLD,
} from "../allowlist";
import { checkSuiNSLookalike } from "../guardian-gates";

describe("Homoglyph normalizer", () => {
  it("maps digits to letter lookalikes", () => {
    expect(normalizeHomoglyphs("0")).toBe("o");
    expect(normalizeHomoglyphs("1")).toBe("l");
    expect(normalizeHomoglyphs("3")).toBe("e");
  });

  it("normalizes Cyrillic а to ASCII a", () => {
    // Cyrillic "а" (U+0430) looks identical to Latin "a" (U+0061)
    expect(normalizeHomoglyphs("а")).toBe("a");
  });

  it("lowercases input", () => {
    expect(normalizeHomoglyphs("ALICE")).toBe("alice");
  });

  it("leaves already-canonical ASCII unchanged", () => {
    expect(normalizeHomoglyphs("alice")).toBe("alice");
    expect(normalizeHomoglyphs("bob")).toBe("bob");
  });

  it("maps '8' to 'b'", () => {
    const result = normalizeHomoglyphs("8");
    expect(result).toBe("b");
  });
});

describe("Edit distance", () => {
  it("identical strings → 0", () => {
    expect(editDistance("alice", "alice")).toBe(0);
  });

  it("single deletion → 1", () => {
    expect(editDistance("alice", "alic")).toBe(1);
  });

  it("single substitution → 1", () => {
    expect(editDistance("alice", "alyce")).toBe(1); // i→y
  });

  it("'888.sui' label vs '88.sui' label → edit distance 1 (deletion)", () => {
    expect(editDistance("888", "88")).toBe(1);
  });

  it("'888-l' vs '888' → edit distance 2 (insert '-' and 'l')", () => {
    // After stripping .sui: "888-l" vs "888"
    expect(editDistance("888-l", "888")).toBe(2);
  });

  it("threshold is 2 per spec", () => {
    expect(LOOKALIKE_EDIT_DISTANCE_THRESHOLD).toBe(2);
  });
});

describe("Guardian gate: SuiNS lookalike detection", () => {
  it("exact match is NOT a lookalike (same name, distance 0)", () => {
    const result = checkSuiNSLookalike("888.sui", ["888.sui"]);
    expect(result.suspect).toBe(false);
  });

  it("'888-l.sui' vs '888.sui' → flagged (edit distance 2, at threshold)", () => {
    // The canonical demo case from the spec
    const result = checkSuiNSLookalike("888-l.sui", ["888.sui"]);
    expect(result.suspect).toBe(true);
    expect(result.similarTo).toBe("888.sui");
  });

  it("single-char deletion → flagged (edit distance 1, below threshold)", () => {
    const result = checkSuiNSLookalike("88.sui", ["888.sui"]);
    expect(result.suspect).toBe(true);
  });

  it("edit distance 3 → NOT flagged (beyond threshold)", () => {
    const result = checkSuiNSLookalike("abcde.sui", ["xyz.sui"]);
    expect(result.suspect).toBe(false);
  });

  it("Cyrillic 'а' (U+0430) + extra char → flagged after normalization", () => {
    // "аlicee.sui" (Cyrillic а + extra e) → normalized "alicee" vs "alice" → dist 1
    const cyrillicAlicee = "аlicee"; // Cyrillic а
    const result = checkSuiNSLookalike(`${cyrillicAlicee}.sui`, ["alice.sui"]);
    expect(result.suspect).toBe(true);
  });

  it("Cyrillic exact-match after normalization → NOT a lookalike (same normalized form)", () => {
    // "аlice.sui" (Cyrillic а) normalizes to "alice" = same as "alice.sui" → not suspect
    const cyrillicAlice = "аlice"; // Cyrillic а
    const result = checkSuiNSLookalike(`${cyrillicAlice}.sui`, ["alice.sui"]);
    expect(result.suspect).toBe(false);
  });

  it("empty verified contacts → never flagged", () => {
    const result = checkSuiNSLookalike("888.sui", []);
    expect(result.suspect).toBe(false);
    expect(result.similarTo).toBeNull();
  });

  it("completely different names → not flagged", () => {
    const result = checkSuiNSLookalike("vitalik.sui", ["888.sui", "alice.sui", "bob.sui"]);
    expect(result.suspect).toBe(false);
  });

  it("flags against the first matching contact in the list", () => {
    const result = checkSuiNSLookalike("88.sui", ["alice.sui", "888.sui", "bob.sui"]);
    expect(result.suspect).toBe(true);
    expect(result.similarTo).toBe("888.sui");
  });

  it("strips .sui suffix before comparing", () => {
    const result = checkSuiNSLookalike("888-l", ["888.sui"]);
    expect(result.suspect).toBe(true);
  });
});
