/**
 * detect-multi-action — deterministic guard for "one action per message".
 *
 * Flags a message that requests 2+ DISTINCT value-action categories (send vs swap vs
 * lend vs bridge vs limit-order). The agent route short-circuits on a hit and asks the
 * user to do one action at a time — no value tool runs. Pure + CJS-safe (mirrors
 * parse-intent.ts); no React/Walrus deps.
 *
 * Read-only intents (portfolio/stats/protocols/receive) are NOT value actions and never
 * count, so "swap 5 SUI to USDC and show my portfolio" is one value action (not flagged).
 * Prepositions ("to"/"for"/"into") are not verbs, so "swap A to B" is one action.
 *
 * The message is split into clauses on conjunctions, and only the FIRST value-verb of each
 * clause counts — so a recipient NAME that happens to be a verb keyword ("send 5 SUI to Lend")
 * is never miscounted as a second action (it is not command-leading in its clause).
 *
 * Known v1 limitation: same-category multi-target ("send 1 SUI to A and 1 SUI to B") is one
 * category → not flagged here; the persona backstop covers it.
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

/** Clause separators — conjunctions / punctuation that join two requests. */
const CLAUSE_SPLIT_RE = /\b(?:and|then|also|plus)\b|[,;&+]/i;

/** Detect whether a single message bundles 2+ distinct value actions. */
export function detectMultiAction(text: string): MultiActionResult {
  const found: string[] = [];
  for (const clause of text.toLowerCase().split(CLAUSE_SPLIT_RE)) {
    if (!clause) continue;
    // Only the FIRST value-verb of a clause is that clause's action — a later verb keyword
    // (e.g. a recipient name like "Lend") is not command-leading and must not count.
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
