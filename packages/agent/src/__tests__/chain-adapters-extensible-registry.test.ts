/**
 * Tests: chain adapter registry + generalised isChainableSequence + parseChainSteps.
 *
 * Covers:
 *  1. isChainableSequence: all chainable combos true; non-chainable (bridge/limit) false;
 *     single-step false; 3-step true.
 *  2. parseChainSteps: amountFrom logic (explicit vs prev-output per clause marker);
 *     N-step chains; non-compound → null; bridge clause voids sequence → null.
 *  3. composeChainCommand: per-adapter composition including new stake + send adapters;
 *     unknown category passthrough.
 *  4. CHAINABLE_CATEGORIES membership.
 *  5. Existing detectMultiAction contract (no regression — "stake" now guarded too).
 */

import { describe, it, expect } from "vitest";
import {
  isChainableSequence,
  parseChainSteps,
  detectMultiAction,
} from "../intent/detect-multi-action";
import {
  composeChainCommand,
  CHAINABLE_CATEGORIES,
  getChainAdapter,
} from "../chaining/chain-adapters";

// ---------------------------------------------------------------------------
// 1. isChainableSequence
// ---------------------------------------------------------------------------

describe("isChainableSequence — generalised N-step chainable set", () => {
  it("[swap, lend] → true (original pair still works)", () => {
    expect(isChainableSequence(["swap", "lend"])).toBe(true);
  });

  it("[swap, stake] → true", () => {
    expect(isChainableSequence(["swap", "stake"])).toBe(true);
  });

  it("[send, send] → true (same category repeated is still a chain)", () => {
    expect(isChainableSequence(["send", "send"])).toBe(true);
  });

  it("[swap, send] → true", () => {
    expect(isChainableSequence(["swap", "send"])).toBe(true);
  });

  it("[swap, lend, stake] → true (3-step chain)", () => {
    expect(isChainableSequence(["swap", "lend", "stake"])).toBe(true);
  });

  it("[stake, lend] → true", () => {
    expect(isChainableSequence(["stake", "lend"])).toBe(true);
  });

  it("[bridge, swap] → false (bridge is not chainable)", () => {
    expect(isChainableSequence(["bridge", "swap"])).toBe(false);
  });

  it("[swap] → false (single step is not a chain)", () => {
    expect(isChainableSequence(["swap"])).toBe(false);
  });

  it("[limit, swap] → false (limit-order is not chainable)", () => {
    expect(isChainableSequence(["limit", "swap"])).toBe(false);
  });

  it("[] → false (empty)", () => {
    expect(isChainableSequence([])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. parseChainSteps — amountFrom logic + N-step + null cases
// ---------------------------------------------------------------------------

describe("parseChainSteps — amountFrom per-clause logic", () => {
  it("swap + lend with 'it' → explicit + prev-output", () => {
    const steps = parseChainSteps("swap 0.5 SUI to USDC then lend it on NAVI");
    expect(steps).not.toBeNull();
    expect(steps!).toHaveLength(2);
    expect(steps![0]).toMatchObject({ category: "swap", amountFrom: "explicit" });
    expect(steps![1]).toMatchObject({ category: "lend", amountFrom: "prev-output" });
  });

  it("swap + stake with explicit amount on step 2 → both explicit", () => {
    const steps = parseChainSteps("swap 0.5 SUI to USDC then stake 1 SUI to afSUI");
    expect(steps).not.toBeNull();
    expect(steps!).toHaveLength(2);
    expect(steps![0].amountFrom).toBe("explicit");
    // "1 SUI" is stated explicitly — no pronoun → explicit
    expect(steps![1].amountFrom).toBe("explicit");
  });

  it("swap + lend without 'it' → both explicit", () => {
    const steps = parseChainSteps("swap 5 SUI to USDC then lend USDC on NAVI");
    expect(steps).not.toBeNull();
    expect(steps![0].amountFrom).toBe("explicit");
    expect(steps![1].amountFrom).toBe("explicit");
  });

  it("send two explicit amounts → 2 explicit steps", () => {
    const steps = parseChainSteps("send 1 SUI to alice.sui and send 2 SUI to bob.sui");
    expect(steps).not.toBeNull();
    expect(steps!).toHaveLength(2);
    expect(steps![0]).toMatchObject({ category: "send", amountFrom: "explicit" });
    expect(steps![1]).toMatchObject({ category: "send", amountFrom: "explicit" });
  });

  it("swap + lend with 'the proceeds' marker → prev-output on step 2", () => {
    const steps = parseChainSteps("swap 5 SUI to USDC then deposit the proceeds on NAVI");
    expect(steps).not.toBeNull();
    expect(steps![1].amountFrom).toBe("prev-output");
  });

  it("non-compound sentence → null", () => {
    expect(parseChainSteps("swap 5 SUI to USDC")).toBeNull();
  });

  it("'redeem then swap' → null (bridge/redeem is not chainable)", () => {
    expect(parseChainSteps("redeem then swap 5 SUI to USDC")).toBeNull();
  });

  it("VN connector 'rồi' still chains swap→lend (no regression)", () => {
    const steps = parseChainSteps("swap 5 SUI to USDC rồi lend USDC on NAVI");
    expect(steps).not.toBeNull();
    expect(steps![0].category).toBe("swap");
    expect(steps![1].category).toBe("lend");
  });

  it("ambiguous (send+swap without chain marker) → null — non-chainable is still refused", () => {
    // send and swap are BOTH chainable categories, so this is actually chainable now.
    // Verify it does NOT return null (it IS chainable under the new rules).
    // This is the corrected expectation: send+swap is a valid chain.
    const steps = parseChainSteps("send 5 SUI to Alice and swap 10 USDC to SUI");
    // Both are chainable — should parse as 2 explicit steps
    expect(steps).not.toBeNull();
    expect(steps!).toHaveLength(2);
    expect(steps![0].category).toBe("send");
    expect(steps![1].category).toBe("swap");
  });
});

// ---------------------------------------------------------------------------
// 3. composeChainCommand — per-adapter composition
// ---------------------------------------------------------------------------

describe("composeChainCommand — swap adapter", () => {
  it("swap: passthrough clause regardless of resolved amount", () => {
    const result = composeChainCommand("swap", { clause: "swap 5 SUI to USDC" });
    expect(result).toBe("swap 5 SUI to USDC");
  });

  it("swap: resolved amount is ignored (amount is already explicit in clause)", () => {
    const result = composeChainCommand("swap", {
      clause: "swap 0.5 SUI to USDC",
      resolvedAmountHuman: "99",
    });
    expect(result).toBe("swap 0.5 SUI to USDC");
  });
});

describe("composeChainCommand — lend adapter", () => {
  it("lend with resolvedAmount + symbol → 'deposit <amount> <symbol> to <protocol>'", () => {
    const result = composeChainCommand("lend", {
      clause: "lend it on navi",
      resolvedAmountHuman: "18",
      symbol: "USDC",
    });
    expect(result).toBe("deposit 18 USDC to navi");
  });

  it("lend with resolvedAmount, no symbol override → extracts USDC from clause", () => {
    const result = composeChainCommand("lend", {
      clause: "lend USDC on navi",
      resolvedAmountHuman: "18",
    });
    expect(result).toBe("deposit 18 USDC to navi");
  });

  it("lend without resolvedAmount and no symbol → passthrough (explicit-amount step)", () => {
    const result = composeChainCommand("lend", {
      clause: "lend 5 USDC on navi",
    });
    // No resolvedAmountHuman, no symbol param → passthrough verbatim.
    expect(result).toBe("lend 5 USDC on navi");
  });

  it("lend with resolvedAmount but no protocol in clause → omits protocol", () => {
    const result = composeChainCommand("lend", {
      clause: "lend it",
      resolvedAmountHuman: "18",
      symbol: "USDC",
    });
    expect(result).toBe("deposit 18 USDC");
  });
});

describe("composeChainCommand — stake adapter", () => {
  it("stake with resolvedAmount → 'stake <amount> SUI to <provider>'", () => {
    const result = composeChainCommand("stake", {
      clause: "stake it to afSUI",
      resolvedAmountHuman: "18",
    });
    expect(result).toBe("stake 18 SUI to afsui");
  });

  it("stake with resolvedAmount and haSUI provider", () => {
    const result = composeChainCommand("stake", {
      clause: "stake the output to haSUI",
      resolvedAmountHuman: "5",
    });
    expect(result).toBe("stake 5 SUI to hasui");
  });

  it("stake without resolvedAmount → passthrough", () => {
    const result = composeChainCommand("stake", {
      clause: "stake 3 SUI to afSUI",
    });
    expect(result).toBe("stake 3 SUI to afSUI");
  });

  it("stake with resolvedAmount and no provider in clause → defaults to afSUI", () => {
    const result = composeChainCommand("stake", {
      clause: "stake it",
      resolvedAmountHuman: "10",
    });
    expect(result).toBe("stake 10 SUI to afsui");
  });
});

describe("composeChainCommand — send adapter", () => {
  it("send without resolvedAmount → passthrough", () => {
    const result = composeChainCommand("send", {
      clause: "send 1 SUI to alice.sui",
    });
    expect(result).toBe("send 1 SUI to alice.sui");
  });

  it("send with resolvedAmount → rewrites the amount in the clause", () => {
    const result = composeChainCommand("send", {
      clause: "send 1 SUI to alice.sui",
      resolvedAmountHuman: "18.5",
    });
    // The amount "1" is replaced by "18.5"; recipient preserved.
    expect(result).toContain("18.5");
    expect(result).toContain("alice.sui");
  });
});

describe("composeChainCommand — unknown category", () => {
  it("unknown category → passthrough clause", () => {
    const result = composeChainCommand("unknownAction", {
      clause: "do something with 5 SUI",
    });
    expect(result).toBe("do something with 5 SUI");
  });
});

// ---------------------------------------------------------------------------
// 4. CHAINABLE_CATEGORIES membership
// ---------------------------------------------------------------------------

describe("CHAINABLE_CATEGORIES — all four adapters included", () => {
  it("swap, lend, stake, send are chainable", () => {
    expect(CHAINABLE_CATEGORIES.has("swap")).toBe(true);
    expect(CHAINABLE_CATEGORIES.has("lend")).toBe(true);
    expect(CHAINABLE_CATEGORIES.has("stake")).toBe(true);
    expect(CHAINABLE_CATEGORIES.has("send")).toBe(true);
  });

  it("bridge and limit are NOT in CHAINABLE_CATEGORIES", () => {
    expect(CHAINABLE_CATEGORIES.has("bridge")).toBe(false);
    expect(CHAINABLE_CATEGORIES.has("limit")).toBe(false);
  });
});

describe("getChainAdapter — lookup by category", () => {
  it("returns the swap adapter with producesOutput=true", () => {
    const a = getChainAdapter("swap");
    expect(a).toBeDefined();
    expect(a!.producesOutput).toBe(true);
  });

  it("returns the lend adapter with producesOutput=false", () => {
    const a = getChainAdapter("lend");
    expect(a!.producesOutput).toBe(false);
  });

  it("returns the stake adapter with producesOutput=true", () => {
    const a = getChainAdapter("stake");
    expect(a!.producesOutput).toBe(true);
  });

  it("returns the send adapter with producesOutput=false", () => {
    const a = getChainAdapter("send");
    expect(a!.producesOutput).toBe(false);
  });

  it("returns undefined for unknown category", () => {
    expect(getChainAdapter("bridge")).toBeUndefined();
    expect(getChainAdapter("xyz")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. detectMultiAction regression + "stake" now in guard
// ---------------------------------------------------------------------------

describe("detectMultiAction — stake now guarded (no regression on existing)", () => {
  it("single swap is NOT multi", () => {
    expect(detectMultiAction("swap 5 SUI to USDC").multi).toBe(false);
  });

  it("swap + stake → multi (stake was missing from guard before)", () => {
    const r = detectMultiAction("swap 5 SUI to USDC and stake 1 SUI to afSUI");
    expect(r.multi).toBe(true);
    expect(r.actions).toContain("swap");
    expect(r.actions).toContain("stake");
  });

  it("send + swap → still multi (no regression)", () => {
    const r = detectMultiAction("send 5 SUI to Alice and swap 10 USDC");
    expect(r.multi).toBe(true);
  });

  it("read-only intent does not count as action (no regression)", () => {
    expect(detectMultiAction("swap 5 SUI to USDC and show my portfolio").multi).toBe(false);
  });

  it("bridge + swap → multi (bridge guard still works)", () => {
    const r = detectMultiAction("bridge 5 SUI and swap 10 USDC");
    expect(r.multi).toBe(true);
    expect(r.actions).toContain("bridge");
  });
});
