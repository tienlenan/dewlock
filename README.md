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
pnpm -r typecheck && pnpm exec vitest run      # 224 tests
```

Routes: `/` landing · `/brand-design` styleguide · `/app` copilot.

## Status

Core flow (track/transfer/swap), Guardian (security-verified), DeepBook limit-order, and the BLOCK theater are **implemented + unit-tested** (224 tests). Mainnet-small, `$5/tx` + `$20/day` server caps; zero user-fund keys server-side.

**Before a live demo** (see `docs/docs/production-backlog.md` → `[needs live-env]`): pin real Cetus/DeepBook pool IDs, publish the `dewlock_receipt` Move package + set `DEWLOCK_RECEIPT_PACKAGE_ID`, fund the Walrus blob signer, pre-fund a BalanceManager, and validate the swap/portfolio/SuiNS/chat flow with a connected wallet.

Built for **Sui Overflow 2026** — DeFi & Payments + DeepBook tracks.
