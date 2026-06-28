import { describe, it, expect } from "vitest";
import { splitMessageByContacts } from "@/lib/chat/resolve-message-contacts";

const book = [
  { name: "Alice", address: "0xaaa0000000000000000000000000000000000000000000000000000000000001" },
  { name: "Bob", address: "0xbbb0000000000000000000000000000000000000000000000000000000000002" },
  { name: "Mom", address: "0xmom0000000000000000000000000000000000000000000000000000000000003" },
  { name: "Mom Wallet", address: "0xmomwallet00000000000000000000000000000000000000000000000000000004" },
];

describe("splitMessageByContacts", () => {
  it("annotates each contact name occurrence (multi-recipient send)", () => {
    const segs = splitMessageByContacts("send 0.2 SUI to Alice, Bob", book);
    expect(segs).toEqual([
      "send 0.2 SUI to ",
      { name: "Alice", address: book[0].address },
      ", ",
      { name: "Bob", address: book[1].address },
    ]);
  });

  it("longest-match wins (Mom Wallet over Mom)", () => {
    const segs = splitMessageByContacts("send 1 SUI to Mom Wallet", book);
    expect(segs).toEqual(["send 1 SUI to ", { name: "Mom Wallet", address: book[3].address }]);
  });

  it("annotates by resolved 0x ADDRESS (mentions now carry the address)", () => {
    // After substituteMentions, "@Alice @Bob" becomes "0xaaa…001, 0xbbb…002" in the sent text.
    const segs = splitMessageByContacts(`send 0.2 SUI to ${book[0].address}, ${book[1].address}`, book);
    expect(segs).toEqual([
      "send 0.2 SUI to ",
      { name: "Alice", address: book[0].address },
      ", ",
      { name: "Bob", address: book[1].address },
    ]);
  });

  it("leaves a pasted bare 0x with no saved contact as plain text", () => {
    const unknown = "0xdead000000000000000000000000000000000000000000000000000000009999";
    expect(splitMessageByContacts(`send 1 SUI to ${unknown}`, book)).toEqual([`send 1 SUI to ${unknown}`]);
  });

  it("returns plain text unchanged with no contacts", () => {
    expect(splitMessageByContacts("send 1 SUI to Alice", [])).toEqual(["send 1 SUI to Alice"]);
  });

  it("returns plain text unchanged when no name matches", () => {
    expect(splitMessageByContacts("swap 1 SUI to USDC", book)).toEqual(["swap 1 SUI to USDC"]);
  });

  it("does not match a name embedded inside a longer word", () => {
    // "Bob" must not match inside "Bobsleigh".
    expect(splitMessageByContacts("Bobsleigh team", book)).toEqual(["Bobsleigh team"]);
  });
});
