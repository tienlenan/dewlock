/**
 * Context-aware suggestion chips for the chat composer.
 *
 * Derives chips from the user's actual holdings + the last card shown, instead of a
 * static list. Every chip's `text` is written to PARSE deterministically via the
 * intent parser (parse-intent), so a click routes the same reliable path as typing.
 */

export interface Suggestion {
  label: string;
  /** Sent to the agent verbatim — must be intent-parser-parseable. */
  text: string;
}

export interface SuggestionContext {
  connected: boolean;
  /** Held token tickers (verified/whitelisted), e.g. ["SUI", "USDC"]. */
  holdings: string[];
  /** The most recent assistant card type, e.g. "portfolio" | "receipt" | "tx-preview". */
  lastCardType?: string;
}

export function buildSuggestions(ctx: SuggestionContext): Suggestion[] {
  const out: Suggestion[] = [];
  const has = (sym: string) => ctx.holdings.some((h) => h.toUpperCase() === sym);

  // Base read-only chips — always safe + parseable.
  out.push({ label: "My portfolio", text: "my portfolio" });
  out.push({ label: "Supported protocols", text: "protocols" });

  // Sui-ecosystem discovery — read-only, always relevant (mirror the welcome chips).
  // Each text routes deterministically to its ecosystem tool via the intent parser.
  out.push({ label: "Best yields", text: "best stablecoin yields on Sui" });
  out.push({ label: "Top TVL", text: "top TVL on Sui" });
  out.push({ label: "Trending tokens", text: "trending tokens on Sui" });

  if (ctx.connected && ctx.holdings.length > 0) {
    // Actions on what they actually hold (counter-asset rule: USDC→SUI, else→USDC).
    if (has("USDC")) out.push({ label: "Swap all USDC → SUI", text: "swap all USDC to SUI" });
    if (has("SUI")) out.push({ label: "Sell SUI", text: "sell SUI" });
    // First non-base holding → a "sell" shortcut.
    const other = ctx.holdings.find((h) => !["SUI", "USDC"].includes(h.toUpperCase()));
    if (other) out.push({ label: `Sell ${other}`, text: `sell ${other}` });
  }

  // After a portfolio view or a completed action → suggest logical next steps.
  if (ctx.lastCardType === "portfolio" || ctx.lastCardType === "receipt") {
    if (has("USDC") || !ctx.connected) out.push({ label: "Lend USDC", text: "lend USDC" });
    out.push({ label: "My stats", text: "my stats" });
  }

  // De-dup by text + cap to keep the row tidy (chips wrap, so a slightly higher
  // cap fits the discovery set alongside a couple of holdings/context actions).
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.text) ? false : (seen.add(s.text), true))).slice(0, 7);
}
