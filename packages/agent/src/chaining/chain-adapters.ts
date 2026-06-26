/**
 * chain-adapters — extensible adapter registry for sequential chain actions.
 *
 * Each adapter owns one "chainable" action category. Adding a new protocol/action
 * means registering one adapter here — nothing else changes in the chaining machinery.
 *
 * Design constraints:
 *  - Pure + CJS-safe: no React, no Sui SDK imports. All helpers are plain functions.
 *  - `producesOutput` marks adapters whose on-chain result is a coin a later step
 *    can consume via the delta-safety invariant (swap/stake → yes; lend/send → no).
 *  - `composeCommand` converts a step's parsed clause + resolved runtime amount into
 *    the exact NL command re-submitted to the normal intent pipeline.
 */

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface ChainActionAdapter {
  /** Canonical category name (matches CATEGORY_KEYWORDS keys in detect-multi-action). */
  category: string;
  /**
   * Verb keywords that identify this action in a clause. Drives the single-action
   * guard AND the chain parser — both consume the same source.
   */
  keywords: string[];
  /**
   * True when this action produces an on-chain coin output that a subsequent
   * prev-output step can consume (e.g. swap produces USDC, stake produces haSUI).
   * False for terminal sinks: lend deposits into protocol, send transfers out.
   */
  producesOutput: boolean;
  /**
   * Compose the re-submission command for this step.
   * @param input.clause             The raw parsed clause from user text.
   * @param input.resolvedAmountHuman Human-readable decimal (e.g. "18.5") resolved from
   *                                 the prior step's on-chain delta. Present only for
   *                                 prev-output steps after the prior step confirms.
   * @param input.symbol             Coin symbol hint (e.g. "USDC") extracted by the caller
   *                                 from the prior step's output or the resolved amount label.
   */
  composeCommand(input: {
    clause: string;
    resolvedAmountHuman?: string;
    symbol?: string;
  }): string;
}

// ---------------------------------------------------------------------------
// Pure helpers used by adapters
// ---------------------------------------------------------------------------

/**
 * Extract the protocol name from a lend/stake clause's "on/to <protocol>" tail.
 * Returns null when no match is found.
 * Examples: "lend it on NAVI" → "navi"; "stake 5 SUI to afSUI" → "afsui".
 */
export function extractProtocolFromClause(clause: string): string | null {
  const m = clause.match(/\b(?:on|to)\s+(\w+)\s*$/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Extract a known coin symbol from a clause.
 * Matches against a fixed set of canonical symbols; ignores protocol names
 * and other all-caps words (avoids "NAVI" matching as a symbol).
 */
const KNOWN_SYMBOLS = new Set([
  "SUI", "USDC", "USDT", "DEEP", "CETUS", "HASUI", "AFSUI",
]);

export function extractSymbolFromClause(clause: string): string | null {
  for (const sym of KNOWN_SYMBOLS) {
    if (new RegExp(`\\b${sym}\\b`, "i").test(clause)) return sym;
  }
  return null;
}

/**
 * Extract the DESTINATION coin symbol from a swap clause's "to/into/for <SYMBOL>"
 * segment — e.g. "swap 5 SUI to USDC" → "USDC". Returns the uppercased symbol or null.
 * Pure + testable; the caller maps the symbol → canonical coin type via POPULAR_TOKENS.
 */
export function extractDestinationSymbol(clause: string): string | null {
  const m = clause.match(/\b(?:to|into|for)\s+([A-Za-z][A-Za-z0-9]{1,9})\b/i);
  return m ? m[1].toUpperCase() : null;
}

// ---------------------------------------------------------------------------
// Adapter registry — FOUR built-in adapters
// ---------------------------------------------------------------------------

export const CHAIN_ADAPTERS: ChainActionAdapter[] = [
  // ---- swap ----------------------------------------------------------------
  // Passthrough: the original clause already contains "swap N SUI to USDC";
  // re-emit verbatim. The swap step always has amountFrom="explicit" so the
  // resolved amount is unused here.
  {
    category: "swap",
    keywords: ["swap", "sell", "dump", "convert", "exchange"],
    producesOutput: true,
    composeCommand({ clause }) {
      return clause.trim();
    },
  },

  // ---- lend ----------------------------------------------------------------
  // Terminal sink: deposits into a lending protocol.
  // Composition rules (in priority order):
  //   1. resolvedAmountHuman present → compose "deposit <amount> <sym> to <protocol>".
  //      sym = explicit `symbol` param > extracted from clause > "USDC" default.
  //   2. No resolvedAmountHuman but explicit `symbol` param present → compose with
  //      amount="all". This covers the case where the output coin is known from the
  //      swap clause (symbolOverride set) but the on-chain delta read hasn't happened yet.
  //   3. Neither → passthrough the clause verbatim (fully explicit-amount lend step
  //      where the user stated the amount and coin directly, e.g. "lend 5 USDC on NAVI").
  {
    category: "lend",
    keywords: ["lend", "lending", "deposit", "supply", "repay"],
    producesOutput: false,
    composeCommand({ clause, resolvedAmountHuman, symbol }) {
      if (resolvedAmountHuman !== undefined) {
        // Amount resolved from on-chain delta: compose deterministic command.
        const sym = symbol ?? extractSymbolFromClause(clause) ?? "USDC";
        const protocol = extractProtocolFromClause(clause);
        const base = `deposit ${resolvedAmountHuman} ${sym}`;
        return protocol ? `${base} to ${protocol}` : base;
      }
      if (symbol !== undefined) {
        // Symbol known (e.g. from swap output) but delta not yet resolved: use "all".
        const protocol = extractProtocolFromClause(clause);
        const base = `deposit all ${symbol}`;
        return protocol ? `${base} to ${protocol}` : base;
      }
      // Fully explicit step: user stated amount + coin in the clause, passthrough.
      return clause.trim();
    },
  },

  // ---- stake ---------------------------------------------------------------
  // producesOutput=true: staking SUI produces a liquid-staking token (haSUI/afSUI)
  // that a subsequent step could consume (e.g. stake → lend the haSUI).
  // When resolvedAmountHuman is present, compose "stake <amount> SUI to <provider>".
  {
    category: "stake",
    keywords: ["stake", "staking"],
    producesOutput: true,
    composeCommand({ clause, resolvedAmountHuman }) {
      if (!resolvedAmountHuman) {
        return clause.trim();
      }
      // Extract the staking provider from the clause ("afSUI" / "haSUI" / "to afsui").
      const providerMatch = clause.match(/\b(afsui|hasui)\b/i);
      const protocol = providerMatch
        ? providerMatch[1].toLowerCase()
        : extractProtocolFromClause(clause) ?? "afsui";
      return `stake ${resolvedAmountHuman} SUI to ${protocol}`;
    },
  },

  // ---- send ----------------------------------------------------------------
  // Terminal sink: transfers the resolved amount to a recipient. When
  // resolvedAmountHuman is present, rewrite the numeric amount in the clause
  // so the recipient + destination symbol are preserved.
  {
    category: "send",
    keywords: ["send", "transfer", "pay"],
    producesOutput: false,
    composeCommand({ clause, resolvedAmountHuman }) {
      if (!resolvedAmountHuman) {
        return clause.trim();
      }
      // Replace the numeric amount in the clause with the resolved amount.
      // Pattern: "send <N> <COIN> to <recipient>" → "send <resolved> <COIN> to <recipient>".
      const rewritten = clause.replace(
        /^(\s*(?:send|transfer|pay)\s+)([\d.,]+)/i,
        `$1${resolvedAmountHuman}`,
      );
      // If the replace found nothing (no numeric in the clause), use the resolved amount.
      return rewritten !== clause ? rewritten.trim() : `send ${resolvedAmountHuman} ${extractSymbolFromClause(clause) ?? "SUI"} ${clause.replace(/^\s*\w+\s+[\d.,]*\s*/i, "")}`.trim();
    },
  },
];

// ---------------------------------------------------------------------------
// Derived lookup structures
// ---------------------------------------------------------------------------

/**
 * Record<category, keywords[]> — mirrors the old CATEGORY_KEYWORDS in detect-multi-action.
 * Derived from CHAIN_ADAPTERS so adapters remain the single source of truth.
 * Guard-only categories (bridge, limit) are NOT in this map; they are added separately
 * in detect-multi-action to keep the single-action guard working for non-chainable combos.
 */
export const CHAIN_CATEGORY_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  CHAIN_ADAPTERS.map((a) => [a.category, a.keywords]),
);

/**
 * Set of categories that are valid participants in a sequential chain.
 * A category in this set can appear in ANY position of an ordered chain.
 * Bridge and limit-order are intentionally excluded: they have no supported
 * chain pair and must still hit the refusal path when combined.
 */
export const CHAINABLE_CATEGORIES: Set<string> = new Set(
  CHAIN_ADAPTERS.map((a) => a.category),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Look up an adapter by category. Returns undefined for unknown categories. */
export function getChainAdapter(category: string): ChainActionAdapter | undefined {
  return CHAIN_ADAPTERS.find((a) => a.category === category);
}

/**
 * Compose the re-submission command for a chain step.
 * Delegates to the adapter's composeCommand; falls back to passthrough when
 * the category is unknown (safe default — forwards the original clause).
 */
export function composeChainCommand(
  category: string,
  input: { clause: string; resolvedAmountHuman?: string; symbol?: string },
): string {
  const adapter = getChainAdapter(category);
  if (!adapter) {
    // Unknown category: passthrough. Future adapters registered here automatically
    // replace this path; no other code changes needed.
    return input.clause.trim();
  }
  return adapter.composeCommand(input);
}
