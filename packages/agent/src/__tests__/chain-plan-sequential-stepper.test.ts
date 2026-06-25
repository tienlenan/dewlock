/**
 * Tests: multi-step intent chaining — sequential Track A.
 *
 * Covers:
 *  1. Parser + route carve-out: "swap then lend" → 2 ordered steps, not refused.
 *  2. Delta resolver (C6 guard): step-2 amount == on-chain delta, NOT the pre-existing balance.
 *  3. Stepper: step-2 only builds after step-1 confirm; BLOCK at step-1 halts chain.
 *  4. Daily-spend: net-once per chain at confirm time, not double at Guardian-PASS.
 *  5. VN connector support in the parser.
 *  6. Non-compound intents produce single-step (no regression).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectMultiAction,
  isChainableSequence,
  parseChainSteps,
  type ChainStep,
} from "../intent/detect-multi-action";
import {
  PlanStepper,
  resolveStepDelta,
  type StepState,
} from "../chaining/plan-stepper";
import { COIN_TYPES } from "../allowlist";

// ---------------------------------------------------------------------------
// 1. Parser + route carve-out
// ---------------------------------------------------------------------------

describe("detectMultiAction — existing contract (no regression)", () => {
  it("single swap is NOT multi", () => {
    const r = detectMultiAction("swap 5 SUI to USDC");
    expect(r.multi).toBe(false);
  });

  it("send + swap → multi", () => {
    const r = detectMultiAction("send 5 SUI to Alice and swap 10 USDC");
    expect(r.multi).toBe(true);
    expect(r.actions).toContain("send");
    expect(r.actions).toContain("swap");
  });

  it("read-only intent does not count as action", () => {
    const r = detectMultiAction("swap 5 SUI to USDC and show my portfolio");
    expect(r.multi).toBe(false);
  });
});

describe("isChainableSequence — carve-out for swap→lend and similar ordered pairs", () => {
  it("'swap 5 SUI to USDC then lend it on NAVI' → chainable", () => {
    expect(isChainableSequence(["swap", "lend"])).toBe(true);
  });

  it("'send + swap' → NOT chainable (different category pair)", () => {
    expect(isChainableSequence(["send", "swap"])).toBe(false);
  });

  it("single action → NOT chainable (need 2 steps)", () => {
    expect(isChainableSequence(["swap"])).toBe(false);
  });

  it("3+ steps → NOT chainable (Track A supports exactly 2 steps)", () => {
    expect(isChainableSequence(["swap", "lend", "send"])).toBe(false);
  });
});

describe("parseChainSteps — structured step extraction", () => {
  it("'swap 5 SUI to USDC then lend it on NAVI' → 2 ordered steps", () => {
    const steps = parseChainSteps("swap 5 SUI to USDC then lend it on NAVI");
    expect(steps).not.toBeNull();
    expect(steps!).toHaveLength(2);
    expect(steps![0].category).toBe("swap");
    expect(steps![1].category).toBe("lend");
    // Step 2 uses the output of step 1
    expect(steps![1].amountFrom).toBe("prev-output");
  });

  it("VN connector 'rồi' chains swap→lend", () => {
    const steps = parseChainSteps("swap 5 SUI to USDC rồi lend USDC on NAVI");
    expect(steps).not.toBeNull();
    expect(steps!).toHaveLength(2);
    expect(steps![0].category).toBe("swap");
    expect(steps![1].category).toBe("lend");
  });

  it("VN connector 'và sau đó' chains swap→lend", () => {
    const steps = parseChainSteps("swap 5 SUI và sau đó lend USDC on NAVI");
    expect(steps).not.toBeNull();
    expect(steps![0].category).toBe("swap");
  });

  it("non-compound sentence → null (single-step path; no regression)", () => {
    expect(parseChainSteps("swap 5 SUI to USDC")).toBeNull();
  });

  it("ambiguous compound (send+swap) → null (not a supported chain pattern)", () => {
    expect(parseChainSteps("send 5 SUI to Alice and swap 10 USDC")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Delta resolver (C6 guard — the load-bearing safety test)
// ---------------------------------------------------------------------------

describe("resolveStepDelta — pre/post coin balance delta, NOT the total balance", () => {
  const USDC = COIN_TYPES.USDC;

  it("wallet holds 1000 USDC pre-step; step-1 adds ~18 USDC → delta is ~18, NOT 1018", () => {
    // Pre-snapshot: 1000 USDC in wallet (in base units, 6 decimals)
    const preBalance = 1_000_000_000n; // 1000 USDC (6 dec → 1000 * 10^6)
    // Post-confirm: wallet now has 1018 USDC
    const postBalance = 1_018_000_000n; // 1018 USDC
    const delta = resolveStepDelta(preBalance, postBalance);
    expect(delta).toBe(18_000_000n); // 18 USDC — NOT 1_018_000_000n
  });

  it("delta is zero when post equals pre (step produced no output)", () => {
    expect(resolveStepDelta(100n, 100n)).toBe(0n);
  });

  it("delta cannot be negative (step consumed coin)", () => {
    // The resolver should return 0 (not negative) when post < pre
    expect(resolveStepDelta(1000n, 800n)).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// 3. PlanStepper — state machine
// ---------------------------------------------------------------------------

describe("PlanStepper — ordered step execution and halt semantics", () => {
  const WALLET = "0x" + "a".repeat(64);

  function makeSteps(count = 2): ChainStep[] {
    const base: ChainStep[] = [
      { category: "swap", clause: "swap 5 SUI to USDC", amountFrom: "explicit" },
      { category: "lend", clause: "lend it on NAVI", amountFrom: "prev-output" },
    ];
    return base.slice(0, count);
  }

  it("initialises with all steps pending", () => {
    const stepper = new PlanStepper(WALLET, makeSteps());
    const states = stepper.getStepStates();
    expect(states).toHaveLength(2);
    expect(states.every((s: StepState) => s.status === "pending")).toBe(true);
  });

  it("step 0 becomes 'active' when started, then 'done' on confirm", () => {
    const stepper = new PlanStepper(WALLET, makeSteps());
    stepper.startStep(0);
    expect(stepper.getStepStates()[0].status).toBe("active");

    stepper.confirmStep(0, { txDigest: "0x" + "d".repeat(64) });
    expect(stepper.getStepStates()[0].status).toBe("done");
  });

  it("step 1 does NOT start until step 0 is confirmed", () => {
    const stepper = new PlanStepper(WALLET, makeSteps());
    stepper.startStep(0);
    // Not yet confirmed → step 1 cannot start
    expect(() => stepper.startStep(1)).toThrow();
  });

  it("a BLOCK at step 0 halts the chain — step 1 becomes 'cancelled'", () => {
    const stepper = new PlanStepper(WALLET, makeSteps());
    stepper.startStep(0);
    stepper.blockStep(0, ["Guardian refused: price impact too high"]);

    const states = stepper.getStepStates();
    expect(states[0].status).toBe("blocked");
    expect(states[1].status).toBe("cancelled");
  });

  it("BLOCK at step 0 produces a chain-incomplete marker", () => {
    const stepper = new PlanStepper(WALLET, makeSteps());
    stepper.startStep(0);
    stepper.blockStep(0, ["price_impact"]);

    expect(stepper.isChainIncomplete()).toBe(true);
    expect(stepper.getBlockReasons()).toEqual(["price_impact"]);
  });

  it("chain is complete only when all steps are done", () => {
    const stepper = new PlanStepper(WALLET, makeSteps());
    stepper.startStep(0);
    stepper.confirmStep(0, { txDigest: "0x" + "d".repeat(64) });
    stepper.startStep(1);
    stepper.confirmStep(1, { txDigest: "0x" + "e".repeat(64) });

    expect(stepper.isComplete()).toBe(true);
    expect(stepper.isChainIncomplete()).toBe(false);
  });

  it("currentStepIndex() returns the next pending step index", () => {
    const stepper = new PlanStepper(WALLET, makeSteps());
    expect(stepper.currentStepIndex()).toBe(0);

    stepper.startStep(0);
    stepper.confirmStep(0, { txDigest: "0x" + "d".repeat(64) });
    expect(stepper.currentStepIndex()).toBe(1);
  });

  it("each step carries a single-action shape (no composition)", () => {
    const stepper = new PlanStepper(WALLET, makeSteps());
    const states = stepper.getStepStates();
    // Each step maps to exactly one category (no composite action)
    for (const s of states) {
      expect(s.step.category).toBeDefined();
      // A single step cannot have 2 categories
      expect(Array.isArray(s.step.category)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Daily-spend net-once per chain at sign time
// ---------------------------------------------------------------------------

describe("PlanStepper — daily-spend deduplication across chain steps", () => {
  const WALLET = "0x" + "b".repeat(64);

  it("recording spend twice for same txDigest is idempotent (no double-count)", () => {
    const stepper = new PlanStepper(WALLET, [
      { category: "swap", clause: "swap 5 SUI to USDC", amountFrom: "explicit" },
      { category: "lend", clause: "lend it on NAVI", amountFrom: "prev-output" },
    ]);

    const DIGEST = "0x" + "f".repeat(64);
    stepper.startStep(0);
    stepper.confirmStep(0, { txDigest: DIGEST, usdValue: 20 });

    // A duplicate confirm (e.g. receipt retry) should not double the spend
    stepper.confirmStep(0, { txDigest: DIGEST, usdValue: 20 });

    expect(stepper.totalSignedUsd()).toBe(20);
  });

  it("recycled output step does not double-count when lend follows swap", () => {
    // Swap $20 of SUI → USDC, then lend the USDC.
    // The USDC is the SAME value recycled, not a NEW $20 outflow.
    // The stepper should treat lend-of-swap-output as $0 net external spend.
    const stepper = new PlanStepper(WALLET, [
      { category: "swap", clause: "swap 5 SUI to USDC", amountFrom: "explicit" },
      { category: "lend", clause: "lend it on NAVI", amountFrom: "prev-output" },
    ]);

    stepper.startStep(0);
    stepper.confirmStep(0, { txDigest: "0x" + "aa".padEnd(64, "a"), usdValue: 20 });

    stepper.startStep(1);
    // Lend step: amountFrom = prev-output, so it is a recycled value — 0 net external
    stepper.confirmStep(1, {
      txDigest: "0x" + "bb".padEnd(64, "b"),
      usdValue: 0, // caller passes 0 for recycled lend
      isRecycled: true,
    });

    // Net external spend should be $20 (the swap), not $40
    expect(stepper.totalSignedUsd()).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 5. Stale-object wait — minimal contract test
// ---------------------------------------------------------------------------

describe("PlanStepper — stale-object wait before step-2 build", () => {
  const WALLET = "0x" + "c".repeat(64);

  it("touchedObjectIds captured from step-0 confirm propagates to next step", () => {
    const stepper = new PlanStepper(WALLET, [
      { category: "swap", clause: "swap 5 SUI to USDC", amountFrom: "explicit" },
      { category: "lend", clause: "lend it on NAVI", amountFrom: "prev-output" },
    ]);

    const COIN_OBJ = "0x" + "cc".padEnd(64, "c");
    stepper.startStep(0);
    stepper.confirmStep(0, {
      txDigest: "0x" + "dd".padEnd(64, "d"),
      touchedObjectIds: [COIN_OBJ],
    });

    // The stepper should expose the touched object IDs from the confirmed step
    // so the caller can wait for them before building step 1.
    const waitIds = stepper.objectsToWaitBeforeStep(1);
    expect(waitIds).toContain(COIN_OBJ);
  });
});
