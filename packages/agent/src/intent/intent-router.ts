/**
 * intent-router — deterministic action-category classification of literal user text.
 *
 * WHY this exists (the moat): The LLM proposes a prepareTrade actionType; this module
 * independently classifies the user's literal command. If the two disagree, the
 * server blocks the transaction BEFORE any PTB reaches the user's wallet. This
 * catches LLM action-misdetection (e.g. LLM hears "lend 5 USDC" but emits
 * actionType="swap") without touching the build path.
 *
 * Design:
 *  - Pure + CJS-safe: no React, no Sui SDK, no async. Works in Node + Edge.
 *  - Uses the SAME keyword maps and SAME first-verb-per-clause logic as
 *    detect-multi-action, so the two are never out of sync.
 *  - Fail-open: if the router cannot classify (null on either side), it passes.
 *    Only a positive category mismatch is a hard block.
 */

import { CHAIN_CATEGORY_KEYWORDS } from "../chaining/chain-adapters";

// ---------------------------------------------------------------------------
// Keyword map
// ---------------------------------------------------------------------------

/**
 * Full category→keywords map for the cross-check router.
 * Chainable categories (swap/lend/stake/send) come from CHAIN_CATEGORY_KEYWORDS.
 * Guard-only categories (bridge/limit) are added here so the router can classify
 * "bridge USDC" or "set a limit order" and block a mismatched actionType.
 */
const ROUTER_CATEGORY_KEYWORDS: Record<string, string[]> = {
  ...CHAIN_CATEGORY_KEYWORDS,
  bridge: ["bridge", "redeem"],
  limit: ["limit"],
};

/** Word → category lookup — mirrors WORD_TO_CATEGORY in detect-multi-action. */
const WORD_TO_CATEGORY = new Map<string, string>();
for (const [category, words] of Object.entries(ROUTER_CATEGORY_KEYWORDS)) {
  for (const w of words) WORD_TO_CATEGORY.set(w, category);
}

/**
 * Read-only verbs that must NEVER classify as a value action. These words
 * appear in a command position but request information only — no funds move.
 * If the entire first clause is dominated by a read-only verb, routeAction
 * returns null (treating the text as conversational/ambiguous).
 *
 * "show", "portfolio", "history", "balance", "what", "where", "check",
 * "view", "display", "list", "find" — extend as needed.
 */
const READ_ONLY_FIRST_VERBS = new Set([
  "show", "portfolio", "history", "balance", "what", "where",
  "check", "view", "display", "list", "find", "get", "tell",
  "how", "why", "explain", "describe",
]);

// Clause separators — same as detect-multi-action.
const CLAUSE_SPLIT_RE = /\b(?:and|then|also|plus)\b|[,;&+]/i;

// ---------------------------------------------------------------------------
// routeAction
// ---------------------------------------------------------------------------

/**
 * Classify the literal user text into an action category.
 *
 * Algorithm (mirrors detect-multi-action first-verb logic):
 *  1. Split into clauses on conjunctions.
 *  2. For the FIRST clause, scan tokens from left to right.
 *  3. If the first non-stop token is a read-only verb → return null.
 *  4. Return the first value-verb category found.
 *  5. If no value-verb found → return null (ambiguous or conversational).
 *
 * Returns null (not a classification error) for:
 *  - Read-only / conversational text ("show my portfolio", "what's the yield")
 *  - Pure ambiguous text ("5 SUI USDC" — no verb)
 *  - Empty string
 */
export function routeAction(text: string): string | null {
  if (!text || !text.trim()) return null;

  // Only look at the FIRST clause — this is a single-intent cross-check.
  // A multi-action message is already handled upstream by detectMultiAction;
  // we only need to classify what the user primarily asked for.
  const firstClause = text.toLowerCase().split(CLAUSE_SPLIT_RE)[0] ?? "";
  const tokens = firstClause.split(/[^a-z0-9]+/).filter(Boolean);

  for (const token of tokens) {
    // If the first recognisable command verb is read-only, classify as null.
    if (READ_ONLY_FIRST_VERBS.has(token)) return null;

    const category = WORD_TO_CATEGORY.get(token);
    if (category) return category;
  }

  return null;
}

// ---------------------------------------------------------------------------
// categoryForActionType
// ---------------------------------------------------------------------------

/**
 * Map a prepareTrade actionType to its router category.
 *
 * Returns null for actionTypes we deliberately skip cross-checking:
 *  - "composite" — a multi-leg chain; no single user-verb maps cleanly to it.
 *    The composite actionType is only produced when the LLM follows an explicit
 *    composite-recipe directive from the intent pipeline; misdetection risk is low
 *    and the composite Guardian gate already validates the recipe.
 *  - DeepBook lifecycle ops (bm_create/bm_deposit/cancel_order/withdraw_settled/
 *    claim_settled) — these are triggered by structured UI flows (onboarding wizard,
 *    order management cards), not raw user NL commands, so NL cross-check is
 *    inapplicable.
 *
 * All other actionTypes map 1-to-1 to a router category.
 */
export function categoryForActionType(actionType: string): string | null {
  switch (actionType) {
    case "swap":
      return "swap";
    case "lend_deposit":
    case "lend_repay":
    case "lend_borrow":
    case "lend_withdraw":
      return "lend";
    case "stake":
    case "unstake":
      return "stake";
    case "transfer":
      return "send";
    case "limit_order":
      return "limit";
    case "bridge_redeem":
      return "bridge";

    // Deliberately unchecked — no single user NL verb maps to these.
    case "composite":
    case "bm_create":
    case "bm_deposit":
    case "cancel_order":
    case "withdraw_settled":
    case "claim_settled":
      return null;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// assertActionMatchesText
// ---------------------------------------------------------------------------

/**
 * Cross-check a prepareTrade actionType against the user's literal command.
 *
 * Returns { ok: false, reason } only when BOTH sides resolve to a non-null
 * category AND those categories differ — a hard mismatch.
 *
 * Returns { ok: true } (pass) when:
 *  - routeAction returns null (ambiguous/read-only/no-verb text) — we cannot
 *    classify the user's intent, so we give the benefit of the doubt.
 *  - categoryForActionType returns null (composite or DeepBook lifecycle) —
 *    the actionType has no NL-verb equivalent, so the check is skipped.
 *  - Both categories match — correct routing.
 *
 * This design produces NO false positives on ambiguous text or deliberate
 * unchecked actionTypes. Only a clear LLM routing error is blocked.
 */
export function assertActionMatchesText(
  text: string,
  actionType: string,
): { ok: boolean; reason?: string } {
  const routedCategory = routeAction(text);
  const actionCategory = categoryForActionType(actionType);

  // Either side null → pass (cannot make a positive determination).
  if (routedCategory === null || actionCategory === null) {
    return { ok: true };
  }

  if (routedCategory !== actionCategory) {
    return {
      ok: false,
      reason:
        `Refusing for safety: the prepared action ("${actionType}") doesn't match what you asked ("${routedCategory}"). ` +
        `Please rephrase the request.`,
    };
  }

  return { ok: true };
}
