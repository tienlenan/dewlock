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

  // Generalized engine: any 2–8 step plan of allowlisted actions (send/swap/lend/stake) is eligible.
  const plan = (cats: string[]) =>
    ({
      steps: cats.map((category, index) => ({
        index,
        category,
        clause: `${category} step ${index}`,
        amountFrom: index === 0 ? "explicit" : "explicit",
        status: "pending",
      })),
      walletAddress: "0xabc",
      originalText: cats.join(" + "),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  it("multi-recipient send [send,send] is atomic-eligible and renders the toggle", () => {
    expect(isAtomicEligible(plan(["send", "send"]))).toBe(true);
    const html = renderToStaticMarkup(createElement(ChainPlanCard, { plan: plan(["send", "send"]), onRunAtomic: () => {} }));
    expect(html).toContain("Run as 1 transaction");
  });

  it("mixed combos [send,swap] and [swap,lend,send] are atomic-eligible", () => {
    expect(isAtomicEligible(plan(["send", "swap"]))).toBe(true);
    expect(isAtomicEligible(plan(["swap", "lend", "send"]))).toBe(true);
    expect(isAtomicEligible(plan(["send", "stake"]))).toBe(true);
  });

  it("a non-atomic action (bridge/limit) makes the plan ineligible", () => {
    expect(isAtomicEligible(plan(["send", "bridge"]))).toBe(false);
    expect(isAtomicEligible(plan(["limit", "send"]))).toBe(false);
  });

  it("plans outside 2..8 steps are ineligible", () => {
    expect(isAtomicEligible(plan(["send"]))).toBe(false); // single step
    expect(isAtomicEligible(plan(Array(9).fill("send")))).toBe(false); // > 8
  });
});
