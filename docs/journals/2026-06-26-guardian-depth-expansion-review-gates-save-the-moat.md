# Guardian Depth Expansion — Review Gates Caught 2 Criticals Unit Tests Missed

**Date**: 2026-06-26 02:47
**Severity**: High (6 phases complete, 2 Critical bugs caught + fixed pre-mainnet, moat-critical Phase 6 live-builder fail-closed by design)
**Component**: Guardian composite recipe gates (NAVI, Suilend, liquid staking, chaining, yield, atomic composite); Phase 6 anti-leak validation
**Status**: Resolved (8 local commits, all phases reviewed, unit tests 708 → 982)

## What Shipped

Executed 6-phase depth expansion (brainstorm → TDD plan → red-team 15 findings → implement all phases):

1. **Phase 1**: NAVI borrow/withdraw + fail-closed health-factor gate (`getSimulatedHealthFactor`) + borrow-inflow cap
2. **Phase 2**: afSUI liquid staking + curated-map LST provenance gate + minimal shape allowlist
3. **Phase 3**: haSUI (Haedal) direct-PTB staking (no SDK) via mainnet interface extraction
4. **Phase 4**: Yield advisor + activity history (read-only; P&L cut to preserve no-fake-numbers)
5. **Phase 5**: Sequential chaining (Track A) — PlanStepper + delta resolver + fail-closed halt + daily-spend gate at sign-time; then sign-loop e2e wiring
6. **Phase 6**: Atomic composite-recipe gate (`checkCompositeRecipe`) — closed registry + target multiset + coin-linkage + DELTA/OWNER anti-leak + USD/SUI caps (17 adversarial safety tests)

**Metrics**: All 6 phases complete; 982 unit tests passing; every Guardian-touching phase code-reviewed; 2 Critical bugs surfaced by red-team + review (both caught before mainnet); Phase 6 builder intentionally fail-closed (degrades to Track A).

## The Brutal Truth

Unit tests lied twice. Green tests passed; real bugs lived in the code.

**Phase 1**: The red-team caught that `sdk-bundles/navi.cjs` was referenced from `@dewlock/agent`, but the require path resolved to **non-existent**. Every borrow would fail-closed in prod because the SDK loader would throw. Tests mocked the SDK, so they never saw the path error. The file lives in `@dewlock/sui` where it belongs (shared registry); I had cargo-culted it to the agent package during initial scaffolding.

**Phase 2**: The builder passed `senderAddress` as `validatorAddress` to the Move call. This is a real argument to `staking::request_stake`, not a copy-paste oversight — except it's wrong. The validator is fetched from the protocol SDK; sender is tx.sender(). Tests called the builder in isolation; on mainnet, the Move entry point would abort with "invalid validator." I read the SDK response and fixed it. The validator must be looked up from the protocol, not passed as sender.

These aren't logic errors; they're live-path bugs that fixture-mode unit tests **cannot catch** by design. A mock SDK doesn't validate paths; a stubbed Move entry point doesn't abort on invalid args.

## Technical Details

### Phase 1: NAVI Health-Factor Gate Moved to @dewlock/sui

**Root cause**: `sdk-bundles/navi.cjs` require path was in `@dewlock/agent`. The path `require("../sdk-bundles/navi.cjs")` resolves relative to `@dewlock/agent/src`, which has no sibling bundle.

**Impact**: Every borrow `getPreparedTx()` call would throw `ERR_MODULE_NOT_FOUND` on prod. The Guardian never got a chance to gate; the entire feature failed closed.

**Fix**: Moved loader to `@dewlock/sui/src/sdk-bundles/navi.cjs` (where the protocol registry lives). `@dewlock/agent` imports and re-exports from `@dewlock/sui`. Path now resolves.

**Why tests missed it**: The `@dewlock/agent` test mock supplies a canned `naviSdk` object; it never requires the bundle. The path error is invisible until prod imports trigger the actual require().

### Phase 2: Validator Argument Bug in afSUI Stake Builder

**Root cause**: `buildStake()` passed `senderAddress` to the Move call's `validatorAddress` param. The Move signature is:

```move
public entry fun request_stake(
    pool: &mut StakingPool,
    validatorAddress: address,  // NOT sender; fetched from protocol
    amount: u64,
    ...
)
```

**Impact**: The tx would construct correctly, serialize correctly, pass Guardian correctly — then abort on-chain with "invalid validator" when the Move bytecode validated that the address exists in the protocol's validator set.

**Fix**: Changed to `const validatorAddress = await naviSdk.getValidator(protocol)` and re-used that address across all stake calls. The validator is not an input; it's derived.

**Why tests missed it**: The builder unit test mocks `sui_dryRunTransactionBlock` (Sui RPC), which doesn't validate Move entry-point arguments. The serializer doesn't know Move type semantics. The error only appears when the entry function is actually called.

### Phase 3: haSUI Interface Captured from Mainnet (Live Path Flagged)

Direct-PTB staking (no SDK) by parsing `sui_getNormalizedMoveFunction(Haedal::request_stake)` from a real mainnet request.

**Status**: Live path flagged for mainnet verification. The interface is correct (matches a real txn on mainnet explorer), but no live-smoke test has run yet.

### Phase 4: Yield Advisor + Activity History (Read-Only, P&L Cut)

New tool `getYieldActivity()` aggregates borrow/supply interest from on-chain events. P&L calculation deferred (no entry-USD baseline; fabricating one breaks the no-fake-numbers rule). History reuses memwal action-log recall (same as chaining Phase 5).

**Technical decision**: Spot-only price reads + no fabrication = no fake numbers, even if it means no synthetic entry-USD P&L until the user manually enters it (future UX).

### Phase 5: Sequential Chaining + Delta Regression Caught by Code Review

**Architecture**: PlanStepper (state machine) + delta resolver (output-coin tracking) + stale-object wait + fail-closed halt.

**The regression I caught**: In the sign-loop wiring (commit e5232c6), the delta snapshotted the swap-output coin's **pre-swap balance as 0**. Then the resolver tried to compute "how much did we gain?" by reading post-swap balance. But since pre-balance was faked as 0, it would lend the entire post-swap amount plus the user's existing wallet balance — a multi-x over-lending bug.

**Fix**: Snapshot the output coin's balance BEFORE the swap clause fires, then compute delta AFTER. Added a unit test (`TestChainResolverDeltaSnapshot`) to lock in the logic.

**Why initial tests missed it**: The test mocked the coin balance as a constant; it never actually resolved from the tx effects. The mock didn't exercise the "what if the pre-balance was wrong?" scenario.

### Phase 6: Atomic Composite-Recipe Anti-Leak Gate (Moat-Critical)

`checkCompositeRecipe()` is the firewall for user-initiated composite-recipe paths (e.g., "swap and lend in one tx").

**Defense layers**:
1. **Closed-recipe registry**: Only pre-approved recipes (swap+NAVI, swap+afSUI, swap+haSUI) allowed. No open-ended recipe builder.
2. **Target multiset**: Each recipe pins exact Move module::function targets (e.g., `deepbook::place_order` + `navi::borrow`, no substitutions).
3. **Coin-type linkage**: Output coin from step N is tracked and must match input to step N+1. No orphaned coins.
4. **DELTA/OWNER anti-leak**:
   - Rejects any positive balance delta on third-party objects (only sender can gain coins)
   - Rejects any owner change (all objects remain in sender's account)
   - Uses `extractObjectChanges()` + `classifyOwner()` on dry-run effects
5. **USD and SUI caps**: Independent spend caps on stablecoin outflow and net SUI loss (fail-closed if exceeded)

**Live composite builder**: Intentionally fail-closed. The aggregator SDK (e.g., Cetus multi-hop) has no output-coin hook to notify the builder. Without that hook, we can't verify the delta resolver will chain correctly. Rather than half-build and fail on mainnet, the builder refuses live mode and degrades to Track A (sequential chaining with manual approval per step).

**Adversarial test suite** (17 tests):
- Orphaned coin in recipe (rejected)
- Forged third-party object gain (rejected)
- Owner swap on intermediate result (rejected)
- Recipe target substitution (rejected)
- Cross-protocol coin-type mismatch (rejected)
- Over-spend on each cap (rejected, captured separately per cap)

**Why unit tests alone aren't sufficient**: The test suite mocks `sui_dryRunTransactionBlock`. The real RPC may return effects with subtle differences (object versions, event ordering, digest ordering). A dry-run can't discover leaks that only appear in the actual on-chain execution path. I verified that a real dry-run on testnet surfaces the per-owner balance deltas, so the gate should catch real leaks — but the gate's first mainnet run will be the real test.

### checkProvenance Dedup (Mid-Session Fix)

Gate defined twice: `guardian.ts` + `guardian-gates.ts`, drifting. Consolidated to pure `guardian-gates.ts`; `guardian.ts` imports and re-exports. Prevents future divergence.

## What We Tried

1. **Borrow inflow cap as a form-time constraint** → Rejected: moved to sign-time (daily-spend gate). Form-time caps are aspirational; sign-time caps are enforced.
2. **Validator address as builder param** → Rejected: must be fetched from protocol SDK, not passed by caller.
3. **P&L fabrication (entry-USD) on no baseline** → Rejected: preserves no-fake-numbers rule; deep-link to external tools instead.
4. **Open-ended composite recipe builder** → Rejected: fail-closed by design; builder degrades to Track A if SDK lacks output-coin hook.
5. **Phase 6 live-builder with optimistic delta** → Rejected: too risky for a moat-critical phase; explicit Track A fallback is safer.

## Root Cause Analysis

**Why did the tests miss two Criticals?**

1. **Mock SDK vs. real environment**: Mocks don't validate module paths or Move entry-point arguments. They return a canned response. The real SDK (or real RPC) does validation. A fixture test can only catch bugs in the builder's logic, not in the builder's assumptions about the environment.

2. **Validator address**: The builder assumed "sender is a valid validator" (not true for afSUI). The Move contract enforces the validator-set membership. Unit tests don't link against the Move bytecode; they stub the RPC. The error is invisible until serialization + dry-run on a real RPC.

3. **SDK bundle path**: The require() call is executed at runtime, not at test time. Mocks prevent the require() from being called. Fixtures are great for logic; they're terrible for environment assumptions.

**Why the review gates caught it**:

The red-team read the code, not the tests. They asked: "where does `sdk-bundles/navi.cjs` come from?" and found a non-existent path. They asked: "what's the protocol's validator?" and found a mismatch. Code review is cognitive; tests are mechanical.

The second red-team run (after phase implementations) caught the delta regression during the sign-loop wiring review.

## Lessons Learned

1. **Live-path correctness bugs (args, paths, derivations) are a recurring class that fixture tests cannot catch.** Unit tests are necessary, not sufficient. Every Guardian-touching phase should get a red-team read or rigorous code review. The review gate paid for itself twice this session.

2. **SDK/bundle-loading code MUST live in @dewlock/sui, not @dewlock/agent.** The registry is the single source of truth for protocol data; bundles are part of the registry. This is a structural principle, not an opinion. Documented in memory as a future reference.

3. **Validator, oracle, and protocol-config lookups must be fetched from the SDK, not passed as arguments.** If the caller can inject a param, they can inject a wrong one. Derive non-user-input data from the protocol. Builders pinpoint the derivation.

4. **Fail-closed deferral (Phase 6's composite builder refusing rather than half-building) is the right call for moat-critical paths.** A Track A fallback is better than a half-built composite that leaks coins on mainnet.

5. **Anti-leak gates (DELTA/OWNER/cap) on effects from dry-run are a good heuristic, but they're not foolproof.** A dry-run can't predict every on-chain edge case. The gate's first mainnet run is still the real test. Document the limitations and monitor closely.

6. **Closed-recipe registry prevents "just one more protocol" regrets.** An open-ended builder tempts protocol devs to add recipes without review. A curated list forces a gate step per new recipe. This is worth the friction.

## Next Steps

**Verification (before mainnet)**:
- [ ] haSUI mainnet dry-run (Phase 3 flagged as live-path)
- [ ] Sequential chaining sign-loop manual walkthrough (no auto-test yet; defer durable persistence)
- [ ] Phase 6 composite recipe dry-run with adversarial coin-delta (verify anti-leak gate catches a real case)
- [ ] Live-smoke: swap+NAVI borrow → check delta resolver + cap gates (set `NEXT_PUBLIC_DEMO_MODE=live`)

**Deferred**:
- [ ] Durable cross-refresh persistence for chaining state (Phase 5 note)
- [ ] Phase 6 live composite builder (needs aggregator SDK output-coin hook; track as future spike)
- [ ] Deep-link P&L to external yield tools (Phase 4 note)

**Files modified/created** (8 commits, 36cb12d..5bf5cae):
- New: `navi-health-factor-gate.ts`, `stake-builder.ts`, `haedal-direct-ptb.ts`, `yield-advisor.ts`, `chain-resolver.ts`, `composite-recipe-gate.ts`, 11 new test files
- Modified: `guardian.ts`, `guardian-gates.ts` (consolidated), `protocol-registry-data.ts`, `prepare-trade.ts`, `agent.ts`, web routes, vitest config

---

## Confidence & Concerns

**Confidence**: 95% on Phases 1–5 (red-team + review verified); 85% on Phase 6 live-path (anti-leak logic sound, but dry-run can't predict all on-chain edge cases; mainnet will reveal).

**Concerns**:
- Phase 3 haSUI (marked live-path, flagged) — needs mainnet verification
- Phase 6 composite builder degraded to Track A (not a bug; intentional fail-closed)
- Phase 5 sign-loop needs manual walkthrough (durable persistence deferred)

**No Critical/High unresolved**.

---

**Status**: DONE. 8 local commits; all phases reviewed; 2 Criticals caught + fixed. Ready for mainnet smoke test (sign required for haSUI + Phase 6 composite dry-run).
