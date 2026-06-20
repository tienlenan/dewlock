/**
 * Deterministic intent parser — the fast, reliable path in front of the LLM.
 *
 * Recognizes SELF-CONTAINED commands in a single message and returns a normalized
 * Intent; anything ambiguous (contextual replies like "yes", "the second one",
 * pronouns, or shapes it doesn't fit exactly) returns `null` → the caller falls
 * back to the LLM persona (which has conversation history).
 *
 * Grammar (matched exactly, else null):
 *   <verb>[ all|max|<amount>] <tokenA>[ (to|for|into) <tokenB>]
 *   verbs: swap | sell | send/transfer | lend/deposit | repay | bridge | portfolio | protocols | stats | receive
 *
 * Defaults (user-confirmed): selling USDC → SUI; selling any other token → USDC.
 *
 * SECURITY: symbols resolve to coin types ONLY via the verified whitelist
 * (POPULAR_TOKENS) — never a guessed/raw address. Unknown symbol → null (clarify).
 * The parser shapes args only; the Guardian still gates every value move.
 */

import { POPULAR_TOKENS } from "@dewlock/sui/popular-tokens";
import { COIN_TYPES } from "../allowlist";

export type IntentAmount =
  | { kind: "all" }
  | { kind: "exact"; human: string }
  | { kind: "none" };

export type LendProtocol = "navi" | "suilend";

/** Swap execution venue chosen in the form (mirrors guardian SWAP_SOURCES). */
export type SwapSourceId = "cetus" | "aggregator" | "aftermath";
const SWAP_SOURCE_IDS = new Set<string>(["cetus", "aggregator", "aftermath"]);

export type Intent =
  | { action: "swap"; coinInType: string; coinOutType: string; amount: IntentAmount; swappable: boolean; swapSource?: SwapSourceId }
  | { action: "swap_form" } // bare "swap" — missing args, render the form
  | { action: "send"; coinType: string; amount: IntentAmount }
  // Lend fully parses amount/coin/protocol so a complete command builds directly
  // and the UI only ever asks for what is genuinely missing (no re-ask loop).
  | { action: "lend"; verb: "deposit" | "repay"; amount: IntentAmount; coinType?: string; protocol?: LendProtocol }
  | { action: "portfolio" }
  | { action: "protocols" }
  | { action: "stats" }
  | { action: "receive" }
  // Read-only Sui-ecosystem discovery — each renders a card that self-fetches
  // its /api/ecosystem/* route. No value move, no args.
  | { action: "ecosystemYields" }
  | { action: "ecosystemTvl" }
  | { action: "ecosystemTokens" };

// Swap-picker binding: the swap form emits the EXACT allowlisted coin types (+ chosen source)
// as a machine marker so token mapping never depends on symbol re-parsing — the LLM can't
// mis-map a ticker. Stripped from the displayed bubble client-side. Format:
//   [[swap:in=<coinType>|out=<coinType>|src=<source>]]
const SWAP_BIND_RE = /\[\[swap:in=([^|\]]+)\|out=([^|\]]+)(?:\|src=([^\]]+))?\]\]/i;

// Symbol → verified coin type (whitelist only).
const SYMBOL_TO_TYPE = new Map<string, { coinType: string; swappable: boolean }>(
  POPULAR_TOKENS.map((t) => [t.symbol.toUpperCase(), { coinType: t.coinType, swappable: t.swappable }]),
);

/** Counter-asset default: selling USDC → SUI; selling anything else → USDC. */
function defaultDestination(coinInType: string): string {
  return coinInType === COIN_TYPES.USDC ? COIN_TYPES.SUI : COIN_TYPES.USDC;
}

// Contextual replies the parser must NOT act on (defer to the LLM with history).
const CONTEXTUAL = /\b(yes|yep|ok|okay|sure|do it|confirm|that one|the (first|second|third|last)|it|this|that|again)\b/i;

function resolveSymbol(sym: string): { coinType: string; swappable: boolean } | null {
  return SYMBOL_TO_TYPE.get(sym.toUpperCase()) ?? null;
}

/** Parse an amount token: "all"/"max" → all; a number → exact; else none. */
function parseAmount(tok: string | undefined): IntentAmount {
  if (!tok) return { kind: "none" };
  if (/^(all|max|everything)$/i.test(tok)) return { kind: "all" };
  if (/^\d+(\.\d+)?$/.test(tok)) return { kind: "exact", human: tok };
  return { kind: "none" };
}

const LEND_PROTOCOL_IDS = new Set<LendProtocol>(["navi", "suilend"]);

function isAmountToken(tok: string): boolean {
  return /^(all|max|everything|\d+(?:\.\d+)?)$/i.test(tok);
}

/**
 * Pull optional amount, coin, and protocol out of a lend command's tail
 * (everything after the verb). Each piece is optional so partial commands
 * ("lend", "lend 1 SUI") parse into exactly what the user gave — the caller
 * asks only for what is missing instead of re-prompting the whole form.
 */
function parseLendArgs(rest: string): { amount: IntentAmount; coinType?: string; protocol?: LendProtocol } {
  let tokens = rest.trim().split(/\s+/).filter(Boolean);

  // protocol clause: "… to|on|into|via <protocol>" — only consumed when the
  // following token is a known lending protocol (else the preposition might
  // precede a coin, e.g. "deposit 5 to USDC", so leave it for the coin scan).
  let protocol: LendProtocol | undefined;
  const pIdx = tokens.findIndex((t) => /^(to|on|into|via)$/i.test(t));
  if (pIdx >= 0) {
    const cand = tokens[pIdx + 1]?.toLowerCase() as LendProtocol | undefined;
    if (cand && LEND_PROTOCOL_IDS.has(cand)) {
      protocol = cand;
      tokens = tokens.slice(0, pIdx);
    }
  }

  // amount: a leading all|max|<number> token.
  let amount: IntentAmount = { kind: "none" };
  if (tokens[0] && isAmountToken(tokens[0])) {
    amount = parseAmount(tokens[0]);
    tokens = tokens.slice(1);
  }

  // coin: first remaining token that resolves to a whitelisted symbol.
  let coinType: string | undefined;
  for (const t of tokens) {
    const tok = resolveSymbol(t);
    if (tok) {
      coinType = tok.coinType;
      break;
    }
  }

  return { amount, coinType, protocol };
}

export function parseIntent(text: string): Intent | null {
  let raw = text.trim();
  if (!raw) return null;

  // Swap-picker deterministic binding: honor the EXACT coin types the form chose (no symbol
  // round-trip), validated against the allowlist. This is the strongest guarantee the token is
  // never mis-mapped — it bypasses symbol resolution entirely.
  const bind = SWAP_BIND_RE.exec(raw);
  if (bind) {
    raw = raw.replace(SWAP_BIND_RE, "").trim();
    const inType = bind[1].trim();
    const outType = bind[2].trim();
    const src = bind[3]?.trim().toLowerCase();
    const allow = new Set<string>(Object.values(COIN_TYPES));
    if (allow.has(inType) && allow.has(outType) && inType !== outType) {
      const amtTok = /(?:^|\s)(all|max|everything|\d+(?:\.\d+)?)\b/i.exec(raw)?.[1];
      const swappable = POPULAR_TOKENS.find((t) => t.coinType === inType)?.swappable ?? true;
      const swapSource = src && SWAP_SOURCE_IDS.has(src) ? (src as SwapSourceId) : undefined;
      return { action: "swap", coinInType: inType, coinOutType: outType, amount: parseAmount(amtTok), swappable, swapSource };
    }
  }

  const lower = raw.toLowerCase();

  // Read-only single-word / clear intents first.
  if (/^(portfolio|balances?|my (portfolio|balances?|holdings))\b/.test(lower)) return { action: "portfolio" };
  if (/^(protocols?|supported protocols?|which (dex|protocols?))\b/.test(lower)) return { action: "protocols" };
  if (/^(stats?|my stats?|level|badges?|rewards?|progress|xp)\b/.test(lower)) return { action: "stats" };
  if (/^(receive|my address|deposit address|how (do i|to) receive)\b/.test(lower)) return { action: "receive" };

  // Lend / lending — must route to the lend flow, NEVER portfolio. Fully parses
  // amount/coin/protocol so a complete command builds directly and a partial one
  // asks only for the missing piece (no whole-form re-ask loop).
  const lendMatch = /^(lend|lending|deposit|supply|repay)\b\s*(.*)$/i.exec(raw);
  if (lendMatch) {
    const verb: "deposit" | "repay" = /^repay$/i.test(lendMatch[1]) ? "repay" : "deposit";
    return { action: "lend", verb, ...parseLendArgs(lendMatch[2]) };
  }

  // Bare "swap" with no args → interactive form.
  if (/^swap$/i.test(raw)) return { action: "swap_form" };

  // Don't act on contextual follow-ups — defer to the LLM (which has history).
  if (CONTEXTUAL.test(lower)) return null;

  // swap / sell: <verb> [all|max|<amount>] <tokenA> [to|for|into <tokenB>] [via <source>]
  // The optional "via <source>" tail is what the swap-form card appends; without it the card's
  // command failed to parse and fell back to the (mis-mappable) LLM path.
  const swapRe = /^(swap|sell|dump|convert)\s+(?:(all|max|everything|\d+(?:\.\d+)?)\s+)?([a-z0-9]+)(?:\s+(?:to|for|into)\s+([a-z0-9]+))?(?:\s+via\s+([a-z]+))?$/i;
  const m = swapRe.exec(raw);
  if (m) {
    const [, , amtTok, symA, symB, viaSrc] = m;
    const inTok = resolveSymbol(symA);
    if (!inTok) return null; // unknown input symbol → clarify via LLM
    let coinOutType: string;
    if (symB) {
      const outTok = resolveSymbol(symB);
      if (!outTok) return null; // unknown destination → clarify
      coinOutType = outTok.coinType;
    } else {
      coinOutType = defaultDestination(inTok.coinType); // USDC→SUI, else→USDC
    }
    if (coinOutType === inTok.coinType) return null; // same in/out → let LLM clarify
    const src = viaSrc?.toLowerCase();
    return {
      action: "swap",
      coinInType: inTok.coinType,
      coinOutType,
      amount: parseAmount(amtTok),
      swappable: inTok.swappable,
      swapSource: src && SWAP_SOURCE_IDS.has(src) ? (src as SwapSourceId) : undefined,
    };
  }

  // send / transfer: <verb> [all|<amount>] <token> [to <recipient>] — recipient parsing
  // is intentionally left to the LLM (address/.sui resolution + provenance), so we only
  // capture the token + amount and let the agent gather the recipient.
  const sendRe = /^(send|transfer|pay)\s+(?:(all|max|\d+(?:\.\d+)?)\s+)?([a-z0-9]+)\b/i;
  const sm = sendRe.exec(raw);
  if (sm) {
    const tok = resolveSymbol(sm[3]);
    if (!tok) return null;
    return { action: "send", coinType: tok.coinType, amount: parseAmount(sm[2]) };
  }

  // Read-only ecosystem discovery — matched LAST so every value verb (swap/send/
  // lend) wins first. Each requires a domain noun so generic "top"/"best" can't
  // hijack routing; bare "total value locked" stays with the LLM (dashboard).
  // "best/highest stablecoin yields or APY"
  if (/\bstable\s?coins?\b/.test(lower) && /\b(yield|yields|apy|apr|earn|earning)\b/.test(lower)) {
    return { action: "ecosystemYields" };
  }
  // "top/biggest/largest TVL or protocols by value locked"; "tvl on sui"
  if (
    /\b(top|biggest|largest|highest|most)\b[\s\S]{0,24}\b(tvl|protocols?|value\s+locked|defi)\b/.test(lower) ||
    /\btvl\b[\s\S]{0,12}\bsui\b/.test(lower) ||
    /\bsui\b[\s\S]{0,12}\btvl\b/.test(lower)
  ) {
    return { action: "ecosystemTvl" };
  }
  // "memes / trending / hot tokens or coins"
  if (
    /\bmemes?\b/.test(lower) ||
    /\b(trending|hot)\b[\s\S]{0,16}\b(tokens?|coins?)\b/.test(lower) ||
    /\b(tokens?|coins?)\b[\s\S]{0,16}\b(trending|hot)\b/.test(lower)
  ) {
    return { action: "ecosystemTokens" };
  }

  return null; // nothing matched → LLM fallback
}
