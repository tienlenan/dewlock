import { describe, it, expect } from "vitest";
import { detectRecipient, truncateAddress } from "@/lib/chat/recipient-detect";

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
