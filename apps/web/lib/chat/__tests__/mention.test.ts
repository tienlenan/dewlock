import { describe, it, expect } from "vitest";
import {
  activeMentionQuery,
  applyMentionSelection,
  substituteMentions,
  filterContacts,
} from "@/lib/chat/mention";

describe("activeMentionQuery", () => {
  it("captures the query after a trailing @", () => {
    const t = "send to @al";
    expect(activeMentionQuery(t, t.length)).toMatchObject({ query: "al", start: 8 });
  });
  it("captures mid-string when the caret sits right after the token", () => {
    const t = "hi @bob there";
    expect(activeMentionQuery(t, 7)).toMatchObject({ query: "bob", start: 3 });
  });
  it("returns null once whitespace closes the token", () => {
    const t = "hi @bob there";
    expect(activeMentionQuery(t, t.length)).toBeNull();
  });
  it("ignores an @ glued to a word (e.g. an email)", () => {
    const t = "user@host";
    expect(activeMentionQuery(t, t.length)).toBeNull();
  });
});

describe("applyMentionSelection", () => {
  it("inserts the full canonical @Name + a trailing space", () => {
    const t = "send to @al";
    const m = activeMentionQuery(t, t.length)!;
    const r = applyMentionSelection(t, m, "Alice");
    expect(r.text).toBe("send to @Alice ");
    expect(r.caret).toBe(r.text.length);
  });
  it("supports multi-word names", () => {
    const t = "pay @mom";
    const m = activeMentionQuery(t, t.length)!;
    expect(applyMentionSelection(t, m, "Mom Wallet").text).toBe("pay @Mom Wallet ");
  });
});

describe("substituteMentions", () => {
  it("rewrites @Name to the bare contact name", () => {
    expect(substituteMentions("send 5 SUI to @Alice", ["Alice"])).toBe("send 5 SUI to Alice");
  });
  it("longest-match wins (Mom Wallet over Mom)", () => {
    expect(substituteMentions("send 1 SUI to @Mom Wallet", ["Mom", "Mom Wallet"])).toBe(
      "send 1 SUI to Mom Wallet",
    );
  });
  it("leaves an unknown @x intact", () => {
    expect(substituteMentions("hi @nobody", ["Alice"])).toBe("hi @nobody");
  });
  it("joins adjacent mentions with a comma (multi-recipient send)", () => {
    // The menu inserts "@Name " with no connector, so two picks land space-separated.
    expect(substituteMentions("send 0.2 SUI to @Alice @Bob", ["Alice", "Bob"])).toBe(
      "send 0.2 SUI to Alice, Bob",
    );
  });
  it("joins three adjacent mentions", () => {
    expect(substituteMentions("send 1 USDC to @a @b @c", ["a", "b", "c"])).toBe(
      "send 1 USDC to a, b, c",
    );
  });
  it("preserves a typed connector between mentions (no double separator)", () => {
    expect(substituteMentions("send 0.2 SUI to @Alice and @Bob", ["Alice", "Bob"])).toBe(
      "send 0.2 SUI to Alice and Bob",
    );
  });
  it("joins adjacent multi-word contact names correctly", () => {
    expect(substituteMentions("send 0.2 SUI to @Mom Wallet @Bob", ["Mom Wallet", "Bob"])).toBe(
      "send 0.2 SUI to Mom Wallet, Bob",
    );
  });
});

describe("filterContacts", () => {
  const cs = [
    { name: "Alice", address: "0x1" },
    { name: "Alan", address: "0x2" },
    { name: "Bob", address: "0x3" },
  ];
  it("an empty query lists everyone (capped)", () => {
    expect(filterContacts(cs, "")).toHaveLength(3);
  });
  it("prefix precedence", () => {
    expect(filterContacts(cs, "al").map((c) => c.name)).toEqual(["Alice", "Alan"]);
  });
  it("exact match comes first", () => {
    expect(filterContacts(cs, "bob")[0].name).toBe("Bob");
  });
});
