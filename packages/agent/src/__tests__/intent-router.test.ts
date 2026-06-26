import { describe, it, expect } from "vitest";
import {
  routeAction,
  categoryForActionType,
  assertActionMatchesText,
} from "../intent/intent-router";

// ---------------------------------------------------------------------------
// routeAction
// ---------------------------------------------------------------------------

describe("routeAction — value-verb classification", () => {
  it("swap 5 SUI to USDC → swap", () => {
    expect(routeAction("swap 5 SUI to USDC")).toBe("swap");
  });

  it("sell 10 SUI for USDC → swap (sell is a swap keyword)", () => {
    expect(routeAction("sell 10 SUI for USDC")).toBe("swap");
  });

  it("lend 5 USDC on navi → lend", () => {
    expect(routeAction("lend 5 USDC on navi")).toBe("lend");
  });

  it("deposit 100 USDC to suilend → lend", () => {
    expect(routeAction("deposit 100 USDC to suilend")).toBe("lend");
  });

  it("stake 10 SUI → stake", () => {
    expect(routeAction("stake 10 SUI")).toBe("stake");
  });

  it("stake 5 SUI to afsui → stake", () => {
    expect(routeAction("stake 5 SUI to afsui")).toBe("stake");
  });

  it("send 1 SUI to alice → send", () => {
    expect(routeAction("send 1 SUI to alice")).toBe("send");
  });

  it("transfer 2 USDC to 0xabc → send", () => {
    expect(routeAction("transfer 2 USDC to 0xabc")).toBe("send");
  });

  it("pay 1 SUI to bob → send", () => {
    expect(routeAction("pay 1 SUI to bob")).toBe("send");
  });

  it("bridge USDC to ethereum → bridge", () => {
    expect(routeAction("bridge USDC to ethereum")).toBe("bridge");
  });

  it("redeem my bridge → bridge", () => {
    expect(routeAction("redeem my bridge")).toBe("bridge");
  });

  it("limit order SUI at 3.50 → limit", () => {
    expect(routeAction("limit order SUI at 3.50")).toBe("limit");
  });

  it("show my portfolio → null (read-only)", () => {
    expect(routeAction("show my portfolio")).toBeNull();
  });

  it("what's the best yield → null (read-only)", () => {
    expect(routeAction("what's the best yield")).toBeNull();
  });

  it("check my balance → null (read-only)", () => {
    expect(routeAction("check my balance")).toBeNull();
  });

  it("portfolio → null (read-only)", () => {
    expect(routeAction("portfolio")).toBeNull();
  });

  it("where can I get the best APY? → null (read-only)", () => {
    expect(routeAction("where can I get the best APY?")).toBeNull();
  });

  it("5 SUI USDC → null (no verb)", () => {
    expect(routeAction("5 SUI USDC")).toBeNull();
  });

  it("empty string → null", () => {
    expect(routeAction("")).toBeNull();
  });

  it("whitespace only → null", () => {
    expect(routeAction("   ")).toBeNull();
  });

  it("first-clause wins: swap … then lend → swap (only first clause matters)", () => {
    // multi-action is handled upstream; router only classifies the primary intent
    expect(routeAction("swap 5 SUI to USDC then lend it")).toBe("swap");
  });
});

// ---------------------------------------------------------------------------
// categoryForActionType
// ---------------------------------------------------------------------------

describe("categoryForActionType — actionType → router category", () => {
  it("swap → swap", () => {
    expect(categoryForActionType("swap")).toBe("swap");
  });

  it("lend_deposit → lend", () => {
    expect(categoryForActionType("lend_deposit")).toBe("lend");
  });

  it("lend_repay → lend", () => {
    expect(categoryForActionType("lend_repay")).toBe("lend");
  });

  it("lend_borrow → lend", () => {
    expect(categoryForActionType("lend_borrow")).toBe("lend");
  });

  it("lend_withdraw → lend", () => {
    expect(categoryForActionType("lend_withdraw")).toBe("lend");
  });

  it("stake → stake", () => {
    expect(categoryForActionType("stake")).toBe("stake");
  });

  it("unstake → stake", () => {
    expect(categoryForActionType("unstake")).toBe("stake");
  });

  it("transfer → send", () => {
    expect(categoryForActionType("transfer")).toBe("send");
  });

  it("limit_order → limit", () => {
    expect(categoryForActionType("limit_order")).toBe("limit");
  });

  it("bridge_redeem → bridge", () => {
    expect(categoryForActionType("bridge_redeem")).toBe("bridge");
  });

  // Deliberately unchecked actionTypes
  it("composite → null (multi-leg, no single NL verb)", () => {
    expect(categoryForActionType("composite")).toBeNull();
  });

  it("cancel_order → null (DeepBook lifecycle, UI-driven)", () => {
    expect(categoryForActionType("cancel_order")).toBeNull();
  });

  it("bm_create → null (onboarding wizard, not NL-driven)", () => {
    expect(categoryForActionType("bm_create")).toBeNull();
  });

  it("bm_deposit → null (onboarding wizard, not NL-driven)", () => {
    expect(categoryForActionType("bm_deposit")).toBeNull();
  });

  it("withdraw_settled → null (order management UI)", () => {
    expect(categoryForActionType("withdraw_settled")).toBeNull();
  });

  it("claim_settled → null (order management UI)", () => {
    expect(categoryForActionType("claim_settled")).toBeNull();
  });

  it("unknown string → null", () => {
    expect(categoryForActionType("unknown_action")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// assertActionMatchesText — the load-bearing safety gate
// ---------------------------------------------------------------------------

describe("assertActionMatchesText — cross-check gate", () => {
  // --- Hard blocks (positive mismatch) ---

  it("lend text + swap actionType → ok:false (LLM routing error blocked)", () => {
    const r = assertActionMatchesText("lend 5 USDC on navi", "swap");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/doesn't match/);
    expect(r.reason).toMatch(/"swap"/);
    expect(r.reason).toMatch(/"lend"/);
  });

  it("stake text + lend_deposit actionType → ok:false", () => {
    const r = assertActionMatchesText("stake 10 SUI", "lend_deposit");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/"lend_deposit"/);
    expect(r.reason).toMatch(/"stake"/);
  });

  it("send text + swap actionType → ok:false", () => {
    const r = assertActionMatchesText("send 1 SUI to alice", "swap");
    expect(r.ok).toBe(false);
  });

  it("swap text + lend_deposit actionType → ok:false", () => {
    const r = assertActionMatchesText("swap 5 SUI to USDC", "lend_deposit");
    expect(r.ok).toBe(false);
  });

  it("bridge text + swap actionType → ok:false", () => {
    const r = assertActionMatchesText("bridge USDC to eth", "swap");
    expect(r.ok).toBe(false);
  });

  // --- Clean passes (matching categories) ---

  it("swap text + swap actionType → ok:true", () => {
    expect(assertActionMatchesText("swap 5 SUI to USDC", "swap").ok).toBe(true);
  });

  it("lend text + lend_deposit actionType → ok:true", () => {
    expect(assertActionMatchesText("lend 5 USDC on navi", "lend_deposit").ok).toBe(true);
  });

  it("deposit text + lend_repay actionType → ok:true (both → lend)", () => {
    expect(assertActionMatchesText("deposit 10 USDC to suilend", "lend_repay").ok).toBe(true);
  });

  it("stake text + stake actionType → ok:true", () => {
    expect(assertActionMatchesText("stake 10 SUI", "stake").ok).toBe(true);
  });

  it("stake text + unstake actionType → ok:true (both → stake category)", () => {
    expect(assertActionMatchesText("stake 10 SUI", "unstake").ok).toBe(true);
  });

  it("send text + transfer actionType → ok:true", () => {
    expect(assertActionMatchesText("send 1 SUI to alice", "transfer").ok).toBe(true);
  });

  // --- No false positives: null on either side → pass ---

  it("read-only text + any actionType → ok:true (no false positive)", () => {
    // routeAction returns null for read-only text → pass regardless of actionType
    expect(assertActionMatchesText("show my portfolio", "swap").ok).toBe(true);
    expect(assertActionMatchesText("what's the yield?", "lend_deposit").ok).toBe(true);
    expect(assertActionMatchesText("check my balance", "transfer").ok).toBe(true);
  });

  it("ambiguous text (no verb) + swap actionType → ok:true (no false positive)", () => {
    // routeAction("5 SUI USDC") → null → pass
    expect(assertActionMatchesText("5 SUI USDC", "swap").ok).toBe(true);
  });

  it("empty text + any actionType → ok:true (no false positive)", () => {
    expect(assertActionMatchesText("", "swap").ok).toBe(true);
  });

  it("composite actionType + any text → ok:true (composite skipped)", () => {
    // categoryForActionType("composite") → null → pass even if text has a swap verb
    expect(assertActionMatchesText("swap 5 SUI to USDC", "composite").ok).toBe(true);
    expect(assertActionMatchesText("lend 5 USDC", "composite").ok).toBe(true);
  });

  it("cancel_order actionType + any text → ok:true (DeepBook lifecycle skipped)", () => {
    expect(assertActionMatchesText("stake 10 SUI", "cancel_order").ok).toBe(true);
  });

  it("bm_create actionType + swap text → ok:true (onboarding skipped)", () => {
    expect(assertActionMatchesText("swap 5 SUI", "bm_create").ok).toBe(true);
  });

  it("withdraw_settled + stake text → ok:true (order mgmt skipped)", () => {
    expect(assertActionMatchesText("stake 10 SUI", "withdraw_settled").ok).toBe(true);
  });

  // --- Reason message format ---

  it("block reason includes the actionType and the routed category", () => {
    const r = assertActionMatchesText("lend 5 USDC on navi", "swap");
    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe("string");
    // Must be safe to surface to the user — no stack traces, no internal symbols
    expect(r.reason).not.toMatch(/Error/);
    expect(r.reason).toMatch(/rephrase/i);
  });
});
