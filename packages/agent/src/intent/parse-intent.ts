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

export type Intent =
  | { action: "swap"; coinInType: string; coinOutType: string; amount: IntentAmount; swappable: boolean }
  | { action: "swap_form" } // bare "swap" — missing args, render the form
  | { action: "send"; coinType: string; amount: IntentAmount }
  // Lend fully parses amount/coin/protocol so a complete command builds directly
  // and the UI only ever asks for what is genuinely missing (no re-ask loop).
  | { action: "lend"; verb: "deposit" | "repay"; amount: IntentAmount; coinType?: string; protocol?: LendProtocol }
  | { action: "portfolio" }
  | { action: "protocols" }
  | { action: "stats" }
  | { action: "receive" };

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
  const raw = text.trim();
  if (!raw) return null;
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

  // swap / sell: <verb> [all|max|<amount>] <tokenA> [to|for|into <tokenB>]
  const swapRe = /^(swap|sell|dump|convert)\s+(?:(all|max|everything|\d+(?:\.\d+)?)\s+)?([a-z0-9]+)(?:\s+(?:to|for|into)\s+([a-z0-9]+))?$/i;
  const m = swapRe.exec(raw);
  if (m) {
    const [, , amtTok, symA, symB] = m;
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
    return {
      action: "swap",
      coinInType: inTok.coinType,
      coinOutType,
      amount: parseAmount(amtTok),
      swappable: inTok.swappable,
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

  return null; // nothing matched → LLM fallback
}
