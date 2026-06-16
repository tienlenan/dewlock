# 08 — Design Direction (fresh — DeFi, not the WC troll theme)

Do NOT reuse Daily Walrus's newspaper/troll aesthetic. A DeFi copilot must read **trustworthy, calm, precise**. Trust is a feature here (real money).

## Principles

1. **Trust-first.** Every value-moving step looks deliberate and legible. No playful ambiguity around money.
2. **Show, then confirm.** The tx-preview card is the hero UI: amounts, token type, raw 0x destination, dry-run effects, gas — all visible before the confirm button enables.
3. **Conversational, but structured.** Chat is the entry; results render as cards (portfolio, tx-preview, receipt), not walls of text.
4. **Network honesty.** Always show a network badge (mainnet / devnet-preview). Confidential = clearly "preview, devnet, unaudited".

## Aesthetic

- Dark, modern fintech: deep neutral background, one confident accent (Sui-ish teal/blue), green/red reserved strictly for balance deltas.
- Monospace for addresses, amounts, tx digests. Truncate addresses with copy + "view on explorer".
- Generous spacing; clear hierarchy; no skeuomorphic clutter.
- Motion: subtle; a deliberate micro-confirm on sign (reinforces "you are signing").

## Key screens / components

| Component | Notes |
|---|---|
| Chat thread | streaming; tool-call parts → cards |
| Portfolio card | balances by coin type, Cetus LP positions, PnL, total USD |
| Tx-preview card | action, amount, token type, **raw 0x target**, dry-run deltas, gas, slippage, cap warning, [Confirm & Sign] |
| Receipt card | tx digest (explorer link) + Walrus blob link + agent reasoning |
| Contact chip | named contact from memory ("888.sui") with resolved 0x on hover |
| Network badge | mainnet / devnet-preview, always visible |
| Confidential tab | isolated, labeled preview, devnet |

## Accessibility / clarity

- Contrast AA+; never encode meaning by color alone (deltas also signed +/−).
- Confirm actions reachable by keyboard; destructive/irreversible steps need explicit intent.

## Generative UI mapping

Agent tool outputs (zod-typed) → component props. e.g. `buildSwap` output → `<TxPreviewCard kind="swap" .../>`. Keep a 1:1 tool→card registry (mirrors Daily Walrus chat-render-parts).

(If desired, generate concrete mockups later with the `ui-ux-pro-max` / `stitch` skills — this doc is the brief.)
