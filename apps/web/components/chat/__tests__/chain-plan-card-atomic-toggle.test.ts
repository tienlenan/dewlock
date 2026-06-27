import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChainPlanCard, isAtomicEligible } from "../chain-plan-card";

// Empirical proof that a swap→lend plan renders the atomic toggle. Guards the
// regression where the "Run as 1 transaction (atomic)" button silently disappears.
const swapLendPlan = {
  steps: [
    { index: 0, category: "swap", clause: "swap 0.2 SUI to USDC", amountFrom: "explicit", status: "pending" },
    { index: 1, category: "lend", clause: "lend it on navi", amountFrom: "prev-output", status: "pending" },
  ],
  walletAddress: "0xabc",
  originalText: "swap 0.2 SUI to USDC then lend it on navi",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe("ChainPlanCard atomic toggle", () => {
  it("isAtomicEligible is true for a pending swap→lend plan", () => {
    expect(isAtomicEligible(swapLendPlan)).toBe(true);
  });

  it("renders the atomic toggle when onRunAtomic is provided", () => {
    const html = renderToStaticMarkup(createElement(ChainPlanCard, { plan: swapLendPlan, onRunAtomic: () => {} }));
    expect(html).toContain("Run as 1 transaction");
  });

  it("hides the toggle when onRunAtomic is absent", () => {
    const html = renderToStaticMarkup(createElement(ChainPlanCard, { plan: swapLendPlan }));
    expect(html).not.toContain("Run as 1 transaction");
  });

  it("hides the toggle once a step is signed", () => {
    const signed = { ...swapLendPlan, steps: [{ ...swapLendPlan.steps[0], status: "done" }, swapLendPlan.steps[1]] };
    expect(isAtomicEligible(signed)).toBe(false);
  });
});
