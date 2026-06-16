# 13 — DeFi-Core Re-center Decision (AUTHORITATIVE hero framing)

User directive: **Sui DeFi = CORE hero; Walrus Memory (memwal) = side-tech** (grabs Walrus track + polish, not the differentiator). Source: 5-agent workflow (DeFi-winning-angles + DeepBook-fit + security-as-product → synth → red-team), 2026-06-15. This file SUPERSEDES the hero framing in `01` and `09` (those still list a flat "track/transfer/swap/LP" hero — read it through this lens).

## Final thesis (red-team-corrected)

**An intent-firewall for agentic Sui DeFi:** you state a goal in natural language → the agent (0 user-fund keys) compiles it into ONE unsigned PTB → a deterministic fail-closed Guardian re-derives the math + dry-runs that exact bundle → you sign the literal artifact you saw (WYSIWYS). The DeFi core is **real, novel on-chain order work + adversarial-grade correctness**, not "chat that swaps."

## Hero priority — CORRECTED (red-team flipped the synth)

The synth crowned "atomic multi-leg PTB" the primary hero. **Wrong — demoted.** EVM already does atomic multi-protocol bundling (1inch/Furucombo/7702); claiming "structurally impossible elsewhere" invites the "you don't know the competition" dismissal. PTB composition is Sui *plumbing*, not a product.

| Rank | Capability | Role | Novelty |
|---|---|---|---|
| **1 — THE MOAT** | **Fail-closed Guardian + min-out RE-DERIVATION** (fresh quote cross-checked vs on-chain dry-run delta) + coin-TYPE gate + fail-CLOSED on sim/parse error | Build FIRST. The OZ/OtterSec bullseye (OZ ships a Sui DeFi Math Lib citing the Cetus exploit — this defends that exact failure class). Highest money-risk code. | the real edge |
| **2 — THE NOVELTY** | **DeepBook POST_ONLY limit-order** (read book via indexer → unsigned `placeLimitOrder` PTB → Guardian → sign) | THE hero capability. "Wait at my price, don't market-buy" is impossible on any AMM. Double-dips the $70k DeepBook track. | high (genuine) |
| 3 — the climax | **One deliberate fail-closed BLOCK** (lookalike `888-l.sui` + broken min-out) + immutable Walrus near-miss receipt anchored on a **Sui object** | Visual climax + honest Walrus qualifier in one beat. "Proof a BLOCK happened, not just a tx." | medium (framing) |
| vehicle | Atomic 2-leg PTB (swap + transfer), WYSIWYS | UX beat, NOT a novelty claim. Sign the literal bundle. | low — don't overclaim |

## DeepBook — YES, secondary track (verified)

- SDK low-risk: **`@mysten/deepbook-v3@1.4.1`, peerDep `@mysten/sui ^2.17.0`** (same Transaction layer as Cetus/SuiNS → dry-run/sign/receipt pipeline applies unchanged). mainnet + testnet in one constructor. SDK builds `Transaction` objects you do NOT sign (agent stays keyless).
- **Keep Cetus AND DeepBook**: Cetus = AMM venue + min-out correctness beat + a 2nd quote source; DeepBook = the novel CLOB capability + the $70k track.
- Traps to budget: **BalanceManager** (createAndShare + deposit = one-time user-signed onboarding → pre-fund OFF-STAGE; it = the Guardian hard cap). Hosted **indexer** for level2/mid-price + tick/lot/min-size metadata (else orders reject). **DEEP fee** → use whitelisted 0-fee DEEP/SUI or DEEP/USDC pool for the demo, or `payWithDeep`.

## CUT to stretch / drop (red-team)

- **Verifiable best-ex (CLOB-vs-AMM bps) → STRETCH, not core.** Testnet has near-zero DeepBook depth → a self-seeded "saved N bps" is a *manufactured* number a judge sees through. Credible ONLY on mainnet depth. Also it's a quote-time claim, not realized. Add back only if mainnet depth + RPC stability confirmed before P1; frame strictly as "best *quoted* execution, anchored to dry-run."
- **Atomic multi-leg flash-loan loop → DROP** (hot-potato repay-leg Guardian proof is a rabbit hole). Keep only a 2-leg atomic PTB.
- Lending exec, confidential transfers, proactive suggestions, all gamification → already deferred; keep out.

## memwal = scoped side-tech (3 honest jobs, ~0 net-new)

1. **Risk-rule recall (Conviction Streak, 2nd beat):** agent quotes your OWN day-1 committed cap back to freeze a tx. Stateless agent literally can't.
2. **Contacts / address book:** verified name→raw-0x; Guardian flags drift (anti-lookalike).
3. **Near-miss log:** "you almost sent to a lookalike last week."

**Walrus track is won by the immutable Blob receipt (rejected/executed PTB + verdict, content-addressed) HEAD-pointed by a Sui object — NOT by memwal.** Keep the Sui-anchor in P1 (cheapest novelty-per-line; blob-only = checkbox).

## Track targeting

PRIMARY **DeFi & Payments** (OZ/OtterSec — lead the pitch with min-out-re-derivation + fail-closed-sim correctness, use the BLOCK as the visual). SECONDARY **DeepBook $70k** (limit-order). TERTIARY/free-rider **Walrus** (Blob+Sui receipt) + **Agentic Web** (NL→mainnet flow, no extra build). ⚠️ Verify Sui Overflow allows ONE submission in both DeFi&Payments + DeepBook before relying on the double-dip.

## ⚠️ Reality check the synth got wrong

The security spine (Guardian, min-out re-derivation, dry-run, coin-type, SuiNS guard) is **0% coded in the new repo** — only the *pattern* (memwal wrapper, Walrus-blob, Mastra tools, sign hook) is reusable from Daily Walrus. It is **specced, not de-risked.** Build the spine FIRST; do not spend hackathon time on DeepBook polish while the OZ-bullseye min-out math stays untested. Carry forward verbatim: memwal is MUTABLE / no grant-share-ACL-owner; block-flash ASYNC of Walrus write.

## Build order (minimal winning core)

1. Sign + dry-run + **Guardian** spine (fail-closed, min-out re-derivation, coin-type). ← the moat, FIRST.
2. ONE DeepBook POST_ONLY limit-order flow on that spine (single pair, BalanceManager pre-funded off-stage).
3. ONE deliberate BLOCK + Walrus-Blob + Sui-object near-miss receipt.
4. (stretch, mainnet only) best-ex quote-off. (2nd beat) Conviction-Streak cap callback.

## Demo arc (~4 min, one E2E flow)

Connect+track → atomic 2-leg PTB (sign once, WYSIWYS) → DeepBook limit-order "wait at my price" (impossible on AMM) → **the BLOCK** (lookalike + broken min-out, fail-closed before signature, legible raw-addr diff) → tap → immutable Walrus+Sui receipt → "send $40 to bob" → agent recalls day-1 $5 cap, freezes. Close: "zero user keys, real on-chain order work, provably blocked from the wrong thing before you sign." Have a deterministic fixture fallback so live-RPC flake never self-inflicts a BLOCK.

## Changes to apply to rest of kit

- `01`: re-headline to intent-firewall; two heroes = Guardian-correctness + DeepBook limit-order; demote transfer/swap/LP to "payload the firewall guards"; add DeepBook to stack row.
- `02`: add DeepBook (indexer read + placeLimitOrder builder) + BalanceManager beside Cetus; unit-of-action = atomic PTB.
- `06`: add DeepBook section (`@mysten/deepbook-v3` 1.4.1, BalanceManager onboarding, indexer, whitelisted-pool, tick/lot units); add to network matrix.
- `09`: build order above; Guardian spine FIRST; add orderbook Guardian gates (POST_ONLY-enforce, self-match block, order-expiry-required, BalanceManager budget ceiling); best-ex = stretch.
- `12`: update win-sentence with DeepBook limit-order as the DeFi-core differentiator; keep gamification CUTs + the 3 corrections.

## Open questions

1. Verify one submission can enter DeFi&Payments + DeepBook both (else pick one primary).
2. Mainnet whitelisted-pool depth enough for a *credible* best-ex bps delta? (gates whether best-ex ships)
3. Per-tx + daily USD caps (business decision) — needed for "$5 cap" punchline + BalanceManager ceiling.
4. Sui-object HEAD-pointer Move write in P1? (recommend yes)
5. Hackathon + deadline (still unconfirmed) — caps whether best-ex ships at all.
6. Live mainnet RPC vs canned fixture for demo (fail-closed turns RPC flake into a self-inflicted BLOCK).
