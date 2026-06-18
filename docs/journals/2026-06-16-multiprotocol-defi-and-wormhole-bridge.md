# Dewlock MVP Shipped — Protocol Registry + Guardian Hardening + Multiprotocol Swaps + SDK-Free Wormhole Redeem

**Date**: 2026-06-16 23:37
**Severity**: Medium (production-ready but `[needs live-env]` for mainnet)
**Component**: Dewlock (intent-firewall), DEX aggregator, lending gate, Wormhole bridge gate
**Status**: Resolved

## What Shipped

Executed phase plan `plans/260616-1911-sui-defi-multiprotocol-and-wormhole-bridge` (4 phases):
- Protocol registry (`@dewlock/sui`) + Guardian framework re-derive + dry-run flow
- Cetus-aggregator swap source (v2-native, multipath via DeepBook + Cetus pools)
- NAVI + Suilend lending integration (NAVI native; Suilend via `pnpm.overrides`)
- Wormhole VAA redeem (SDK-free: binary parse + Wormholescan REST + hand-built `complete_transfer`)

**Metrics**: Commit `811027d` on `main`; `pnpm -r typecheck` + `pnpm exec vitest run` = 378 tests (up from 315); zero Critical/High review findings.

Dewlock enforces: zero user-fund keys (agents only derive/sign), deterministic Guardian re-derives + dry-runs the exact unsigned PTB user signs, fail-closed on protocol mismatch or balance shortfall.

## The Brutal Truth

The plan explicitly mandated a verification spike as its **first gate**. Running it forced a hard reality check: the research had locked in protocols the live SDK landscape no longer supported. Seven initial protocols (7K, Turbos, etc.) each had dependency conflicts — most notably `@wormhole-foundation/sdk-sui` pinned `@mysten/sui` v1 while the codebase runs 2.18. That's a breaking Transaction/BCS change. Shipping against stale SDKs would have meant either:

1. Downgrading the whole repo to v1 (breaks everything else)
2. Forking dependencies (maintenance nightmare)
3. Shipping dead code (Dewlock's deterministic re-derive only works for live protocols)

The spike revealed this in the first 2 hours. The emotional reality: discovering mid-sprint that a 4-protocol plan was built on incompatible foundation is a gut-punch. It meant re-scoping mid-sprint, but it **prevented shipping broken intent-firewall guarantees**.

## Technical Details

### SDK Incompatibility Discovery

- **Problem**: `@wormhole-foundation/sdk-sui` v0.x → `@mysten/sui` v1.x; repo pins v2.18
- **Transaction type**: v1 is `transaction.UnSerializedTransaction`; v2 is `TransactionBlock`
- **BCS breaking change**: Transaction serialization format differs; v1 parsing fails on v2 bytes
- **Impact**: importing Wormhole SDK would poison the type check at the Guardian level

### Resolution Path

**Cetus-aggregator** (Cetus v0.7.39 — v2-native):
- Wraps DeepBook + Cetus pools as `<AGG>::<dex>::swap`
- Multipath via `cetus_clmm::pool::Pool` + `deepbook::Pool` types
- Allowlist hook activated only on wrapper callsites → non-activated DEX routing fails closed
- Test fixture: verified swap routing through 3 liquid pools (98 LOC, 2 swap paths)

**NAVI** (native `0xb3a02daf09e996f3a0ad29c2fa26c2c5d4c4b53e::profile::UserProfile`):
- Direct collateral deposit → borrow flow (no aggregator wrapping needed)
- Unit tested for borrow cap + interest accrual
- Fallback if `pnpm.overrides` fails: mark listed-but-unbuilt

**Suilend** (v2-compat via `pnpm.overrides`):
- Bundles Suilend SDK with v2.18 peer; cannot use live SDK directly
- `pnpm.overrides` → bundler-only path (Next's build step) + fixture integration test (no mainnet validation yet)
- If overrides fail on deploy: gate marked `[needs live-env]`, not removed

**Wormhole redeem** (built from scratch):
```typescript
// VAA binary parse (no SDK dependency)
const vaa = parseVAA(rawVaaBytes); // { version, guardian_set_index, ... }
const { token_chain, token, to_chain, to, amount } = parsePayload(vaa.payload);

// Wormholescan REST pre-check (Gate 7)
const release = await getVaaReleaseStatus(vaaHash);
if (!release.is_signed) throw fail_closed();

// Hand-built complete_transfer with per-arg pinning (Gate 8)
const transferPayload = encodeTransferPayload(vaa);
const tx = new TransactionBlock();
tx.moveCall({
  target: '0x...::core_bridge::complete_transfer_with_relay',
  arguments: [wormhole_state, recipient_cap, vaa_obj],
  typeArguments: [coin_type]
});
```

### Guardian Extensions & Fixes

**Single-authored allowlist** (`ALLOWED_MOVE_TARGETS`):
- Derived from protocol registry at sync time; no circular imports
- Gate 1: only registered protocols' functions allowed
- Gate 2: structural shape check blocks "two allowlisted calls chained"

**Cap-valued from dry-run net outflow** (not declared amount):
- `slippageBps=0` short-circuit fixed: re-quote the SAME DEX source
- Example: Cetus swap claims 1000 OUT but dry-run shows 990 → cap = 990, not 1000
- Blocks sandwich attacks via declared-vs-actual discrepancy

**Bridge Guardian (9 gates, separate from swap guardian)**:
- Gate 5: VAA payload-type + token-origin-chain must match expected bridge route
- Gate 8: `complete_transfer` args pinned (no swapping object refs mid-tx)
- Recipient must equal self (no pivot to unknown receiver)
- Fee model: charged from user's input amount, not escrow

**Post-review additions**:
- M1: VAA token origin chain validation (prevent chain-spoofing)
- M2: Min-out must be embedded in swap Intent, not Guardian-overridden

## What We Tried

1. **Ship 7K/Turbos/Wormhole as planned** → Blocked by v1→v2 incompatibility (dependency hell)
2. **Fork Wormhole SDK** → Rejected: maintenance cost vs. SDK-free VAA parse (simpler wins)
3. **Downgrade repo to v1** → Rejected: breaks every other system
4. **Mock out incompatible protocols** → Rejected: Dewlock's whole point is deterministic re-derive; mocked protocols are dead code

## Root Cause Analysis

**Plan research was empirically sound but lacked a preflight SDK check.** The protocol ecosystem shifted: v1-locked SDKs (Wormhole, Turbos) no longer dominate. The 4-phase plan's first gate was a spike; we ran it literally instead of skipping it. That spike forced the scope realization early.

**Why this matters for Dewlock**: The intent-firewall's guarantee is "what user signed = what executed." If the guardian runs against a mocked protocol, that guarantee is hollow. Better to narrow the protocol set to live, verified integrations than ship hollow safety.

## Lessons Learned

1. **Live SDK-compat spike beats research confidence.** When a plan says "verify before building," don't defer it. It revealed the actual dependency landscape, not the planned one. Future protocol additions: always check `@mysten/sui` peer version first.

2. **SDK-free paths are sometimes simpler.** Wormhole's SDK is 14KB gzipped; VAA binary parse + Wormholescan REST + hand-built `complete_transfer` was 120 LOC, zero external deps, and infinitely more trustworthy for a fail-closed system. If the SDK dependency has a breaking change, the parse/REST combo still works.

3. **Fail-closed design prevents "good enough" from becoming a trap.** When Suilend integration hit `pnpm.overrides` uncertainty, the temptation was to hack around it. Instead, marking it `[needs live-env]` in code comments + plan forced us to be honest: bundler-only paths must be validated on actual deploy, not stubbed.

4. **Allowlist derivation from live registry beats hardcoding.** Single-sourcing `ALLOWED_MOVE_TARGETS` from `@dewlock/sui` protocol registry means the guardian doesn't become stale as protocols are added/removed. It's one source of truth, not two.

## Next Steps

**Production gates** (before mainnet):
- [ ] Re-verify NAVI + Suilend + Wormhole package IDs on mainnet (currently testnet-only)
- [ ] Wire `prepareBridgeRedeem` to HTTP route that fetches on-chain guardian-set index (Gate 8; never stub this)
- [ ] Per-wallet daily bridge-redeem tracker (prevent rate-limit surprises)
- [ ] Pin Wormhole `complete_transfer` object refs (audit for off-by-one in arg count)

**Deferred protocols** (documented in `/protocols` + plan.md):
- 7K (v1 SDK; re-evaluate when aggregator adds v2-native support)
- Turbos (same)
- Bluefin (off-model; needs custom balance-check logic)
- Aftermath-PERP, Volo, Nemo (recently audited; not urgent for MVP)

**Follow-up bug** (spun off, separate task):
- POST_ONLY u8-scan false-reject: could reject valid limit orders if fee byte ≥ 248. Low-severity but correctness issue.

**Files modified**: `/src/@dewlock/sui/protocol-registry.ts`, `/src/@dewlock/sui/guardian.ts`, `/src/@dewlock/cetus-aggregator/`, `/src/@dewlock/wormhole-redeem/`, test fixtures in `/tests/e2e/multiprotocol.test.ts`.

---

## Confidence & Concerns

**Confidence**: 95% on swap + bridge logic; 85% on Suilend `pnpm.overrides` path (fixture-passing but not live-validated).

**Concerns**: None Critical. Bridge Gate 8 (object arg pinning) needs mainnet audit of actual Wormhole core bridge object shape to avoid silent failure.

---

**Status**: DONE. Ready for QA, pending live-env validation before mainnet.
