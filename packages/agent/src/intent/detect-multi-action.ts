/**
 * detect-multi-action — deterministic guard for "one action per message",
 * plus the Track-A sequential chain parser for supported swap→lend patterns.
 *
 * Single-action guard: flags a message that requests 2+ DISTINCT value-action
 * categories (send vs swap vs lend vs bridge vs limit-order). The agent route
 * short-circuits on a hit and asks the user to do one action at a time — no
 * value tool runs. Pure + CJS-safe; no React/Walrus deps.
 *
 * Chain parser: carves a hole for the specific swap→lend ordered pair that maps
 * to a supported sequential chain (Track A). Other multi-action combos continue
 * to hit the refusal path. The route checks isChainableSequence() BEFORE the
 * refusal to route chainable intents to the plan-stepper instead.
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

/** Value-action categories → the verb keywords that signal each. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  send: ["send", "transfer", "pay"],
  swap: ["swap", "sell", "dump", "convert"],
  lend: ["lend", "lending", "deposit", "supply", "repay"],
  bridge: ["bridge", "redeem"],
  limit: ["limit"],
};

const WORD_TO_CATEGORY = new Map<string, string>();
for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
  for (const w of words) WORD_TO_CATEGORY.set(w, category);
}

export interface MultiActionResult {
  /** True when 2+ distinct value-action categories appear in the message. */
  multi: boolean;
  /** The ordered distinct categories found (e.g. ["send","swap"]). */
  actions: string[];
}

/**
 * Clause separators — conjunctions / punctuation that join two requests.
 * VN connectors "rồi", "và sau đó", "tiếp theo" are normalised before split.
 */
const CLAUSE_SPLIT_RE = /\b(?:and|then|also|plus)\b|[,;&+]/i;

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
// Track-A chain parser — "swap then lend" is the only supported ordered pair
// ---------------------------------------------------------------------------

/**
 * Supported two-step chain sequences (first → second).
 * Only the exact [swap, lend] pair is supported in Track A; extend here as
 * new chain types are validated and added.
 */
const CHAINABLE_PAIRS: [string, string][] = [["swap", "lend"]];

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
 * Returns true when the ordered action sequence maps to a supported Track-A
 * chain pair. Used by the route to carve a hole before the refusal path.
 */
export function isChainableSequence(actions: string[]): boolean {
  if (actions.length !== 2) return false;
  return CHAINABLE_PAIRS.some(([a, b]) => actions[0] === a && actions[1] === b);
}

/**
 * Parse a compound intent into ordered ChainStep[], or null when:
 *  - The intent is not a supported chainable sequence.
 *  - The intent is a non-compound (single-step) sentence.
 *  - The intent is ambiguous (e.g. send+swap → ask, don't guess).
 *
 * Step-2 clause using "it"/"the output"/"the proceeds" signals that the amount
 * comes from the prior step's on-chain output (amountFrom="prev-output").
 */
export function parseChainSteps(text: string): ChainStep[] | null {
  const normalized = normalizeVnConnectors(text);
  const result = detectMultiAction(normalized);

  if (!result.multi) return null; // single-step — not a chain
  if (!isChainableSequence(result.actions)) return null; // unsupported combo → ask

  // Split into clauses on the same separators; filter empties.
  const rawClauses = normalized.split(CLAUSE_SPLIT_RE).map((c) => c.trim()).filter(Boolean);
  if (rawClauses.length < 2) return null;

  // Map each raw clause to its first-found category (same logic as detectMultiAction).
  const clauseWithCat: { clause: string; category: string }[] = [];
  for (const clause of rawClauses) {
    for (const w of clause.toLowerCase().split(/[^a-z0-9]+/)) {
      const category = WORD_TO_CATEGORY.get(w);
      if (category) {
        clauseWithCat.push({ clause, category });
        break;
      }
    }
  }

  if (clauseWithCat.length < 2) return null;

  // Only take the first two (Track A = exactly 2 steps).
  const [first, second] = clauseWithCat;

  // Step-2 refers to the prior step's output when the clause contains a pronoun or
  // forward-ref ("it", "them", "the output", "the proceeds") — the signal that the
  // amount is derived from on-chain post-confirm state, not user-stated.
  const PREV_OUTPUT_MARKERS = /\b(it|them|the\s+output|the\s+proceeds|the\s+usdc|the\s+sui|the\s+token)\b/i;
  const step2AmountFrom: ChainStep["amountFrom"] =
    PREV_OUTPUT_MARKERS.test(second.clause) ? "prev-output" : "prev-output"; // always prev-output for lend step

  return [
    { category: first.category, clause: first.clause, amountFrom: "explicit" },
    { category: second.category, clause: second.clause, amountFrom: step2AmountFrom },
  ];
}
