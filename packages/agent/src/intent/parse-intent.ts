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
import { COIN_TYPES, DEEPBOOK_POOLS } from "../allowlist";

export type IntentAmount =
  | { kind: "all" }
  | { kind: "exact"; human: string }
  | { kind: "none" };

export type LendProtocol = "navi" | "suilend";

/** Swap execution venue chosen in the form (mirrors guardian SWAP_SOURCES). */
export type SwapSourceId = "cetus" | "aggregator" | "aftermath";
const SWAP_SOURCE_IDS = new Set<string>(["cetus", "aggregator", "aftermath"]);

export type Intent =
  | { action: "swap"; coinInType: string; coinOutType: string; amount: IntentAmount; swappable: boolean; swapSource?: SwapSourceId; slippageBps?: number }
  // Swap whose destination is a raw 0x coin type NOT on the verified allowlist — routed
  // through the Guardian's coin_allowlist gate (blocked before any build), never built.
  | { action: "swap_unverified"; coinInType: string; coinOutRaw: string; amount: IntentAmount }
  // Swap whose destination is an UNKNOWN ticker (not a verified symbol, not a 0x type) —
  // e.g. "swap USDC to aaa cat". Resolved to a plain "not recognised" reply so the LLM
  // never fabricates a route or renders a broken swap form for a scam/typo ticker.
  | { action: "swap_unknown_symbol"; inSym: string; outSym: string }
  | { action: "swap_form" } // bare "swap" — missing args, render the form
  // DeepBook limit order. "limit_order_form" = bare/partial intent → render the order
  // form; "limit_order" = a complete order (from the form's deterministic marker) →
  // build directly via prepareTrade.
  | { action: "limit_order_form"; poolKey?: string; side?: "BUY" | "SELL" }
  | { action: "limit_order"; poolKey: string; side: "BUY" | "SELL"; limitPrice: number; limitQuantity: number; expireTimestampMs: number }
  | { action: "send"; coinType: string; amount: IntentAmount }
  // Lend fully parses amount/coin/protocol so a complete command builds directly
  // and the UI only ever asks for what is genuinely missing (no re-ask loop).
  | { action: "lend"; verb: "deposit" | "repay"; amount: IntentAmount; coinType?: string; protocol?: LendProtocol }
  // Liquid staking via Aftermath Finance (afSUI). verb "stake" = SUI→afSUI, "unstake" = afSUI→SUI.
  | { action: "stake"; verb: "stake" | "unstake"; amount: IntentAmount; coinType?: string }
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

// Limit-order binding: the limit-order form emits the EXACT pool key + side + price +
// quantity + expiry as a machine marker so the order is built deterministically (the
// LLM never re-parses a pair/number). Stripped from the displayed bubble client-side.
// Format: [[limit:pool=<KEY>|side=<BUY|SELL>|price=<n>|qty=<n>|exp=<unixMs>]]
const LIMIT_BIND_RE =
  /\[\[limit:pool=([^|\]]+)\|side=([^|\]]+)\|price=([^|\]]+)\|qty=([^|\]]+)\|exp=([^\]]+)\]\]/i;

// Symbol → verified coin type (whitelist only).
const SYMBOL_TO_TYPE = new Map<string, { coinType: string; swappable: boolean }>(
  POPULAR_TOKENS.map((t) => [t.symbol.toUpperCase(), { coinType: t.coinType, swappable: t.swappable }]),
);

/** Counter-asset default: selling USDC → SUI; selling anything else → USDC. */
function defaultDestination(coinInType: string): string {
  return coinInType === COIN_TYPES.USDC ? COIN_TYPES.SUI : COIN_TYPES.USDC;
}

/** Verified, allowlisted coin types — a raw destination type outside this set is "unverified". */
const ALLOWLISTED_COIN_TYPES = new Set<string>(Object.values(COIN_TYPES));

// A swap destination given as a raw fully-qualified 0x coin type (e.g. "0xabc::scam::SCAM"),
// which the symbol-only swapRe cannot match. Captured here so an unverified destination reaches
// the Guardian's coin_allowlist gate deterministically instead of a prose refusal.
const SWAP_RAW_OUT_RE =
  /^(?:swap|sell|dump|convert)\s+(all|max|everything|\d+(?:\.\d+)?)\s+([a-z0-9]+)\s+(?:to|for|into)\s+(0x[0-9a-fA-F]+::[a-zA-Z0-9_]+::[a-zA-Z0-9_]+)$/i;

// Optional slippage clause in a swap command: "with 30% slippage", "at 25% slippage",
// "30% slippage", or "slippage 2%". Returns bps (percent × 100) and the text minus the clause.
const SLIPPAGE_RE =
  /(?:\b(?:with|at|max(?:imum)?)\s+)?(\d+(?:\.\d+)?)\s*%\s*slippage\b|\bslippage\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)\s*%?/i;

function extractSlippageBps(text: string): { bps?: number; stripped: string } {
  const m = SLIPPAGE_RE.exec(text);
  if (!m) return { stripped: text };
  const pct = parseFloat(m[1] ?? m[2]);
  if (isNaN(pct) || pct < 0) return { stripped: text };
  const stripped = text
    .replace(SLIPPAGE_RE, "")
    .replace(/\s+(?:with|at)\s*$/i, "") // drop a dangling connector left by "with slippage 2%"
    .replace(/\s{2,}/g, " ")
    .trim();
  return { bps: Math.round(pct * 100), stripped };
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

  // Limit-order deterministic binding: honor the EXACT pool/side/price/qty/expiry the
  // form chose, validated against the pool allowlist. Strongest guarantee the order is
  // never mis-parsed — it bypasses pair/number re-parsing entirely.
  const lim = LIMIT_BIND_RE.exec(raw);
  if (lim) {
    const poolKey = lim[1].trim().toUpperCase();
    const side = lim[2].trim().toUpperCase();
    const limitPrice = Number(lim[3]);
    const limitQuantity = Number(lim[4]);
    const expireTimestampMs = Number(lim[5]);
    if (
      DEEPBOOK_POOLS[poolKey] &&
      (side === "BUY" || side === "SELL") &&
      Number.isFinite(limitPrice) && limitPrice > 0 &&
      Number.isFinite(limitQuantity) && limitQuantity > 0 &&
      Number.isInteger(expireTimestampMs) && expireTimestampMs > 0
    ) {
      return { action: "limit_order", poolKey, side, limitPrice, limitQuantity, expireTimestampMs };
    }
  }

  const lower = raw.toLowerCase();

  // Bare/partial "place limit order" → render the order form (pair + side + price +
  // quantity + expiry). A side hint ("limit buy" / "limit sell") pre-selects the toggle;
  // the full order is built later from the form's deterministic marker (handled above).
  if (/\blimit\s+order\b/.test(lower) || /\blimit\s+(buy|sell)\b/.test(lower)) {
    const side = /\blimit\s+buy\b|\bbuy\b/.test(lower)
      ? "BUY"
      : /\blimit\s+sell\b|\bsell\b/.test(lower)
        ? "SELL"
        : undefined;
    return { action: "limit_order_form", side };
  }

  // Read-only single-word / clear intents first.
  if (/^(portfolio|balances?|positions?|my (portfolio|balances?|holdings|positions?))\b/.test(lower)) return { action: "portfolio" };
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

  // Liquid staking / unstaking — "stake X SUI", "unstake X afSUI", "liquid stake 5 SUI".
  // Coin is always SUI (stake) or afSUI (unstake); amount is optional (missing → form).
  const stakeMatch = /^(stake|liquid\s+stake|unstake|liquid\s+unstake)\b\s*(.*)$/i.exec(raw);
  if (stakeMatch) {
    const verb: "stake" | "unstake" = /^unstake|^liquid\s+unstake/i.test(stakeMatch[1]) ? "unstake" : "stake";
    // Parse amount and optional coin symbol from the tail (same pattern as parseLendArgs).
    let tokens = stakeMatch[2].trim().split(/\s+/).filter(Boolean);
    let amount: IntentAmount = { kind: "none" };
    if (tokens[0] && isAmountToken(tokens[0])) {
      amount = parseAmount(tokens[0]);
      tokens = tokens.slice(1);
    }
    let coinType: string | undefined;
    for (const t of tokens) {
      const tok = resolveSymbol(t);
      if (tok) { coinType = tok.coinType; break; }
    }
    return { action: "stake", verb, amount, coinType };
  }

  // Bare "swap" with no args → interactive form.
  if (/^swap$/i.test(raw)) return { action: "swap_form" };

  // Don't act on contextual follow-ups — defer to the LLM (which has history).
  if (CONTEXTUAL.test(lower)) return null;

  // swap to a raw 0x coin type — matched BEFORE the symbol-only swapRe. An unverified
  // destination (not on the allowlist) routes to the Guardian's coin_allowlist gate; an
  // allowlisted raw type is treated as a normal swap to that type.
  const rawOut = SWAP_RAW_OUT_RE.exec(raw);
  if (rawOut) {
    const inTok = resolveSymbol(rawOut[2]);
    if (inTok) {
      const outRaw = rawOut[3];
      const amount = parseAmount(rawOut[1]);
      if (!ALLOWLISTED_COIN_TYPES.has(outRaw)) {
        return { action: "swap_unverified", coinInType: inTok.coinType, coinOutRaw: outRaw, amount };
      }
      if (outRaw !== inTok.coinType) {
        return { action: "swap", coinInType: inTok.coinType, coinOutType: outRaw, amount, swappable: inTok.swappable };
      }
    }
  }

  // swap / sell: <verb> [all|max|<amount>] <tokenA> [to|for|into <tokenB>] [via <source>] [slippage clause]
  // The optional "via <source>" tail is what the swap-form card appends; without it the card's
  // command failed to parse and fell back to the (mis-mappable) LLM path. An optional slippage
  // clause is extracted first so the symbol-pair regex still matches the remaining text.
  const swapRe = /^(swap|sell|dump|convert)\s+(?:(all|max|everything|\d+(?:\.\d+)?)\s+)?([a-z0-9]+)(?:\s+(?:to|for|into)\s+([a-z0-9]+))?(?:\s+via\s+([a-z]+))?$/i;
  const { bps: slippageBps, stripped: swapText } = extractSlippageBps(raw);
  const m = swapRe.exec(swapText);
  if (m) {
    const [, , amtTok, symA, symB, viaSrc] = m;
    const inTok = resolveSymbol(symA);
    if (!inTok) return null; // unknown input symbol → clarify via LLM
    let coinOutType: string;
    if (symB) {
      const outTok = resolveSymbol(symB);
      // Unknown destination ticker → deterministic "not recognised" reply (NOT a broken
      // form): the LLM must never guess an address or render getSwapForm for it.
      if (!outTok) return { action: "swap_unknown_symbol", inSym: symA.toUpperCase(), outSym: symB };
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
      slippageBps,
    };
  }

  // Swap verb with a MULTI-WORD destination clause the strict pair regex above can't match
  // (e.g. "swap USDC to aaa cat"). Resolve the destination (full phrase, else its first word):
  // a known token → a normal swap (the directive/Guardian still gate a non-swappable output);
  // an unrecognised destination → "not recognised" deterministically, never a broken form.
  const swapDestRe = /^(?:swap|sell|dump|convert)\s+(all|max|everything|\d+(?:\.\d+)?)?\s*([a-z0-9]+)\s+(?:to|for|into)\s+(.+?)(?:\s+via\s+[a-z]+)?$/i;
  const dm = swapDestRe.exec(swapText);
  if (dm) {
    const inTok = resolveSymbol(dm[2]);
    if (inTok) {
      const destRaw = dm[3].trim();
      const destTok = resolveSymbol(destRaw) ?? resolveSymbol(destRaw.split(/\s+/)[0]);
      if (!destTok) {
        return { action: "swap_unknown_symbol", inSym: dm[2].toUpperCase(), outSym: destRaw };
      }
      if (destTok.coinType !== inTok.coinType) {
        return {
          action: "swap",
          coinInType: inTok.coinType,
          coinOutType: destTok.coinType,
          amount: parseAmount(dm[1]),
          swappable: inTok.swappable,
          slippageBps,
        };
      }
    }
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
