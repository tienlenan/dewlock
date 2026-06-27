import { describe, it, expect } from "vitest";
import { detectRecipient, detectRecipients, truncateAddress } from "@/lib/chat/recipient-detect";

const ADDR = "0x" + "a".repeat(64);

describe("detectRecipient", () => {
  it("a .sui name after a send → suins", () => {
    expect(detectRecipient("send 5 SUI to alice.sui")).toEqual({ token: "alice.sui", kind: "suins" });
  });
  it("a full 0x after a send → address", () => {
    expect(detectRecipient(`send 1 SUI to ${ADDR}`)).toEqual({ token: ADDR, kind: "address" });
  });
  it("a partial 0x is still address kind (still typing)", () => {
    expect(detectRecipient("send 1 SUI to 0xabc")).toEqual({ token: "0xabc", kind: "address" });
  });
  it("an @mention → mention with the leading @ stripped", () => {
    expect(detectRecipient("send 1 SUI to @Bob")).toEqual({ token: "Bob", kind: "mention" });
  });
  it("a bare word after a send → bareword (hook resolves vs contacts)", () => {
    expect(detectRecipient("send 1 SUI to bob")).toEqual({ token: "bob", kind: "bareword" });
  });
  it("a standalone pasted address / .sui name is a recipient", () => {
    expect(detectRecipient("alice.sui").kind).toBe("suins");
    expect(detectRecipient(ADDR).kind).toBe("address");
  });
  it("a swap's 'to <token>' is the destination token, NOT a recipient", () => {
    expect(detectRecipient("swap 10 SUI to USDC").kind).toBe("none");
  });
  it("bare command words and read-only intents → none", () => {
    expect(detectRecipient("my portfolio").kind).toBe("none");
    expect(detectRecipient("swap").kind).toBe("none");
    expect(detectRecipient("lend").kind).toBe("none");
    expect(detectRecipient("").kind).toBe("none");
  });
});

describe("truncateAddress", () => {
  it("shortens a long 0x", () => {
    expect(truncateAddress(ADDR)).toBe("0xaaaa…aaaa");
  });
  it("leaves short strings unchanged", () => {
    expect(truncateAddress("0xabc")).toBe("0xabc");
  });
});

describe("detectRecipients (multi-recipient send)", () => {
  const tokens = (t: string) => detectRecipients(t).map((r) => r.token);

  it("returns one mention token per friend (adjacent @mentions)", () => {
    expect(tokens("send 0.2 SUI to @Alice @Bob")).toEqual(["Alice", "Bob"]);
  });

  it("strips a typed connector / comma between mentions", () => {
    expect(tokens("send 0.2 SUI to @Alice and @Bob")).toEqual(["Alice", "Bob"]);
    expect(tokens("send 1 USDC to @a, @b, @c")).toEqual(["a", "b", "c"]);
  });

  it("keeps multi-word contact names intact", () => {
    expect(tokens("send 0.2 SUI to @Mom Wallet @Bob")).toEqual(["Mom Wallet", "Bob"]);
  });

  it("falls back to the single recipient for one mention", () => {
    expect(detectRecipients("send 0.2 SUI to @Alice")).toEqual([{ token: "Alice", kind: "mention" }]);
  });

  it("single typed address is one recipient", () => {
    const r = detectRecipients("send 1 SUI to alice.sui");
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe("suins");
  });

  it("no recipient → empty list", () => {
    expect(detectRecipients("swap 1 SUI to USDC")).toEqual([]);
  });
});
