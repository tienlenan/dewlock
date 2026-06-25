/**
 * chain-step-command-composer — pure function: ChainStep + resolved amount → complete command string.
 *
 * WHY pure / separate file: unit-testable without any React or Sui SDK deps.
 * The chain sign loop calls this to compose the re-submission text for each step,
 * mirroring the picker-card pattern (lend-options-card, swap-options-card) where
 * a complete NL command is re-submitted via sendMessage → normal intent pipeline.
 *
 * Command composition rules:
 *  - swap step (category "swap"): preserve the original clause (it already has
 *    "swap N COIN to OUT") — we don't need to rewrite it.
 *  - lend step (category "lend", amountFrom "prev-output"): compose a fresh
 *    "deposit <amount> <symbol> to <protocol>" command from the resolved delta.
 *    The resolved amount is a human-readable decimal string (e.g. "18.5").
 *    The protocol is extracted from the original clause if present, else omitted
 *    (the LLM or getLendOptions picker completes it).
 *  - other categories: re-emit the original clause as-is (safe passthrough).
 *
 * The symbol is extracted from the clause heuristically; callers may override
 * by passing an explicit `symbolOverride` in options.
 */

export interface ChainStepDef {
  category: string;
  clause: string;
  amountFrom: "explicit" | "prev-output";
}

export interface ComposeOptions {
  /**
   * Resolved human-readable amount (e.g. "18.5") for a prev-output step.
   * Required when step.amountFrom === "prev-output".
   */
  resolvedAmountHuman?: string;
  /**
   * Override the coin symbol extracted from the clause (e.g. "USDC").
   * Useful when the caller knows the exact output coin from the prior step.
   */
  symbolOverride?: string;
}

/**
 * Extract the protocol from a lend clause (e.g. "lend it on NAVI" → "navi").
 * Returns null when no protocol keyword is found.
 */
function extractProtocolFromClause(clause: string): string | null {
  // Match "on <protocol>" or "to <protocol>" at the end of the clause.
  const m = clause.match(/\b(?:on|to)\s+(\w+)\s*$/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Extract a coin symbol from a clause (e.g. "lend USDC on NAVI" → "USDC").
 * Looks for an all-caps word that is not a known stop-word.
 * Returns null when no symbol is found (caller can omit or substitute).
 */
const SYMBOL_STOP_WORDS = new Set(["SUI", "USDC", "USDT", "DEEP", "CETUS", "HASUI"]);

function extractSymbolFromClause(clause: string): string | null {
  // Only match against known coin symbols — never arbitrary all-caps tokens like "NAVI"
  // (a protocol name) or "SUI" ambiguously in a lend context.  If no known symbol is found,
  // return null so the caller defaults to "USDC" (the most common prev-output coin for
  // the supported swap→lend chain pair).
  for (const sym of SYMBOL_STOP_WORDS) {
    if (new RegExp(`\\b${sym}\\b`, "i").test(clause)) return sym;
  }
  return null;
}

/**
 * Extract the DESTINATION coin symbol from a swap clause's "to/into/for <SYMBOL>"
 * segment — e.g. "swap 5 SUI to USDC" → "USDC". Returns the uppercased symbol, or
 * null when no destination is present. Pure + testable; the caller resolves the
 * symbol → canonical coin type (via POPULAR_TOKENS) and snapshots that coin's balance
 * BEFORE the swap executes so the chain's prev-output delta isolates the swap output
 * from pre-existing holdings (the delta-safety invariant).
 */
export function extractDestinationSymbol(clause: string): string | null {
  const m = clause.match(/\b(?:to|into|for)\s+([A-Za-z][A-Za-z0-9]{1,9})\b/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Compose a complete command string for a chain step.
 *
 * For a "prev-output" lend step, the resolvedAmountHuman MUST be provided —
 * the caller snapshots it from the on-chain balance delta after step k confirms.
 *
 * For the swap step (explicit amount), the original clause is re-submitted verbatim.
 */
export function composeChainStepCommand(
  step: ChainStepDef,
  opts: ComposeOptions = {},
): string {
  const { resolvedAmountHuman, symbolOverride } = opts;

  // Swap step: re-submit the original clause (amount is explicit in the text).
  if (step.category === "swap") {
    return step.clause.trim();
  }

  // Lend step: compose a deterministic command from the resolved amount.
  if (step.category === "lend" && step.amountFrom === "prev-output") {
    const symbol = symbolOverride ?? extractSymbolFromClause(step.clause) ?? "USDC";
    const protocol = extractProtocolFromClause(step.clause);
    const amount = resolvedAmountHuman ?? "all";

    // Full command: "deposit <amount> <symbol> to <protocol>" or just "deposit <amount> <symbol>".
    // The Guardian and agent pipeline can resolve the protocol via getLendOptions if omitted.
    const base = `deposit ${amount} ${symbol}`;
    return protocol ? `${base} to ${protocol}` : base;
  }

  // All other categories: passthrough (safe default, future categories auto-supported).
  return step.clause.trim();
}

/**
 * Format a raw bigint native balance as a human-readable decimal string.
 * Uses the standard decimal places for known coin types.
 * Falls back to 9 decimals (SUI native unit).
 */
export function nativeToHuman(
  nativeAmount: bigint,
  coinTypeOrDecimals: string | number,
): string {
  const decimals =
    typeof coinTypeOrDecimals === "number"
      ? coinTypeOrDecimals
      : COIN_DECIMALS[coinTypeOrDecimals] ?? 9;

  const divisor = 10 ** decimals;
  // Round to at most 6 significant decimal places to avoid scientific notation.
  const human = Number(nativeAmount) / divisor;
  return human.toLocaleString("en-US", { maximumFractionDigits: 6, useGrouping: false });
}

const COIN_DECIMALS: Record<string, number> = {
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI": 9,
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": 6,
  "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT": 6,
  "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP": 6,
  // haSUI: 9 decimals (same as SUI)
  "0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d::hasui::HASUI": 9,
};
