# Changelog

## 2026-06-30 — Pay-in-any-coin (swap → send exact, one signature) — mainnet-verified

### Added
- **`splitExactFromChained`** ([build-composite.ts](../packages/sui/src/build-composite.ts)) — a chained leg now splits EXACTLY the declared amount from a variable upstream output (e.g. a swap result) and returns the dust to the sender, guarded so the amount can't exceed the prior swap's guaranteed `minOut`. The chained `send` leg uses it to deliver an exact amount instead of forwarding the whole coin; the chained lend-deposit was refactored onto the same helper (DRY; the L1 minOut split is unchanged).
- **Pay-in-any-coin**: *"swap 1 SUI to USDC then send 0.5 USDC to @bob"* now compiles to ONE atomic transaction where the recipient receives the exact declared amount and the residual returns to the sender.

### Verified (mainnet)
- Real on-chain execution: tx **`8pfAQPLJ4xnVHoDEqUiqusBsH7cWQBv7w3CjdcvDXSqi`** (success) — atomic swap 0.05 SUI → USDC then send EXACTLY 0.01 USDC to a distinct recipient; recipient balance delta = 10000 (0.01 USDC) to the mist, dust returned to sender. This also certifies the LIVE dynamic-composite path on mainnet (previously only the fixture branch + hermetic mocks were exercised).

### Tests
- New live-path cases in `build-dynamic-composite-live.test.ts`: exact-pay split assertion + over-pay (amount > minOut) rejection. Full suite green (1206).

## 2026-06-28 — First-run onboarding tour (driver.js)

### Added
- **Guided product tour** (`apps/web/lib/onboarding/`) — a driver.js spotlight tour that auto-opens once for a first-time user when the connected copilot shell (`app/app/page.tsx`) mounts, walking the core flow: chat composer → send → sidebar nav → friend list → settings (6 steps). A "Take the tour" button in the Guide panel replays it anytime (switches back to the chat view first so the composer step always plays). "Seen" is a single global `localStorage` flag (`dewlock:tour-completed`); finishing OR closing/ESC records it.
- **`data-tour` anchors** on the composer/send (`chat-input.tsx`), sidebar nav (`app-sidebar.tsx`), and header friend-list/settings/menu-toggle buttons (`app/app/page.tsx`) — attribute-only, decoupled from styling/a11y.
- **Theme-aware popover skin** (`.dewlock-tour--dark|--light` in `globals.css`). The `/app` shell applies `.dark` to its own root div, NOT `<html>`, and driver.js mounts its popover on `document.body` (outside that subtree) — so the engine picks the popover class + overlay color from the live app theme rather than relying on CSS-var inheritance. Mobile (<768px) swaps the sidebar-nav step for a menu-toggle step; absent/hidden anchors are filtered out.
- **Header onboarding buttons** (`app/app/page.tsx`) — a Compass "Take the tour" button and a Sparkles "See the demo" button in the header bar, available from any view.
- **Scripted demo showcase** (`components/onboarding/demo-showcase-overlay.tsx` + `lib/demo/onboarding-demo-cards.ts`) — a read-only overlay that walks a new user through what Dewlock produces: a mock portfolio, an atomic multi-intent chain-plan (with the "Run as 1 transaction" toggle), a single-PTB tx-preview, and a Guardian BLOCK. It renders the REAL card components (`PortfolioCard`/`ChainPlanCard`/`TxPreviewCard`/`BlockCard`) with mock data + inert handlers, deliberately bypassing the live signing/composite wrappers — so the UI is pixel-identical yet NOTHING can execute (every card carries the DEMO badge; action buttons surface an explanatory notice). "Try it for real" chips hand a real command to the live composer. The tour's finale button ("Show me an example ▶") and the Guide-panel/header buttons all open it. No chat/signing/composite logic was modified.

### Notes
- Verified live (dev burner wallet + headless drive): tour auto-fires once + seen-flag persistence + replay-bypasses-flag + popover legibility in BOTH themes; demo overlay renders the four real cards pixel-identical, and the atomic/confirm buttons show the demo notice instead of executing. Client-only; no wallet/secret access. Additive only (no logic touched); typecheck clean.

## 2026-06-28 — Generalized atomic composite engine (any ordered sequence → one signature)

### Added
- **Generalized atomic composite builder** (`buildDynamicComposite` in `packages/sui/src/build-composite.ts`) — composes ANY ordered sequence of allowlisted actions (`send`, `swap`, `lend_deposit`, `stake`) into ONE atomic PTB, one signature, all-or-nothing. Replaces the v1 `swap_lend_v1` static recipe. Dynamic recipe registry: `buildDynamicRecipe(legs)` in `composite-recipes.ts` returns a `CompositeRecipe` with id="dynamic". Allowed MoveCall targets per leg come from the existing per-action allowlist (`allowedTargetsForLegType`). Supports full chaining: leg k+1 can consume the output of leg k. Allows same-type-multi-target (N sends to different addresses, N swaps, N deposits) and mixed combos (send+swap+lend, stake+swap, etc.). Max 8 legs (DoS/UX bound).
- **Recipient-aware anti-leak gate** (`checkCompositeDeltaAntiLeak` in `packages/agent/src/guardian.ts`) — multi-set equality for declared send legs. Every third-party inflow in the dry-run MUST exactly match a declared `send` leg (resolved 0x recipient + coinType + amount, per-recipient sum, multiset-equality to the balance deltas), else BLOCK. When there are no send legs (e.g. swap→lend), degrades to the prior "no third-party inflow" behavior. Coin object changes (which carry no ownerAddress) are safely skipped; balanceDeltas is the authoritative source. Closes 13 adversarial vectors: attacker address injection, amount inflation, recipient swapped, dust skim, gas exfil via coin teleport, dropped leg, unspent leg output, per-recipient mismatch, etc.
- **Composite flow-map topology fix** (`deriveCompositeFlow` + `buildCompositeGraph` in `packages/web/components/tx-preview-format.ts` / `tx-flow-graph.tsx`) — legs are rendered by chaining. Independent legs (a send, or a swap not fed by a prior leg's output) branch straight from "You" (the wallet) as separate outflows; only a chained leg (amountFrom=prev-output) connects to the prior node. Example: "send 1 to A and send 1 to B" renders TWO wallet outflows, not a sequential A→B chain; "swap→lend" renders You → Cetus → NAVI (each node with real logos + estimated amounts).
- **Multi-recipient send deterministic flow** — "send X to @A @B" fans into N independent send legs; adjacent @mentions joined by comma, each resolved 0x server-side, each branch from the wallet in the flow map.
- Atomic toggle ("Run as 1 transaction") now shows on any 2–8-step eligible chain (not just swap→lend); UI: `isAtomicEligible` extended.

### Fixed
- **Guardian route/tool schema mismatch** — `prepareTrade` → `routeAction` cross-check (gates 2/10) was comparing the declared action's `actionType` against the tool's result `category`, but they use different enum names (`ActionType` vs `Action` enum in the tools module). Now both normalize to the canonical router's output, so a swap intent doesn't fail a false "category != actionType" mismatch.
- **Anti-leak gate skips coin objectChanges** — coin transfers appear in BOTH `objectChanges` (as Coin objects transferred to recipients) AND `balanceDeltas` (as fungible amounts per owner). The prior gate double-counted, treating a transferred coin's `ownerKind="third-party"` as a leak even when it matched a declared send leg. Now: if there are declared send legs, we skip objectChanges and trust balanceDeltas (the authoritative accounting path); if no send legs, objectChanges with third-party owners still block (backward-compatible).
- **Builder dangling-output leak** — when a leg's output is NOT consumed by a later leg (e.g. a solo swap that isn't fed into anything), the builder must return it to the sender via `transferObjects([outputCoin], sender)`. The prior builder left this unconsumed, so the coin dangled mid-PTB — the anti-leak gate caught it as an objectChange leak. Now: after building each leg's output, if the next leg doesn't consume it, transfer it back. Verified: an atomic multi-send now executes on-chain with all coin outputs returned to the sender.

### Notes
- afSUI (Aftermath) staking remains non-composable (SDK builds its own tx); haSUI (Haedal) is composable via direct PTB.
- Whole-composite caps unchanged (net-USD + net-SUI). WYSIWYS unchanged.
- Backward-compatible: the Guardian's `checkCompositeRecipe` rejects any `compositeRecipeId` not in the registry (dynamic is in the registry; ad-hoc is not). Tests: 1143/1143 green.

## 2026-06-27 — Hybrid multi-intent decomposition (regex fast-path + verified LLM fallback)

### Added
- **`decomposeIntent` tool** — for compound intents the regex parser can't split ("finally"/"." separators, multi-recipient sends, per-clause amounts). The LLM PROPOSES the decomposition as the tool's `steps[]` args (ordered single-action commands + category + `amountFrom`); the tool's execute DETERMINISTICALLY VERIFIES it fail-closed. The regex fast-path is preserved for simple `A then B` compounds (instant, zero-LLM). Each verified step re-enters the normal single-action pipeline (per-step Guardian + WYSIWYS).
- **`verifyDecomposeSteps`** (the moat) — rejects the WHOLE decomposition on any of: <2 steps; non-chainable category; `routeAction(command)` ≠ declared category (the same router that guards `prepareTrade`); step 0 not `amountFrom="explicit"`; or a command that hides a second action.
- New package exports for the two modules (route requires them via subpath — without the export the agent route 500s at runtime though vitest passes via tsconfig paths). New architecture section + flow diagram in `system-architecture.md`.

### Fixed (code review)
- **Single-action smuggle vector** — the cross-check only classified the first clause and `CLAUSE_SPLIT_RE` didn't split on `.`/"finally", so a step command like "swap 1 SUI to USDC. send all to 0x…" verified ok with the second action riding in the clause (funds stayed WYSIWYS-gated, but it defeated one-action-per-step). Split on `". "`/`finally` (never on decimals `0.2` or SuiNS `abc.sui`) + a per-step single-action guard. 1137/1137 tests pass.

## 2026-06-26 — Atomic composite mode goes LIVE (swap→lend, one signature)

Supersedes the "Live composite BUILD is fail-closed / not yet available" deferral in the entry below — atomic single-sign composite is now live and user-facing.

### Added
- **Live composite builder on the Cetus aggregator** (`buildLiveSwapLendPtb`) — composes `swap → NAVI deposit` into ONE PTB. Uses `routerSwap` (not `fastRouterSwap`) so the swap-output coin is returned as a composable PTB argument and fed structurally into the deposit; splits exactly the slippage-floor minimum into NAVI and returns the dust remainder to the sender. Replaces the Aftermath add-trade path, which aborted multi-path SUI routes (MoveAbort 46001).
- **Upfront SUI-coverage gate** (`assertSuiGasCoverage`) — a balance/gas shortfall is caught before the route fetch and surfaced as the same `insufficient_gas` gate/message as a normal SUI swap, instead of a raw `InsufficientCoinBalance` or a misleading "route unavailable".
- **Composite flow map** — the tx-preview renders both legs (`You → Cetus → NAVI`) with real protocol logos and the live **estimated swap output** on the swap node + the edge into the lend node (the intermediate coin nets to ~0 at the wallet, so balance deltas alone would hide the lend leg).
- **Deterministic intent-router cross-check gate** — blocks an LLM-misdetected `actionType` that doesn't match the user's literal command (57 unit tests).
- **Sequential chain UX** — transient stale-object error now auto-rebuilds the step with fresh bytes (bounded, never re-sends stale bytes); continuous timeline rail on the plan card.

### Notes
- The Guardian's `checkCompositeRecipe` (entry below) re-verifies the whole composed PTB before the single signature — the safety model is unchanged; on any build/Guardian failure it degrades to the sequential chain. New end-user + architecture doc: `atomic-composite-mode.md`. 1108/1108 tests pass; typecheck clean.

## 2026-06-26 — Atomic composite-recipe Guardian gate (Track B) — the moat

### Added
- **`checkCompositeRecipe` Guardian gate** — the authoritative, fail-closed safety check for a single-PTB atomic composite (recipe v1 = `swap→lend`). Enforces four invariants in order, any failure → BLOCK: (a) **closed-recipe registry** — `compositeRecipeId` must name a pre-declared recipe (NO ad-hoc LLM composition); (b) **target multiset** — the PTB's MoveCall set must equal the recipe's declared legs (no extra/missing calls); (c) **coin-type linkage** — swap output coin must equal lend input coin; (d) **delta/owner anti-leak + caps** — runs the dry-run and BLOCKs on ANY third-party object-change owner OR any positive balance delta to a non-sender address, then bounds the whole-PTB net outflow by both a USD cap and an independent **net-SUI cap** (`NET_SUI_DELTA_CAP_MIST` = 10 SUI). Dry-run failure / unpriced coin / unclassifiable owner → BLOCK.
- The anti-leak is **delta/owner-based, not static graph-isomorphism** — it reuses the existing `extractObjectChanges`/`classifyOwner` + `computeNetOutflowUsd` machinery, so a leak is caught regardless of PTB graph shape (closes the `tx.gas`-split→TransferObjects SUI-exfil and Result-derived-recipient vectors). Verified that the live dry-run surfaces per-owner balance changes for ALL owners, so the gate catches real leaks, not just mocked ones.
- `composite` action type + `composite-recipes.ts` (closed registry) + `build-composite.ts` + 17 adversarial safety tests (third-party transfer, SUI-exfil, non-sender delta, multiset splice, unknown/missing recipe, both caps, fail-closed dry-run, atomicity, WYSIWYS digest stability, single-action non-regression).

### Deferred (fail-closed, not faked)
- **Live composite BUILD is fail-closed** — `buildComposite` refuses live mode (the aggregator SDK exposes no stable output-coin hook for in-PTB composition) and a composite intent **degrades to the Track-A sequential chain** (which works). So atomic execution is not yet available, but no unsafe composite can be built; the verified gate guards it for when the builder lands. The Track-A planner opt-in ("execute atomically") UI is also deferred.

### Notes
- This was the moat-critical phase; the security gate is implemented, adversarially tested, and personally reviewed against the real dry-run path. Single-action flows unchanged. 982/982 tests pass; typecheck clean.

## 2026-06-25 — Multi-step intent chaining: Track A (sequential) — machinery + safety

### Added
- **Sequential chaining machinery** for compound intents ("swap 5 SUI to USDC then lend it on NAVI"): the existing `detectMultiAction` splitter extended with VN connectors (rồi / và sau đó / tiếp theo) + `isChainableSequence` / `parseChainSteps` → an ordered `ChainStep[]`; the agent route carves a hole in the "one action per message" refusal so a chainable sequence routes to a chain-plan card instead of being refused.
- **`PlanStepper` state machine** (`packages/agent/src/chaining/plan-stepper.ts`) with the load-bearing safety contracts, all unit-tested:
  - **Delta resolver** (`resolveStepDelta`) — a step consuming a prior step's output is pinned to the *delta* (`post − pre` snapshot), never the wallet's current total: "swap 5 SUI→USDC then lend it" with 1000 pre-existing USDC lends the ~swap-output, NOT 1018.
  - **Stale-object wait** (`waitForObjectVersions` / `objectsToWaitBeforeStep`) — step k+1 waits for the coin object versions step k touched to be visible before building (avoids "object unavailable for consumption" aborts); never silently retries stale bytes.
  - **Halt semantics** — a BLOCK at step k cancels all later steps; `isChainIncomplete` + block reasons drive a chain-incomplete receipt marker.
  - Each step remains a normal single-action PTB through the unchanged Guardian (no composition).
- **Daily-spend moved to sign-time** (`recordSpendAtSignTime`, idempotent by txDigest) — was counted at Guardian-PASS, causing double-count/abandon pollution; a chain's recycled output is counted net-once.
- `ChainPlanCard` (per-step status, resolved amount, chain-incomplete banner) + 26 new tests.

### Deferred (flagged, not faked)
- **End-to-end client sign-loop wiring** — the Plan card renders and the stepper/route/parser are complete, but `useCopilotChat`/`ChatThread` does not yet drive the actual prepare→sign→confirm cycle *between* steps, so a chain is not yet executable in the UI. (Machinery + safety are done and tested; the multi-turn sign loop is the remaining integration.)
- **Durable cross-refresh persistence** — the stepper is in-session; a page refresh loses in-flight chain state (resume needs a wallet-keyed KV store).

### Notes
- Tests: 935/935 pass; typecheck clean.

## 2026-06-25 — Yield advisor + activity history (read-only) + Guardian gate dedup

### Added
- **Yield advisor** (`get-yield-advice`) — composes the existing read tools (stablecoin yields, top-TVL, afSUI/haSUI staking APYs, live portfolio) into a ranked recommendation card for the user's idle balances; action buttons reuse the existing Guardian-gated flows (advice never auto-executes). No fabricated numbers — a venue with no readable APY is omitted.
- **Activity history** (`get-history`) — reverse-chronological feed of a wallet's actions (incl. BLOCK receipts), enumerated from the existing memwal "action log" recall. **No P&L column**: the receipt schema stores no entry-USD baseline and pricing is spot-only, so cost basis is undeterminable — a fabricated P&L would violate the zero-fabricated-numbers rule (amounts shown are the values recorded at action time, not profit/loss).
- Intent routing for advice/history queries → the READ tools; load-bearing tests prove a read intent can never become a value move (no `prepareTrade`). Ambiguous free-form prose falls through to the LLM (the deterministic matcher only catches clear advisory phrasings).

### Changed
- **Deduped the Guardian `checkProvenance` gate to a single source of truth** in `guardian-gates.ts` (the pure, SDK-free module); `guardian.ts` now imports + re-exports it instead of carrying a second, hand-synced copy that had begun to drift. Public API unchanged.

### Notes
- Tests: 909/909 pass; typecheck clean.

## 2026-06-25 — Liquid staking 2nd provider: haSUI (Haedal, direct-PTB)

### Added
- **haSUI** (Haedal) as a second LST provider for `stake`/`unstake`, built as a **direct PTB** (Haedal has no unsigned-PTB SDK). Targets captured from mainnet: `interface::request_stake(&mut SuiSystemState@0x5, &mut Staking, Coin<SUI>, recipient)` (mint) and `interface::request_unstake_instant(&mut Staking, Coin<HASUI>)` (instant redeem). New `HAEDAL_PACKAGE` + `HAEDAL_STAKING_OBJECT` constants.
- **Provider-keyed action-shape gate** — a new `lstProvider` (`afsui`|`hasui`) threads through the proposal so the shape gate's allowed set is a SINGLE target per provider: a haSUI PTB cannot pass an afSUI-declared stake shape (and vice-versa), and an unknown provider BLOCKs (`checkStakingConstraints` fail-closed).
- haSUI priced for the unstake outflow cap the same independent way as afSUI (SUI floor × floored haSUI/SUI rate, not Haedal's own rate). Registry: Haedal `deferred`→`built` (+2 targets, allowlist 45 → 47); the 2-provider picker is registry-driven.
- Tests: +19 (haSUI stake/unstake PASS, scam-clone haSUI → BLOCK via the staking gate, cross-provider shape BLOCK, unknown-provider fail-closed, registry snapshot).

### Notes
- **vSUI/Volo stays excluded** (registry `status:"hacked"`) — not re-enabled.
- The Haedal **live PTB path is not unit-verifiable** (no SDK; fixture-mode tests only). The builder is marked `[needs mainnet verification]`; the PTB shape was checked arg-by-arg against the captured on-chain entry signatures but a mainnet dry-run is still required before a live demo.
- Tests: 882/882 pass; typecheck clean.

## 2026-06-25 — Liquid staking (afSUI via Aftermath)

### Added
- **`stake` / `unstake` value-moves** — SUI ⇆ afSUI liquid staking via Aftermath, on the fail-closed Guardian spine. `stake` mints afSUI (`staked_sui_vault::request_stake_and_keep`); `unstake` is the instant atomic redeem (`request_unstake_atomic_and_keep`, no epoch delay). New `@dewlock/sui/build-stake` builder (Aftermath SDK loaded from the prebundled CJS, in `@dewlock/sui`).
- **`checkStakingConstraints` gate** — LST coin-type provenance against the curated map (a scam-clone afSUI is not in `COIN_DECIMALS` → BLOCK), plus a minimal-exact per-verb action-shape allowlist (a swap/lend/deposit call cannot ride a stake shape; stake and unstake targets can't be swapped). Provenance hard-block extended to stake/unstake derived amount/coinType.
- **afSUI outflow pricing** for the unstake cap — `max(live price, SUI_USD_floor × afSUI/SUI floor)`, derived from the SUI floor and **independent of Aftermath's own exchange-rate** (no circular trust). An unpriced LST outflow → BLOCK (fail-closed).
- **`get-stake-options` tool** + staking picker card + intent routing (`stake`/`unstake` verbs). Protocol registry adds an `aftermath-staking` (afSUI) entry (allowlist 43 → 45 targets).
- Tests: staking gate (pass/scam-clone BLOCK via the staking gate/unpriced-LST BLOCK/shape-smuggle BLOCK/derived-amount BLOCK), builder shape, registry snapshot.

### Notes
- The Aftermath stake call emits the validator as a real Move-call arg (no default) — the builder reads the protocol validator from the SDK addresses and fail-closes if unavailable (passing the user's own address would abort on-chain).
- Tests: 863/863 pass; typecheck clean.

## 2026-06-25 — NAVI borrow/withdraw with fail-closed post-tx health-factor gate

### Added
- **NAVI borrow & withdraw value-moves** (health-REDUCING verbs, previously gated off), guarded by a deterministic **post-tx health-factor gate**. `checkPostTxHealthFactor` calls NAVI's own `getSimulatedHealthFactor` (contract-authoritative `devInspect`, not a hand-rolled formula) and BLOCKs when the projected HF would fall below the server-authoritative threshold (default 1.6) or a full-withdraw would leave outstanding debt.
- **Fail-closed HF read** (`@dewlock/sui/navi-hf-simulation`): any throw, `undefined`, `NaN`, or non-finite simulation result is re-thrown → the gate treats it as BLOCK (never a silent pass). Does not inherit the best-effort `getHealthFactor` semantics.
- **Borrow-inflow value cap** (`checkBorrowInflowCap`): a borrow is an inflow, so the net-outflow cap structurally can't see it. The new gate values the borrowed `coinTypeIn` via the trusted price (unpriced → BLOCK) and enforces a dedicated server-side borrow cap.
- **Provenance hard-block extended** to `lend_borrow`/`lend_withdraw`: a derived (injection-sourced) amount/coinType now hard-BLOCKs (was `transfer`-only).
- Tests: HF pass/block, first-borrow zero-debt, sim-throws/undefined/Infinity → BLOCK, `borrow_cap` isolation (high tx-cap can't mask it), shape-smuggle BLOCK, derived-amount BLOCK, NAVI-only builder guard.

### Changed
- Borrow/withdraw are **NAVI-only** at both the Guardian (`checkLendingConstraints`) and builder (`buildLend`) — a non-NAVI borrow/withdraw is rejected fail-closed (Suilend has no borrow/withdraw path + the HF gate is NAVI-specific; Suilend stays deposit/repay + deep-link).
- Three coordinated unlock sites lifted in lockstep with a **minimal-exact** action-shape allowlist (`incentive_v3::borrow`/`borrow_v2`/`withdraw`/`withdraw_v2`) — the deposit allowlist set is NOT reused (would re-open call-smuggling).

### Notes
- NAVI SDK-loading code lives in `@dewlock/sui` (where `sdk-bundles/navi.cjs` + the `@naviprotocol/lending` dep resolve), re-exported to the agent — placing it in `@dewlock/agent` made the bundle require() resolve to a non-existent path.
- Tests: 836/836 pass; no new type errors.

## 2026-06-22 — Gas-agnostic signing, pre-sign tx flow, wallet-switch isolation

### Changed
- **WYSIWYS signing now gas-agnostic.** Guardian dry-runs full bytes for effects but hashes + returns ONLY the TransactionKind (no gas coin, no sender). Client reconstructs via `Transaction.fromKind()` so wallet fills gas + sender at sign time (fresh on-chain version). Fixes stale-gas "object unavailable for consumption" on single-SUI-coin wallets. WYSIWYS preserved by re-deriving kind digest from wallet-built bytes and asserting equality. Determinism tested (`gas-agnostic-kind-digest.test.ts`).

### Added
- **Object-ownership classification in dry-run preview.** Dry-run now distinguishes: `you` (sender), `recipient` (user-designated recipient — neutral), `third-party` (unexpected outflow — red ⚠). Pre-sign UI surfaces ONLY real third-party as alarm; intentional transfers to their designated recipient are neutral (not flagged).
- **Wallet-switch state isolation.** On genuine switch (A→B / A→logout→B): conversations cleared + SessionKey reset; contacts cleared synchronously (prevent stale address book); agent stream aborted via AbortController + per-line owner guard (no cross-wallet bleed); autosave wallet-stamped (skip if owner ≠ live wallet). Server keys writes by SIGNER; client wallet-stamp enforces ownership at the source.
- **Pre-sign transaction-flow UI features:** React Flow asset-flow map (portal to body), richer nodes (token icons + address sub-lines), contracts grouped by protocol, tx-digest chevron toggle, readable sign-error messages, reloaded conversations show "re-build" affordance (bytes not persisted, command re-runs for fresh preview).

### Fixed
- **`remember()` bounded + fail-soft.** Was `rememberAndWait` (30-43s block) causing serverless contacts/receipt-pointer writes to timeout. Now bounded (~12s) + fail-soft: dispatch write, stop awaiting after bound, never throw (late rejection caught + logged). Walrus blob authoritative; memwal pointer best-effort.

### Notes
- Tests: 708/708 pass; typecheck clean. Live verified: gas-agnostic signings, cross-wallet conversation isolation, memwal write success on fresh wallets.

## 2026-06-21 — DeepBook full order lifecycle + actionable DeFi positions

### Added
- **DeepBook order management:** full lifecycle from copilot. Four new Guardian-gated write actions:
  - `bm_create` — onboard a new BalanceManager (idempotent; blocks duplicate creates)
  - `bm_deposit` — fund the BalanceManager via transfer
  - `cancel_order` — cancel a resting POST_ONLY order (settled funds return to BM)
  - `withdraw_settled` — withdraw from settled balance (recipient hard-pinned to sender, amount ceilinged by server-recomputed balance, fail-closed on RPC error to prevent duplicate-BM minting)
  - Each action has its own Guardian shape template; a swap or lend smuggled into a cancel/withdraw is rejected.
- **DeFi positions card:** read-only actionable view with per-section fail-soft:
  - Open DeepBook orders (show price/size, Cancel button)
  - Settled BalanceManager balances (Withdraw button)
  - NAVI supplied amount + health factor
  - Suilend deep-link (no fabricated numbers, no on-demand reads)
- **Web:** `/api/prepare-trade` widened to accept the new actions + orderId/poolKey/balanceManagerId; new portfolio UI with inline action buttons (no natural-language round → Guardian → sign).
- **Builders:** `deepbook/order-management.ts` (`buildCancelOrder`, `buildWithdrawSettled`), `deepbook/account-orders.ts` (readSettledBalance, getOpenOrders), `lending-positions.ts` (readNaviLending).
- **Registry:** allowlisted `balance_manager::withdraw` + `balance_manager::withdraw_all`; protocol-registry size now 38 (was 36).

### Notes
- `lend_withdraw` remains gated off (unchanged); Suilend is deep-link only.
- Tests: 708/708 pass (78 files); typecheck clean except 2 pre-existing Aftermath errors (unrelated).
- Live verified: mainnet orderbook lifecycle + position reads + withdraw mechanics.

## 2026-06-20 — user-stats Redis cache + copilot/dashboard consistency + swap/profile fixes

### Added
- **Redis read-through cache for `/api/user-stats`** (`lib/user-stats/stats-cache.ts`,
  `lib/redis-client.ts`). Per-wallet `userstats:<wallet>` (60s TTL). A hit returns instantly and
  identically to every surface, so the dashboard and the copilot profile card can't show different
  levels/badges. The cache mirrors the receipt-derived value (on-chain receipt log = source of
  truth), never client-written. Fail-soft when Redis is absent.

### Fixed
- **Dashboard stuck at an old level/badges after a swap while the copilot showed the new ones.**
  Both surfaces read memwal live (eventually-consistent ~30s + slow), so they disagreed by timing.
  Now they read the same cached value (consistent); the dashboard's post-tx re-polls call
  `?fresh=1` to re-derive from the authoritative source and overwrite the cache, so a confirmed
  swap propagates to both surfaces.
- **Swap sign-card showed the output amount ~1000× off for non-curated tokens** (a 6-decimal
  output rendered 0.04 instead of ~44). The Guardian now resolves real decimals per coin type
  (curated map → on-chain CoinMetadata → 9) and threads a `coinDecimals` map into the preview;
  the card formats with it. Display-only — signed bytes unchanged.
- **Profile "my stats" + self-fetching cards errored on a cold first load.** Added
  `lib/fetch-with-retry.ts` (auto-retry 3×, signal-aware) + a manual Retry button on the profile
  and protocol-registry cards; applied the helper across the swap/lend/protocol cards.

### Known issues
- The **Memory page** still recalls memwal live, so its counts load slowly (~5-15s) and can read
  empty under relayer rate-limit. Caching it is a future improvement.

## 2026-06-20 — Conversation index → Upstash Redis (drop memwal) + encrypted titles

### Changed
- **Conversation list/read/delete was slow + flaky → moved the index to Redis.** Root cause:
  the per-wallet conversation INDEX lived in memwal, a semantic *vector* store (embed-on-write,
  similarity-recall-on-read) with no get-by-key/list, a ~30-43s indexing lag, and a relayer rate
  limit shared app-wide — the wrong tool for an exact key-value index. The index now lives in an
  Upstash Redis HASH `convo:idx:<wallet>` (`HGETALL`/`HSET`/`HDEL`/`DEL`) — exact, no lag, no
  shared limit. Per-conversation CONTENT still lives in an immutable Seal-encrypted Walrus blob
  (unchanged). memwal is no longer on the conversation path; it stays scoped to semantic memory
  (XP/action-log, contacts, profile).
- **No more lag-masking.** Because Redis is read-after-write consistent, the client-side
  localStorage bridges that papered over memwal's lag (`local-index.ts`, `deleted-ids.ts`) were
  retired — a delete is a plain `HDEL` (no resurrection, no tombstones), consistent across reload.

### Added
- **Conversation titles are encrypted client-side** (`titleEnc`, wallet-derived AES-GCM key:
  sign-once → HKDF, cached so only the first session prompts; titles show `🔒 Locked` until then).
  The list read stays OPEN but now exposes only ciphertext titles + Seal-protected blobIds — the
  server stays title-blind, preserving the "server can't read conversations" Seal posture.

### Security
- **Closed a clear-all IDOR.** `DELETE /api/conversations?wallet=…` (clear all) was unauthenticated —
  anyone could wipe a wallet's index by address. It is now session-signature-gated like the other
  writes (recovers the signer → must equal the wallet). All writes (upsert, per-id delete, clear)
  now require wallet control.
- **Atomicity (report-after-HSET):** a save reports "saved" only after the Redis index write
  confirms — Redis is the sole durable index now, so a silent index-write failure (orphan blob,
  expires on Walrus) never shows as success.

### Notes
- New env: `UPSTASH_REDIS_REST_URL`/`TOKEN` (or Vercel's `KV_REST_API_*`); server-only.
- Tests: +`index-kv` / +`title-crypto` specs, conversation-store spec rewritten for Redis; full
  suite 629 green; typecheck clean. Existing conversations don't migrate — Redis starts empty, so
  the old memwal-indexed conversations simply stop appearing (fresh start).

## 2026-06-19 — Fix: conversations dropped the final messages (single-flight save skip)

### Fixed
- **Not all messages in a conversation persisted.** The Seal-enabled `saveCurrent` is slow
  (awaits the write-auth signature + the encrypt), so the 1.5s autosaves overlapped — and the
  single-flight guard *skipped* a save (`if (saving.current) return null`) when one was already
  running, with nothing re-triggering it. The final message batch was never saved, so re-opening
  the thread showed fewer messages than the live chat. Fix: the guard now **queues** the latest
  messages (`pendingSave` ref) and **drains** them after the in-flight save finishes — saves are
  serialized (still no racing encrypts onto the index) but never dropped. A stable `idRef` keeps
  the queued/recursive save on the same conversation (no duplicate convo), synced on
  open/create/remove/clear.

## 2026-06-19 — Copilot: concise text when a tool renders a card

### Fixed
- **The copilot duplicated card data in verbose prose.** e.g. "send 1 SUI to <name>" produced an
  "Action / Recipient / Estimated Gas / Expected Balance Change" text block AND the prepareTrade
  card showing the same fields. Root cause: the persona's `## Format` ("lead-line → preview card →
  confirm") + "show more information, not less" pushed the model to restate everything. Persona now
  instructs: when a tool renders a UI card, write AT MOST one short lead-in sentence (+ optional
  "sealed before you sign — review the card and confirm") and NEVER re-list amounts/addresses/gas/
  balance/APYs in prose — the card shows them. Fuller replies only for cardless conversational turns
  (greetings, "what can you do?", general questions, Guardian-block explanations).

## 2026-06-19 — Fix: swap preview wiped mid-flow by auto-open race (Seal save)

### Fixed
- **The tx-preview card vanished mid-swap and couldn't be re-submitted.** Root cause: the
  Seal-enabled autosave became slow (it `await`s the write-auth wallet signature + the encrypt),
  so the first `saveCurrent` could capture a stale message snapshot, then `setActiveId` + `setList`
  flipped the list non-empty WHILE the user was mid-swap. That triggered the **auto-open effect**,
  which reloaded the stale snapshot over the live thread — wiping the just-added `tx-preview` (also
  dropped on persist by the serializer). Fix: auto-open now only fires on the **initial blank
  landing** — an `interacted` ref (set synchronously in `saveCurrent`/`open`/`create`, before the
  slow awaits) makes it skip once the user has composed or opened anything, so it can never clobber
  a live thread. No UI freeze needed.

## 2026-06-19 — Copilot text replies fixed + markdown rendering

### Fixed
- **The copilot showed nothing for plain-text replies** (e.g. "Hello" → no text, no UI).
  Pre-existing bug, unrelated to Seal: the `/api/agent` stream parser read `payload.textDelta`,
  but Mastra 1.42 (AI SDK v5) carries the delta in **`payload.text`** (`textDelta` was removed —
  it appears 0× in the installed Mastra). Every text delta was silently dropped while tool-result
  *cards* still rendered, so DeFi commands looked fine but conversational replies were invisible.
  Now reads `payload.text ?? payload.textDelta` (both shapes). Verified live: "Hello" now streams text.

### Added
- **Assistant replies render as streaming markdown** via the `streamdown` `<Streamdown>` component
  (handles incomplete markdown mid-stream) instead of plain text.

## 2026-06-19 — Seal client-side encryption for conversations

### Added
- **Conversation content is now end-to-end encrypted with [Seal](https://seal-docs.wal.app)**
  (`@mysten/seal` 1.2.0) — stored as ciphertext on Walrus, decryptable **only by the owner's
  wallet**. The Dewlock server stores `enc` opaquely and can no longer read chat content.
  - **On-chain policy:** `dewlock_seal::seal_approve(id, ctx)` aborts unless `id == bcs(sender)`
    (account-based). Published mainnet `0x77aa928f…` + testnet `0x15622655…`.
  - **Client lib** (`apps/web/lib/seal/`): owns a dedicated Sui client pinned to the **Seal network**
    (`NEXT_PUBLIC_SEAL_NETWORK`, default **testnet**) — independent of the mainnet DeFi client. Seal
    runs on testnet because the verified mainnet committee key server is permissioned (needs an API
    key); the testnet Mysten servers are open + free, and since addresses are network-agnostic and
    `seal_approve` is pure address equality, a mainnet wallet's conversations encrypt correctly there.
    `SessionKey` manager (one wallet signature per session, reused), `encryptConversation`/
    `decryptConversation` with a `dseal1:` magic tag. Identity = `normalizeSuiAddress(owner)` hex so it
    matches the Move `bcs::to_bytes(&sender)` — **proven by a live testnet round-trip**
    (`apps/web/lib/seal/__tests__/live-roundtrip-check.mjs`: encrypt→SessionKey→seal_approve→decrypt
    recovers the bytes). Mainnet encrypt also works; mainnet decrypt is gated on the committee API key.
  - **Save:** `saveCurrent` encrypts before POST; **kill-switch** (`NEXT_PUBLIC_SEAL_ENABLED`) +
    fallback to plaintext if Seal is unusable, so history is never bricked (Decision 3).
  - **Open:** lazy decrypt — the newest thread auto-opens as a `🔒 Sign to view` **locked preview**;
    the SessionKey signature fires only on an explicit click (so the list still loads with no
    signature). A rejected signature shows a distinct `decryptError`, never a blank "lost" thread.
  - **Write-auth gate:** conversation POST/DELETE now require a session-cached wallet signature
    (`dewlock-conversation-auth`), mirroring contacts — so only the wallet owner can write its
    conversations (closes the unauthenticated-write / blob-poisoning hole; one prompt/session, not
    per-autosave).
- Legacy plaintext threads still open with **no signature** (auto-detected via the tag). Old
  plaintext is dropped via the existing clear-all (Walrus blobs are immutable → un-referenced).

### Notes
- **Title stays server-readable by design** (Decision 2): the index keeps the plaintext title so the
  sidebar/enumeration stay instant — so the index still reveals {address, timeline, opening line}.
  Not marketed as fully private.
- **Server still accepts a plaintext fallback write** (red-team #7 not strictly rejected): it conflicts
  with the Decision-3 kill-switch, and the real downgrade/poisoning threat is already closed by the
  write-auth gate (only the owner can write at all). A strict reject would only risk silent save
  failures on a key-server hiccup — worse for the demo than the owner's-own-data fallback.
- 18 red-team findings applied during planning; the SDK API was pinned to the installed 1.2.0
  (`getAllowlistedKeyServers` is gone → explicit `serverConfigs`; `SuiJsonRpcClient`).

## 2026-06-19 — Conversation delete hardened against memwal indexing lag

### Changed
- **Delete now survives the index's ~30-43s eventual-consistency window** (a quick reload
  could resurrect a just-deleted thread). Two-part fix:
  - **Server delete tombstone:** `removeConversation` writes a per-conversation
    `conversation-deleted: <id> @ <ts>` marker (cheap, non-blocking) AND prunes the index
    blob. `readIndex` filters any id whose tombstone is newer than that conversation's
    `updatedAt`. The tombstone is race-insurance — if a concurrent save's index rewrite
    clobbers the prune, the delete still sticks. Because every `writeIndex` persists the
    tombstone-filtered list, the index self-heals, so a tombstone only needs to outlive
    recall until the next index write (keeps recall pressure low despite memwal's cap). A
    genuine later re-save (newer `updatedAt`) out-dates the tombstone and reappears.
  - **Client soft-delete filter:** a tiny per-wallet `deletedIds` set in localStorage hides
    just-deleted threads on reload until the server stops returning them (then self-cleans).
    This is a UI hint only — the conversation data still lives solely in Walrus. Cleared on
    clear-all.

## 2026-06-19 — Conversation saves no longer time out (root cause: blocking memwal write)

### Fixed
- **Conversations weren't persisting at all** — `POST /api/conversations` hit
  `FUNCTION_INVOCATION_TIMEOUT` (HTTP 504 at ~60s, verified live). The save published the
  conversation blob + the index blob to Walrus (each ≤10s) and then wrote the index pointer
  via `remember` → `rememberAndWait`, which **blocks ~30-43s** for memwal indexing — the sum
  exceeded the 60s serverless limit, so the function was killed and nothing saved. Switch the
  pointer + clear-tombstone writes to the **queued, non-blocking `rememberBulk`** (the same
  fix already applied to the XP/badges hot path): the save now finishes in ≤~30s. The durable
  data is the Walrus blob (still awaited); the index pointer is allowed to lag. Client-side,
  `saveCurrent` optimistically prepends the saved conversation to the sidebar (it already has
  the durable `blobId`) instead of a post-save `refresh()` that would read the not-yet-indexed
  index and momentarily drop the row — so the thread appears instantly and stays.



### Changed
- **Promoted 12 verified tokens to swappable** (were recognition-only/display): liquid-staking
  SUI (haSUI, afSUI, vSUI), DeFi governance + stables (SCA, NAVX, BUCK, AUSD, SEND, TURBOS),
  and the major memes (**FUD, BLUB, LOFI**). Each added to the Guardian allowlist (`COIN_TYPES`)
  + `COIN_DECIMALS` + the CoinGecko price oracle (`idMap`), and `swappable:true` in the registry.
  Promotion gate (verified per token, not hand-trusted): (1) a live Cetus-aggregator route to
  USDC exists, and (2) a CoinGecko USD feed returns a price that **matches the route's implied
  price** — so the value cap reads real market value and can't be blinded by an under-valued or
  wrong-id feed (caught LOFI: the bare `lofi` id is a different chain's token, 424× off — the
  Sui token is `lofi-2`). The Guardian still fail-closes on any of these if its feed goes
  stale/missing at sign time, and the per-tx USD cap is unchanged.



## 2026-06-19 — Copilot composer: recipient badge, @mention friends, single-action guard, welcome cards

### Added
- **Live recipient badge** below the composer chips — as the user types a send command, the
  recipient (`0x` address, `.sui` name, `@friend`, or a saved-contact name) is resolved client-side
  and previewed as a colored badge: violet = saved friend, green = SuiNS resolved, neutral = valid 0x
  (reverse-resolved to a `.sui` name when one exists), amber = resolving/typing, red = not found.
  **Display-only — never gates Send**; the Guardian still re-resolves server-side at sign time.
- **@mention friends menu** — typing `@` opens a friends context-menu (↑/↓/Enter/Tab/Esc). Selecting
  inserts `@Name`; on submit each `@Name` is rewritten to the bare contact name so the existing
  deterministic resolver + Guardian path handle the send unchanged (no new send path). Multi-word
  names supported via longest-match.
- **Empty-thread welcome cards** — 4 default action cards (Swap/Sell, Send, Lending, View Portfolio)
  that submit the matching intent via the existing path, plus a supported-protocols card sourced from
  `/api/protocols` (`active + built`) with brand logos (`/public/logos/<id>.svg`, `<img>`-first with
  an inline-SVG/monogram fallback). `ProtocolLogo` now renders the image asset first.

### Changed
- **Single-action guard** — the agent route now refuses a message bundling 2+ distinct value actions
  ("send … and swap …") *before* the LLM, streaming guidance to do one action per message and calling
  no value tool. Deterministic `detectMultiAction` (clause-aware: a recipient name that happens to be
  a verb keyword, e.g. a contact named "Lend", is not miscounted). Persona backs it up. Composite
  multi-action-in-one-PTB is intentionally out of scope (the Guardian's PTB-shape gate fail-closes on
  composite PTBs) — deferred to a separate plan.

## 2026-06-19 — Clear-all reliability + verified token registry expansion

### Fixed
- **"Clear all conversations" now sticks** (was repeatedly "fixed" but kept reappearing).
  Root cause: memwal is append-only with capped, semantic recall, so the clear tombstone
  could fall outside the recalled set and a stale index pointer would win — the cleared
  list came back. `clearConversations` now writes BOTH an empty index blob (the newest
  pointer resolves to an empty list) AND the tombstone; `readIndex` returns empty if either
  wins. Client-side, `clearAll` also drops the in-memory thread cache + created-at stamps so
  nothing can resurrect a cleared thread within the session. (Conversations live in Walrus,
  not localStorage — there is no browser-storage copy to clear.) Regression test simulates
  the dropped-tombstone failure.

### Added
- **Verified token registry expansion** — on-chain CoinMetadata-verified logos for
  DEEP/WETH/WBTC/WAL/NS/BLUE, plus 13 new recognition-only entries (haSUI, afSUI, vSUI, SCA,
  NAVX, BUCK, AUSD, SEND, TURBOS, and memes FUD/BLUB/LOFI). Every coin type confirmed via
  CoinMetadata (symbol + decimals matched — scam-clone defense); every logo URL HTTP-200
  verified. Recognition-only entries are `swappable:false` (NOT in the Guardian allowlist):
  the portfolio shows their logo and the copilot recognises them by symbol, while any value
  move still fail-closes at the Guardian. The deterministic intent parser now resolves these
  to a `swappable:false` swap intent (the directive layer explains "not swappable yet"
  instead of the LLM guessing an address). Symbol matching is case-insensitive, so the
  canonical mixed-case staking tickers (haSUI/afSUI/vSUI) are preserved.

## 2026-06-19 — Suilend lend-deposit + multi-hop swap fixes

### Fixed
- **Suilend deposit enabled** (was the last failing DeFi action). The long-blamed "gRPC
  reserve-shape incompatibility" was a misdiagnosis: `SuiGrpcClient` reads `baseUrl`, not
  `url`, so the transport base was undefined → every gRPC call crashed and the lending-market
  reserves parsed with `coinType.name` undefined. Pass `baseUrl` (SUI_GRPC_URL). Also bumped
  `SUILEND_PACKAGE` to the SDK's current upgrade `0xe53906c2…` and allowlisted the SUI-deposit
  `lending_market::rebalance_staker` (value-neutral liquid-staking accounting). All four lend/
  swap SDKs (Cetus, Aftermath, NAVI, Suilend) now build live.
- **Larger / multi-hop Aftermath swaps** (e.g. 2 SUI → USDC) were refused on
  `0x2::balance::join` — a multi-leg route merges per-leg output balances with it. Allowlist
  `balance::join` / `balance::split` / `coin::into_balance` as value-neutral framework calls
  (the dry-run net-outflow cap remains the value bound).

### Added
- Conversations: on load, auto-open the user's most-recent thread (once per wallet).

## 2026-06-18 — Mainnet contract + Vercel production deploy

### Added
- **Live production: https://dewlock.vercel.app** — deployed via Vercel CLI (team `itab-projects`, GitHub-connected). Public, mainnet, live + small caps (`TX_USD_CAP=50`).
- **`dewlock_receipt` published to Sui mainnet** — package `0x8c3b42b4…612361`, shared `Config` (v1) `0xa8ece854…672a2c`; AdminCap/UpgradeCap on the deployer. `Published.toml` committed.
- **Aftermath Router as a 2nd swap source** — swap form shows Cetus-aggregator + Aftermath quotes side by side and routes the chosen source through the Guardian (re-derives min-out per source).
- **Dashboard portfolio falls back to the official Sui JSON-RPC** when the BlockVision indexer is unavailable — no Blockberry needed; non-SUI coins priced via the CoinGecko oracle.
- **Copilot-layer tests** — system-prompt guardrails + tool-routing wiring (complements the 16 runtime guardian tests).

### Changed
- **Price oracle: Pyth Hermes → CoinGecko** (`price-oracle.ts`) — keyless, covers all priced coins incl. the Sui-ecosystem tokens; optional free Demo key. `max(price, floor)` cap-safety unchanged.
- **`SUI_RPC_URL` → public fullnode** for the deploy — BlockVision free tier's per-second burst cap tripped a 429 on prepare-trade's rapid RPC calls.

### Fixed
- **ESM-only SDKs failed in the Vercel serverless function** ("Cannot find package": Aftermath swaps + ALL lend deposits) — pnpm symlinks are stripped and a dynamic `esmImport` is invisible to the tracer. Fix: esbuild-**prebundle each SDK to a self-contained CJS file** (`packages/sui/sdk-bundles/*.cjs`) and load via a **static relative `require`** so Next's tracer ships it. Cetus + Aftermath swaps + NAVI lend-deposit verified live.
- **Aftermath swap built invalid bytes** — used `tx.serialize()` (JSON) instead of `tx.build({client})` (BCS) → Guardian ULEB decode error. Now builds canonical BCS.
- Deploy plumbing: Next.js version detection (root `next` devDep), `maxDuration` via segment config, function packaging (no `.pnpm/**` symlink globs), Deployment-Protection 401 disabled, env matrix set.

### Notes
- **Suilend deposit** was parked here on an apparent gRPC reserve-shape mismatch — resolved the next day (see the 2026-06-19 entry); the real cause was a SuiGrpcClient `url`/`baseUrl` config bug, not a shape incompatibility.

## 2026-06-18 — Reliability, UX, memory & passport

### Fixed
- **Swap "sell all USDC"** blocked by exact-package gate → swap-route calls now matched by `module::function` signature (handles dynamic aggregator integration packages + the `coin::destroy_zero` full-balance cleanup). Value gates unchanged.
- **SUI portfolio price** showed a stale $3 floor → now the live Cetus-aggregator quote (~$0.79) on the RPC fallback path.
- **Receipt blob / Sui object never saved** → the post-action pipeline crashed on a nonexistent `workflow.createRunAsync()`; fixed to `await createRun()`+`run.start()`. Also surfaced the Walrus Blob `objectId` as the receipt's Sui object (no custom anchor deploy needed), and raised the Walrus publish budget to 32s (mainnet is slow).
- **"No saved preferences" memory chip** → the committed cap was never written; now seeded + the recall route falls back to the env cap (validates the `risk cap:` shape).
- **memwal XP/badges not updating** → switched hot-path writes to `rememberBulk` (queued) instead of `rememberAndWait` (~30-43s indexing block).
- **SuiNS send** (`send … .sui`) crashed (`SuinsClient is not a constructor`) → native JSON-RPC resolution; bare names auto-resolve; unregistered → clear block.
- **"sell SUI" produced nothing** → missing-arg swap/send/lend now render an interactive form (`requestActionForm`) instead of a dead-end prose ask.
- **Conversation clear/delete laggy / "doesn't delete"** → optimistic UI (instant local update + background sync + rollback); delete uses a recycle-bin icon.
- **Cap defaults** in `.env.example` were `$5/$20` (blocked everything) → raised; documented.

### Added
- **SSE receipt progress dialog** — streams the publish→memwal→profile→anchor steps live (`/api/receipt/stream` + `use-receipt-stream` + `receipt-progress-dialog`).
- **Memory page** (`/app` → Memory) — global + user memory categories with approximate counts + samples + signature-gated clear (honest clearability; activity/level permanent).
- **Dewlock Passport** — per-user identity (level/XP/badges/counts/member-since) as a public Walrus blob + memwal pointer + optional on-chain HEAD; Passport card atop My Dashboard with proof links + share. Cap/risk kept private; built out-of-band + diff-gated.
- **Interactive action-form cards** for amount/recipient/protocol entry.
- **Friend address book + copilot name-resolution** — save friends (name → 0x) in a per-wallet Walrus blob + memwal pointer (clearable; the old append-only `contact:` lines are no longer written). "send 1 SUI to Thomas" resolves the name **deterministically server-side** (the LLM never supplies a 0x): 1 match → send card, 2+ → a contact-picker card, 0 → SuiNS. Managed from a "Friend list" dialog in the chat header and a friend card on a redesigned two-column My Dashboard. All writes are **payload-bound wallet-signature** gated (`dewlock-contacts:<op>:<wallet>:<ts>:<sha256(op,name,address)>`) to stop body-swap replay; names are sanitized before prompt injection; the client passes its freshest book to `/api/agent` so a just-added/deleted friend resolves without memwal indexing lag.

### Notes
- Docs restructured: this `project-changelog.md` + `system-architecture.md` supersede the prior numbered `01-…10-` docs.
- `[needs live-env]`: deploy `move/dewlock_receipt` + set `DEWLOCK_RECEIPT_PACKAGE_ID` (+ fund the operational key) to anchor passport/receipt HEADs on-chain; until then they degrade to blob-only (honest label).
