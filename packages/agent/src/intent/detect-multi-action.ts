/**
 * detect-multi-action — deterministic guard for "one action per message",
 * plus the sequential chain parser for ANY ordered combination of supported
 * chainable actions (swap, lend, stake, send).
 *
 * Single-action guard: flags a message that requests 2+ DISTINCT value-action
 * categories (send vs swap vs lend vs bridge vs limit-order). The agent route
 * short-circuits on a hit and asks the user to do one action at a time — no
 * value tool runs. Pure + CJS-safe; no React/Walrus deps.
 *
 * Chain parser: carves a hole for ANY ordered sequence of chainable categories
 * (swap/lend/stake/send) that maps to a supported Track-A chain. Other multi-
 * action combos (bridge+X, limit+X) continue to hit the refusal path. The route
 * checks isChainableSequence() BEFORE the refusal to route chainable intents to
 * the plan-stepper instead.
 *
 * Adapters are the single source of truth: the CHAIN_ADAPTERS registry in
 * chain-adapters.ts drives BOTH the keyword map and the chainable-category set.
 * Adding a new chainable action = one adapter registration; nothing here changes.
 *
 * Read-only intents (portfolio/stats/protocols/receive) are NOT value actions and
 * never count, so "swap 5 SUI to USDC and show my portfolio" is one value action.
 * Prepositions ("to"/"for"/"into") are not verbs, so "swap A to B" is one action.
 *
 * The message is split into clauses on conjunctions, and only the FIRST value-verb
 * of each clause counts — so a recipient NAME that happens to be a verb keyword
 * ("send 5 SUI to Lend") is never miscounted as a second action.
 *
 * Known v1 limitation: same-category multi-target ("send 1 SUI to A and 1 SUI to B")
 * is one category → not flagged here; the persona backstop covers it.
 */

import {
  CHAIN_CATEGORY_KEYWORDS,
  CHAINABLE_CATEGORIES,
} from "../chaining/chain-adapters";

// ---------------------------------------------------------------------------
// Single-action guard keyword map
//
// Merge adapter keywords (swap/lend/stake/send) with guard-only categories
// (bridge/limit) that are NOT chainable but must still trigger the refusal.
// ---------------------------------------------------------------------------

/** Guard-only categories that refuse but never chain. */
const GUARD_ONLY_KEYWORDS: Record<string, string[]> = {
  bridge: ["bridge", "redeem"],
  limit: ["limit"],
};

/** Full category→keywords map for the single-action guard. */
const GUARD_CATEGORY_KEYWORDS: Record<string, string[]> = {
  ...CHAIN_CATEGORY_KEYWORDS,
  ...GUARD_ONLY_KEYWORDS,
};

const WORD_TO_CATEGORY = new Map<string, string>();
for (const [category, words] of Object.entries(GUARD_CATEGORY_KEYWORDS)) {
  for (const w of words) WORD_TO_CATEGORY.set(w, category);
}

export interface MultiActionResult {
  /** True when 2+ distinct value-action categories appear in the message. */
  multi: boolean;
  /** The ordered distinct categories found (e.g. ["swap","lend"]). */
  actions: string[];
}

/**
 * Clause separators — conjunctions / punctuation that join two requests.
 * VN connectors "rồi", "và sau đó", "tiếp theo" are normalised before split.
 *
 * `\.\s+` splits on a SENTENCE period (period + whitespace) so "swap 1 SUI. send 2 SUI"
 * is two clauses — WITHOUT splitting decimals ("0.2") or SuiNS names ("abc.sui"), which
 * have no whitespace after the dot. "finally"/"lastly" are terminal connectors. This also
 * closes a smuggle vector: a single command must never hide a second action behind "." or
 * "finally" — verifyDecomposeSteps relies on this split to assert one action per step.
 */
const CLAUSE_SPLIT_RE = /\b(?:and|then|also|plus|finally|lastly)\b|\.\s+|[,;&+]/i;

/**
 * Normalise Vietnamese sequential connectors to "then" so the clause splitter
 * picks them up without a separate regex branch.
 * "rồi" = "then/next"; "và sau đó" = "and then"; "tiếp theo" = "next/following".
 *
 * \b word-boundaries do NOT work with Unicode characters in JS regex, so we
 * use a looser whitespace-boundary match (space-or-start / space-or-end).
 * This is safe because none of these phrases appear as substrings of English words.
 */
function normalizeVnConnectors(text: string): string {
  return text
    .replace(/(^|\s)tiếp theo(\s|$)/gi, " then ")
    .replace(/(^|\s)và sau đó(\s|$)/gi, " then ")
    .replace(/(^|\s)rồi(\s|$)/gi, " then ");
}

/** Detect whether a single message bundles 2+ distinct value actions. */
export function detectMultiAction(text: string): MultiActionResult {
  const normalized = normalizeVnConnectors(text);
  const found: string[] = [];
  for (const clause of normalized.toLowerCase().split(CLAUSE_SPLIT_RE)) {
    if (!clause) continue;
    // Only the FIRST value-verb of a clause is that clause's action — a later
    // verb keyword (e.g. a recipient name like "Lend") is not command-leading.
    for (const w of clause.split(/[^a-z0-9]+/)) {
      const category = WORD_TO_CATEGORY.get(w);
      if (category) {
        if (!found.includes(category)) found.push(category);
        break;
      }
    }
  }
  return { multi: found.length >= 2, actions: found };
}

// ---------------------------------------------------------------------------
// Track-A chain parser — any ordered N-step combination of chainable categories
// ---------------------------------------------------------------------------

/**
 * Represents a parsed step in a sequential chain plan.
 * amountFrom="explicit" means the user stated the amount in this clause;
 * amountFrom="prev-output" means this step consumes the output of the prior step.
 */
export interface ChainStep {
  category: string;
  clause: string;
  amountFrom: "explicit" | "prev-output";
}

/**
 * Prev-output markers: pronouns and forward-references that signal a step
 * should consume the prior step's on-chain output rather than a user-stated amount.
 * Examples: "lend it", "stake them", "deposit the output", "send the proceeds".
 */
const PREV_OUTPUT_MARKERS =
  /\b(it|them|the\s+output|the\s+proceeds|the\s+usdc|the\s+sui|the\s+token)\b/i;

/**
 * Returns true when the ordered action sequence is a valid chainable plan:
 *  - Length >= 2 (single-step is not a chain).
 *  - Every action belongs to CHAINABLE_CATEGORIES (swap/lend/stake/send).
 *    bridge and limit-order are NOT chainable — they fall through to the refusal.
 *
 * Any ordered N-step combination of registered chainable actions is accepted.
 * Adding a new adapter automatically expands what sequences are chainable here.
 */
export function isChainableSequence(actions: string[]): boolean {
  if (actions.length < 2) return false;
  return actions.every((a) => CHAINABLE_CATEGORIES.has(a));
}

/**
 * Parse a compound intent into ordered ChainStep[], or null when:
 *  - The intent is a non-compound (single-clause) sentence.
 *  - Any clause maps to a non-chainable category (bridge/limit) → null, refuse.
 *  - Fewer than 2 clauses carry a recognisable verb.
 *
 * Step amountFrom logic:
 *  - Step 0 is always "explicit" (the user stated the amount in the first clause).
 *  - Step k > 0 is "prev-output" when its clause contains a prev-output marker
 *    (it/them/the output/the proceeds/…), signalling the amount comes from the
 *    prior step's on-chain confirm. Otherwise it is "explicit" — the user stated
 *    an amount directly in that clause ("send 1 SUI to A then send 2 SUI to B"
 *    is two explicit steps, not a prev-output chain).
 *
 * Same-category chains (e.g. "send X to A then send Y to B") are valid: the
 * detectMultiAction guard only fires on DISTINCT categories, so same-category
 * repetition bypasses it. This function handles that directly via clause parsing.
 *
 * This fixes the original bug where step-2 was hardcoded to "prev-output" for all
 * swap→lend pairs regardless of whether "it" appeared in the lend clause.
 */
export function parseChainSteps(text: string): ChainStep[] | null {
  const normalized = normalizeVnConnectors(text);

  // Split into clauses on the same separators; filter empties.
  const rawClauses = normalized
    .split(CLAUSE_SPLIT_RE)
    .map((c) => c.trim())
    .filter(Boolean);
  if (rawClauses.length < 2) return null;

  // Map each raw clause to its first-found verb category (same first-verb
  // logic as detectMultiAction). A non-chainable verb (bridge/limit) in any
  // clause voids the whole sequence → null (falls through to refusal path).
  const clauseWithCat: { clause: string; category: string }[] = [];
  for (const clause of rawClauses) {
    for (const w of clause.toLowerCase().split(/[^a-z0-9]+/)) {
      const category = WORD_TO_CATEGORY.get(w);
      if (category) {
        if (!CHAINABLE_CATEGORIES.has(category)) return null;
        clauseWithCat.push({ clause, category });
        break;
      }
    }
  }

  if (clauseWithCat.length < 2) return null;

  // Validate via isChainableSequence using the DISTINCT action set.
  // This rejects non-chainable combos but allows same-category repetition
  // (send+send has only one distinct category → isChainableSequence passes
  // because every category in the distinct set is chainable).
  const distinctActions = [...new Set(clauseWithCat.map((c) => c.category))];
  if (!isChainableSequence(distinctActions.length >= 2 ? distinctActions : [distinctActions[0], distinctActions[0]])) {
    return null;
  }

  // Build ordered ChainStep[]: step 0 is always explicit; later steps check
  // for a prev-output marker in their clause to determine amountFrom.
  return clauseWithCat.map(({ clause, category }, i) => {
    const amountFrom: ChainStep["amountFrom"] =
      i === 0
        ? "explicit"
        : PREV_OUTPUT_MARKERS.test(clause)
          ? "prev-output"
          : "explicit";
    return { category, clause, amountFrom };
  });
}
