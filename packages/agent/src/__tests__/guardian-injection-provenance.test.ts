/**
 * Test: injection provenance gate.
 *
 * Hardening point #6: recipient/amount MUST trace to the literal current user turn.
 * The critical test case is IN-CAP + ON-ALLOWLIST: a transfer that would pass every
 * OTHER gate (small amount, allowed coin, known address) but whose recipient came
 * from memory/pool-data rather than the user's message — must still be BLOCKED.
 *
 * Imports from guardian-gates.ts (pure, no @mysten/sui/transactions dependency)
 * so this test runs without SDK chain initialisation issues.
 */

import { describe, it, expect } from "vitest";
import { checkProvenance } from "../guardian-gates";
import type { TradeProposal } from "../guardian";
import { COIN_TYPES } from "../allowlist";

// Minimal proposal factory — only fields checkProvenance() reads
function makeProposal(overrides: Partial<TradeProposal>): TradeProposal {
  return {
    txBytes: "dummybase64==",
    walletAddress:
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    actionLabel: "Transfer",
    actionType: "transfer",
    coinTypeIn: COIN_TYPES.SUI,
    amountInNative: 4_000_000_000n, // $4 worth at SUI floor price — within $5 cap
    argProvenance: {},
    dailyUsdSpentSoFar: 0,
    ...overrides,
  };
}

const USER_WALLET =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ATTACKER_ADDR =
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

describe("Guardian gate: injection provenance", () => {
  it("passes when recipient explicitly provided by user in current turn", () => {
    const result = checkProvenance(
      makeProposal({
        recipientAddress: ATTACKER_ADDR,
        argProvenance: { recipient: "user_turn", amount: "user_turn", coinType: "user_turn" },
      }),
    );
    expect(result.blocked).toBe(false);
    expect(result.requiresConfirm).toBe(false);
  });

  it("BLOCKS in-cap on-allowlist transfer when recipient came from pool/memory (derived)", () => {
    // THE key test: $4 transfer, SUI coin (both within caps + on allowlist)
    // but recipient was injected via pool name or memory, not typed by user.
    const result = checkProvenance(
      makeProposal({
        recipientAddress: ATTACKER_ADDR,
        amountInNative: 4_000_000_000n, // $4 — under $5 cap
        argProvenance: {
          recipient: "derived", // ← came from memory/pool-data injection
          amount: "user_turn",
          coinType: "user_turn",
        },
      }),
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("not provided in the current user message");
    expect(result.reason).toContain("injection provenance gate");
  });

  it("does NOT block sending to own address even with derived provenance", () => {
    // Self-transfers are always safe regardless of provenance
    const result = checkProvenance(
      makeProposal({
        recipientAddress: USER_WALLET,
        argProvenance: { recipient: "derived" },
      }),
    );
    expect(result.blocked).toBe(false);
  });

  it("requires confirm (not block) when amount is derived but recipient is user_turn", () => {
    // Derived amount → warn with provenance confirm, don't hard-block
    const result = checkProvenance(
      makeProposal({
        recipientAddress: ATTACKER_ADDR,
        argProvenance: {
          recipient: "user_turn",
          amount: "derived", // ← came from memory
          coinType: "user_turn",
        },
      }),
    );
    expect(result.blocked).toBe(false);
    expect(result.requiresConfirm).toBe(true);
  });

  it("requires confirm when coinType is derived (user may not have specified exact type)", () => {
    const result = checkProvenance(
      makeProposal({
        recipientAddress: ATTACKER_ADDR,
        argProvenance: {
          recipient: "user_turn",
          amount: "user_turn",
          coinType: "derived", // ← inferred from context
        },
      }),
    );
    expect(result.blocked).toBe(false);
    expect(result.requiresConfirm).toBe(true);
  });

  it("BLOCKS transfer with derived recipient when amount > 0 and recipient != own wallet", () => {
    const result = checkProvenance(
      makeProposal({
        actionType: "transfer",
        recipientAddress: ATTACKER_ADDR,
        amountInNative: 1_000_000_000n, // $1 — small but non-zero
        argProvenance: { recipient: "derived" },
      }),
    );
    expect(result.blocked).toBe(true);
  });

  it("no argProvenance set → requiresConfirm false, not blocked (unset = undefined = not derived)", () => {
    // Absence of provenance info doesn't default to "derived" — only explicit "derived" triggers
    const result = checkProvenance(
      makeProposal({
        recipientAddress: ATTACKER_ADDR,
        argProvenance: {}, // nothing set
      }),
    );
    expect(result.requiresConfirm).toBe(false);
    expect(result.blocked).toBe(false);
  });
});
