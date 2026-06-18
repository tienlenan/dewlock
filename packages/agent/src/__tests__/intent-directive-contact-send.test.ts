/**
 * Tests: send-to-friend-name resolution in buildIntentDirective. The route passes the
 * wallet's address book; resolution is deterministic (1 → send with exact 0x, 2+ → picker,
 * 0 → SuiNS). 0x / .sui recipients keep the existing direct-send path (regression guard).
 */

import { describe, it, expect } from "vitest";
import { buildIntentDirective } from "../intent/intent-directive";
import { checkProvenance } from "../guardian";
import type { TradeProposal } from "../guardian";
import { COIN_TYPES } from "../allowlist";
import type { StoredContact } from "../memory/contacts";

const WALLET = "0x" + "1".repeat(64);
const ADDR_A = "0x" + "a".repeat(64);
const ADDR_B = "0x" + "b".repeat(64);
const book: StoredContact[] = [
  { name: "Thomas", address: ADDR_A },
  { name: "Thomas S", address: ADDR_B },
];

describe("buildIntentDirective — contact resolution", () => {
  it("1 match → prepareTrade transfer with the EXACT address + user_turn provenance (so the Guardian does not hard-block it)", async () => {
    const d = await buildIntentDirective("send 1 SUI to thomas", WALLET, [{ name: "Thomas", address: ADDR_A }]);
    expect(d).toContain("prepareTrade");
    expect(d).toContain(ADDR_A);
    // Must be user_turn, NOT derived — a derived recipient is hard-blocked by the
    // injection-provenance gate (the C1 runtime bug). Book-resolved = first-party.
    expect(d).toContain('"recipient": "user_turn"');
    expect(d).not.toContain('"recipient": "derived"');
    expect(d).not.toContain("requestContactPicker");
  });

  it("2+ matches → requestContactPicker with the candidates", async () => {
    const d = await buildIntentDirective("send 1 SUI to thom", WALLET, book);
    expect(d).toContain("requestContactPicker");
    expect(d).toContain(ADDR_A);
    expect(d).toContain(ADDR_B);
  });

  it("0 matches → falls through to the generic send (SuiNS path), no picker", async () => {
    const d = await buildIntentDirective("send 1 SUI to bob", WALLET, book);
    expect(d).not.toContain("requestContactPicker");
    expect(d).toContain("transfer");
  });

  it("a 0x recipient is never treated as a contact (no picker)", async () => {
    const d = await buildIntentDirective(`send 1 SUI to ${ADDR_A}`, WALLET, book);
    expect(d).not.toContain("requestContactPicker");
    expect(d).toContain("transfer");
  });

  it("a .sui recipient is never treated as a contact (no picker)", async () => {
    const d = await buildIntentDirective("send 1 SUI to alice.sui", WALLET, book);
    expect(d).not.toContain("requestContactPicker");
    expect(d).toContain("transfer");
  });

  it("no book supplied → generic send (no resolution)", async () => {
    const d = await buildIntentDirective("send 1 SUI to thomas", WALLET, []);
    expect(d).not.toContain("requestContactPicker");
    expect(d).toContain("transfer");
  });

  it("coin type is recognized (sanity: SUI parses)", () => {
    expect(COIN_TYPES.SUI).toMatch(/^0x.+::sui::SUI$/);
  });
});

// Guardian-level contract: the coverage gap that hid C1. A book-resolved transfer carries
// recipient="user_turn" and must NOT be hard-blocked; a genuinely injected (derived)
// recipient still IS blocked.
describe("checkProvenance — book-resolved vs injected recipient", () => {
  function transfer(recipient: "user_turn" | "derived"): TradeProposal {
    return {
      actionType: "transfer",
      amountInNative: 1_000_000_000n,
      recipientAddress: ADDR_A,
      walletAddress: WALLET,
      argProvenance: { recipient, amount: "user_turn" },
    } as unknown as TradeProposal;
  }

  it("a book-resolved (user_turn) recipient is NOT blocked", () => {
    const r = checkProvenance(transfer("user_turn"));
    expect(r.blocked).toBe(false);
  });

  it("a derived (injected) recipient IS hard-blocked", () => {
    const r = checkProvenance(transfer("derived"));
    expect(r.blocked).toBe(true);
  });
});
