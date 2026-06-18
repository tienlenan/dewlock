/**
 * Tests: matchContacts — the deterministic name resolver for "send to <friend>".
 * Pure function, no IO. Verifies the 1 / 2+ / 0 outcomes the route depends on.
 */

import { describe, it, expect } from "vitest";
import { matchContacts, type StoredContact } from "../memory/contacts";

const book: StoredContact[] = [
  { name: "Thomas", address: "0x" + "a".repeat(64) },
  { name: "Thomas S", address: "0x" + "b".repeat(64) },
  { name: "Alice", address: "0x" + "c".repeat(64) },
];

describe("matchContacts", () => {
  it("exact match (case-insensitive) wins over prefixes — 1 result", () => {
    const m = matchContacts(book, "thomas");
    expect(m).toHaveLength(1);
    expect(m[0].name).toBe("Thomas");
  });

  it("prefix with no exact match returns all candidates — 2+ results (picker)", () => {
    const m = matchContacts(book, "thom");
    expect(m.map((c) => c.name).sort()).toEqual(["Thomas", "Thomas S"]);
  });

  it("substring match when no exact/prefix", () => {
    const m = matchContacts(book, "lic");
    expect(m).toHaveLength(1);
    expect(m[0].name).toBe("Alice");
  });

  it("no match returns [] (SuiNS fallback)", () => {
    expect(matchContacts(book, "bob")).toEqual([]);
  });

  it("empty query returns []", () => {
    expect(matchContacts(book, "  ")).toEqual([]);
  });

  it("is case-insensitive both ways", () => {
    expect(matchContacts(book, "ALICE")).toHaveLength(1);
    expect(matchContacts([{ name: "bob", address: "0x" + "d".repeat(64) }], "BOB")).toHaveLength(1);
  });
});
