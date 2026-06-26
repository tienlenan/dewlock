/**
 * decomposeIntent — Mastra tool for HYBRID multi-intent decomposition.
 *
 * WHY this exists (the moat):
 *  The regex chain parser (parseChainSteps) splits only on conjunctions
 *  (then/and/also/plus/,;&+) and therefore FAILS on:
 *   - "finally"/"." as step separators
 *   - multi-recipient single sends ("send A and B each 0.2")
 *   - per-clause amounts that the regex can't assign
 *  Example that mis-parses: "Swap 1 SUI then send abc.sui and xyz.sui each 0.2 SUI.
 *  Finally lend 10 USDC on suilend."
 *
 *  The LLM handles these cleanly — BUT the LLM must never execute value moves
 *  without deterministic verification. This tool's design enforces that:
 *   - The LLM PROPOSES the decomposition (via the tool's inputSchema args).
 *   - The tool's execute DETERMINISTICALLY VERIFIES each step (fail-closed).
 *   - Specifically, routeAction(step.command) must agree with the LLM-declared
 *     category — the same deterministic classification the Guardian already uses.
 *   - Any verification failure REJECTS THE WHOLE DECOMPOSITION (fail-closed,
 *     never a partial chainPlan).
 *
 * Each approved step's `clause` then re-enters the single-action pipeline exactly
 * like a regex chain step — full Guardian + per-step signature. Nothing here
 * touches PTB construction or value execution.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { CHAINABLE_CATEGORIES } from "../chaining/chain-adapters";
import { routeAction } from "../intent/intent-router";
import { detectMultiAction } from "../intent/detect-multi-action";

// ---------------------------------------------------------------------------
// Pure verification logic — exported for direct testing (no Mastra/Zod wrapper)
// ---------------------------------------------------------------------------

export interface DecomposeStep {
  command: string;
  category: string;
  amountFrom: "explicit" | "prev-output";
}

export interface DecomposeVerifyResult {
  ok: true;
  steps: Array<{ index: number; category: string; clause: string; amountFrom: string; status: string }>;
  reasons?: never;
}

export interface DecomposeBlockResult {
  ok: false;
  steps?: never;
  reasons: string[];
}

/**
 * DETERMINISTIC VERIFIER — the moat.
 *
 * The LLM proposes a decomposition; this function independently verifies it.
 * Any failure rejects the WHOLE decomposition (fail-closed). Rules:
 *  A. At least 2 steps required.
 *  B. Every declared category must be in CHAINABLE_CATEGORIES (swap/lend/stake/send).
 *  C. routeAction(step.command) cross-check: the deterministic router must agree with
 *     the LLM-declared category. This catches LLM decomposition errors — the same guard
 *     that protects prepareTrade actionType routing now protects per-step categories.
 *  D. Step 0 amountFrom must be "explicit" (no prior step to consume output from).
 *
 * All failures are collected before returning so the LLM sees the full rejection reason.
 */
export function verifyDecomposeSteps(steps: DecomposeStep[]): DecomposeVerifyResult | DecomposeBlockResult {
  const reasons: string[] = [];

  // Rule A: at least 2 steps.
  if (!steps || steps.length < 2) {
    return { ok: false, reasons: ["decomposeIntent requires at least 2 steps."] };
  }

  // Rule B: every declared category must be chainable (swap/lend/stake/send).
  for (const step of steps) {
    if (!CHAINABLE_CATEGORIES.has(step.category)) {
      reasons.push(
        `Category "${step.category}" is not a chainable action (must be: ${[...CHAINABLE_CATEGORIES].join(", ")}).`,
      );
    }
  }

  // Rule C: cross-check — routeAction(step.command) must agree with the LLM-declared category.
  // This is the core moat: the deterministic router must independently confirm each step's
  // action type. A mismatch means the LLM proposed an incorrect decomposition — reject it.
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const routed = routeAction(step.command);
    if (routed === null || routed !== step.category) {
      reasons.push(
        `Step ${i} cross-check failed: command "${step.command}" routes to "${routed ?? "null"}" ` +
          `but declared category is "${step.category}".`,
      );
    }

    // Rule E: the command must be EXACTLY ONE action. routeAction only classifies the first
    // clause, so a command that hides a second action behind "." / "finally" (e.g.
    // "swap 1 SUI to USDC. send all to 0xattacker") would pass the cross-check with the
    // smuggled send riding in the clause. detectMultiAction now splits on those separators —
    // reject any command carrying more than one action so each step stays a single,
    // independently-previewed (WYSIWYS) action.
    if (detectMultiAction(step.command).multi) {
      reasons.push(
        `Step ${i} command bundles multiple actions (must be exactly one): "${step.command}".`,
      );
    }
  }

  // Rule D: first step cannot consume a prior output (there is no prior step).
  if (steps[0]?.amountFrom !== "explicit") {
    reasons.push(
      `Step 0 must have amountFrom="explicit" (the first step cannot consume a prior output).`,
    );
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  // All checks passed — return the verified decomposition.
  return {
    ok: true,
    steps: steps.map((s, i) => ({
      index: i,
      category: s.category,
      clause: s.command,
      amountFrom: s.amountFrom,
      status: "pending",
    })),
  };
}

// ---------------------------------------------------------------------------
// Mastra tool — wraps verifyDecomposeSteps; LLM calls this via tool-use
// ---------------------------------------------------------------------------

export const decomposeIntent = createTool({
  id: "decomposeIntent",
  description:
    "Call this ONLY for a multi-step compound request that cannot be parsed by simple conjunctions " +
    "(e.g. uses 'finally', '.', 'each', or has per-step amounts that connectors can't split). " +
    "Pass `steps` as an ordered array of COMPLETE single-action command strings, one per action. " +
    "Each step needs: `command` (a self-contained natural-language command, e.g. 'swap 1 SUI to USDC'), " +
    "`category` (one of: swap, lend, stake, send), and `amountFrom`: " +
    "'explicit' when the user stated the amount in this command, " +
    "'prev-output' when this step consumes the prior step's output ('lend it', 'send the proceeds'). " +
    "The first step is ALWAYS 'explicit'. " +
    "Do NOT call prepareTrade for this turn — the decomposition result drives sequential signing.",

  inputSchema: z.object({
    steps: z
      .array(
        z.object({
          /** A COMPLETE single-action command string the user intended (e.g. "swap 1 SUI to USDC"). */
          command: z.string().min(1),
          /** The action category of this command. */
          category: z.enum(["swap", "lend", "stake", "send"]),
          /**
           * "explicit": the user stated the amount directly in this command.
           * "prev-output": this step consumes the prior step's on-chain output.
           * Step 0 must always be "explicit".
           */
          amountFrom: z.enum(["explicit", "prev-output"]),
        }),
      )
      .min(2)
      .max(8),
  }),

  outputSchema: z.object({
    ok: z.boolean(),
    steps: z
      .array(
        z.object({
          index: z.number(),
          category: z.string(),
          clause: z.string(),
          amountFrom: z.string(),
          status: z.string(),
        }),
      )
      .optional(),
    reasons: z.array(z.string()).optional(),
  }),

  // Execute delegates entirely to the pure verifier so the logic is testable without Mastra.
  execute: async (inputData) => {
    const { steps } = inputData as { steps: DecomposeStep[] };
    return verifyDecomposeSteps(steps);
  },
});
