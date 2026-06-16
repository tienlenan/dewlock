# Dewlock

**An intent-firewall for agentic Sui DeFi.** State a goal in natural language → a single agent (holds **zero user-fund keys**) compiles it into one unsigned PTB → a deterministic, fail-closed **Guardian** re-derives the math and dry-runs that exact bundle → **you sign the literal artifact you saw** (WYSIWYS). Persistent memory + immutable receipts on Walrus.

> _Every transaction, sealed before you sign._

## Why it's different

- **Fail-closed Guardian (the moat)** — deterministic, code-authoritative gates: server-side caps, trusted-price USD valuation, WYSIWYS digest binding, independent on-chain decimals cross-check for min-out, fail-closed on every external dependency, injection-provenance, `{pkg::mod::fn}` allowlist, homoglyph SuiNS lookalike, coin-**type** (not symbol).
- **DeepBook POST_ONLY limit-order** — "wait at my price, don't market-buy" — impossible on an AMM, on the same Guardian spine (POST_ONLY / self-match / expiry / BalanceManager-ceiling gates).
- **The BLOCK, provable** — a deliberate fail-closed block (lookalike + broken min-out) writes an immutable Walrus blob receipt anchored on a Sui object. _Proof a BLOCK happened, not just a tx._

## Stack

Next.js 16 · Tailwind v4 · shadcn · pnpm monorepo · `@mysten/sui` · `@mysten/dapp-kit` · `@mysten/deepbook-v3` · `@cetusprotocol/cetus-sui-clmm-sdk` · `@mysten/suins` · Walrus (`@mysten/walrus` + memwal) · Mastra + Vercel AI Gateway · Move (`move/dewlock_receipt`).

```
apps/web        Next.js app (landing + /app copilot + /api routes)
packages/sui    builders (transfer/swap/limit-order), dry-run, sign, suins, receipt-anchor
packages/agent  Guardian + Mastra agent + tools (prepare-trade, get-portfolio)
packages/walrus memory + blob + receipt
move/           dewlock_receipt — on-chain receipt HEAD anchor
docs/           product/spec docs + production backlog
```

## Run

```bash
pnpm install
cp LOCAL-ENV-KEYS.md → apps/web/.env.local   # fill real keys (gitignored; never commit)
pnpm --filter web dev                          # http://localhost:3000
pnpm -r typecheck && pnpm exec vitest run      # 378 tests
```

Routes: `/` landing · `/brand-design` styleguide · `/app` copilot · `/protocols` registry.

## Multi-protocol coverage

A single **protocol registry** (`@dewlock/sui`) is the sole author of the enforced allowlist and the public posture at `/protocols`. Only `active + built` protocols contribute Move targets; recently-hacked (Nemo/Volo/Aftermath-PERP) and off-model (Bluefin) protocols stay **listed but never built** (refused before a PTB exists).

- **Swap aggregation** — Cetus Aggregator best-execution across activated venues (Cetus + DeepBook); a route through any non-activated DEX fail-closes at the allowlist. Source-aware min-out re-derive.
- **Lending** — NAVI + Suilend deposit/repay (health-improving only; borrow/withdraw gated off). Value bounded by the dry-run net-outflow cap.
- **Cross-chain inflow** — Wormhole Sui redeem, built SDK-free, behind 9 fail-closed bridge gates (recipient==self, priced-asset allowlist, VAA verify, fee model). Source leg is wallet-driven (Connect).

## Status

Core flow (track/transfer/swap), Guardian (security-verified), DeepBook limit-order, multi-protocol swaps/lending/bridge, and the BLOCK theater are **implemented + unit-tested** (378 tests). Mainnet-small, `$5/tx` + `$20/day` server caps (bridge uses a fee model + recipient==self, not the trade cap); zero user-fund keys server-side.

**Before a live demo** (see `docs/docs/production-backlog.md` → `[needs live-env]`): pin real Cetus/DeepBook pool IDs, publish the `dewlock_receipt` Move package + set `DEWLOCK_RECEIPT_PACKAGE_ID`, fund the Walrus blob signer, pre-fund a BalanceManager, and validate the swap/portfolio/SuiNS/chat flow with a connected wallet.

Built for **Sui Overflow 2026** — DeFi & Payments + DeepBook tracks.
