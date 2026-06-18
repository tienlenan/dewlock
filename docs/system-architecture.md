# Dewlock — System Architecture

Fail-closed "intent-firewall" copilot for agentic Sui DeFi. Monorepo: `apps/web` (Next.js) + packages `@dewlock/{agent,sui,walrus}`.

## High-level flow

```
User → Copilot (chat) → intent parse + directive → Mastra agent (tools)
   ├─ read tools  → cards (portfolio, swap-options, protocols, user-stats, passport, action-form)
   └─ prepareTrade → Guardian (fail-closed gates) → unsigned PTB → WYSIWYS sign (client)
        → /api/receipt/stream (SSE) → blob + memwal XP + profile + anchor → receipt card
```

## Guardian (value-move firewall) — `@dewlock/agent/guardian`
Every value move runs through `prepareTrade` → `guardianCheck`. Zero user-fund keys server-side; the agent builds an unsigned PTB the user signs (WYSIWYS — signed bytes must equal approved bytes). Gates: coin-type allowlist, server-authoritative USD caps (`TX_USD_CAP`/`DAILY_USD_CAP`, default 5000/20000), source-aware min-out re-derive, dry-run net-outflow, structural shape gate, and a `{package::module::function}` allowlist.
- **Swap gate is signature-based** for aggregator routes: the Cetus aggregator emits per-route, upgradeable integration packages that can't be statically pinned, so swap-route calls are matched by `module::function` (`router::*`, `cetus::swap`, `deepbookv3::swap`) — package-agnostic — bounded by the provider constraint (CETUS+DEEPBOOK) + value gates. `0x2::coin::destroy_zero` (full-balance cleanup) is allowlisted as a zero-value framework call.

## Intent → action forms — `@dewlock/agent/intent`
A deterministic `parseIntent` + `buildIntentDirective` front-runs the LLM. Self-contained commands ("swap 5 SUI to USDC", "send 2 SUI to 0x…") route straight to `prepareTrade`. Missing args ("sell SUI", "send USDC", "lending") route to the **`requestActionForm`** tool → an interactive form card; its submit composes the canonical command and re-enters the pipeline (Guardian still gates). Counter-asset defaults: USDC→SUI, else→USDC.

## SuiNS — `@dewlock/sui/suins-resolver`
Forward + reverse resolution via the **native JSON-RPC** (`resolveNameServiceAddress` / `resolveNameServiceNames`) — NOT `@mysten/suins` SuinsClient (fails to construct under `serverExternalPackages`). Bare names auto-resolve (`roast2026wc` → `.sui`); unregistered → clear block. Reverse-lookup spoof guard + homoglyph lookalike check.

## Friend address book — `apps/web/lib/contacts` + `@dewlock/agent/memory/contacts`
Per-wallet name→0x book stored as ONE Walrus blob + a memwal pointer (`contacts-book: <blobId> @ <ts>`, latest-wins; `contacts-cleared:` tombstone for empty). Pointer ts is monotonic (`max(now, prevAt+1)`) so latest-wins holds for same-ms writes. The blob is the single source of truth — **no per-contact `contact:` lines** are written (memwal can't delete them). CRUD via `GET/POST/DELETE /api/contacts`; every write is **payload-bound wallet-signature** gated (`dewlock-contacts:<op>:<wallet>:<ts>:<sha256([op,name,address])>`, 5-min freshness) so a captured signature can't be replayed with a swapped address. GET is unauthenticated (exposes the labeled graph — documented tradeoff). Resolution is **deterministic & route-side**: the client passes its freshest book to `/api/agent`; `buildIntentDirective` runs `matchContacts` on a bare-word recipient → 1 match injects the exact 0x (`argProvenance.recipient:"derived"`), 2+ → `requestContactPicker` card, 0 → SuiNS. The LLM never supplies a 0x; names are sanitized before entering the directive. Managed from the chat-header "Friend list" dialog + a friend card on the two-column My Dashboard.

## Receipt pipeline — `apps/web/lib/workflows/post-action-effects.ts`
A plain sequential runner (`runPostActionEffectsStreaming`, NOT a Mastra workflow object — use `await createRun()`+`run.start()` elsewhere). Steps, each bounded + fail-soft:
1. **publish** → Walrus blob (immutable receipt) + its on-chain Blob `objectId` (surfaced as the receipt's Sui object when the custom HEAD anchor isn't deployed). ~32s budget (mainnet Walrus is slow).
2. **logAction** → memwal `action log:` line via `rememberBulk` (queued, ~s — NOT `rememberAndWait` which blocks ~30-43s for indexing). This is the XP source of truth.
3. **updateProfile** → recompute level/XP/badges, persist monotonically (backstop).
4. **anchor** → optional on-chain HEAD (operational key only).
`POST /api/receipt/stream` runs this and streams `steps`→per-step→`done` (SSE) to a progress dialog.

## Memory stack (memwal + Walrus)
memwal = `@mysten-incubation/memwal` (relayer; eventually-consistent ~30s; NO delete/enumerate API). Categories: `action log:` (XP), `wallet-profile:` (durable profile pointer), `risk cap:` (committed cap, seeded from env), `contacts-book:` (friend-book blob pointer), `conversation-index:`, `token map:` (seeded resolution cache). Walrus blobs hold receipts, profiles, passports, and the friend book (each publish creates an on-chain Blob object).
- **Memory page** (`/app` → Memory): lists global + user categories (approximate counts — recall is semantic) with signature-gated clear; pointer-backed categories are clearable (conversations, **contacts** — the book is overwritten/tombstoned, count sourced from the book) — append-only ones (action log) are permanent + shown honestly.

## Passport — `@dewlock/agent/memory/passport` + `apps/web/lib/passport`
Per-user identity: level, XP, title, earned badges, action counts, member-since (NOT cap/risk — kept private; NOT volume — structurally $0). Built **live** from the action log (display authority = `/api/user-stats` / `/api/passport`); persisted as a public Walrus blob + memwal pointer + optional on-chain HEAD **out-of-band** (background, diff-gated on level/badge change — never in the awaited receipt request). Surfaced as the Passport card atop My Dashboard with blob + Sui-object proof links + share.

## Key gotchas
- `serverExternalPackages` CJS/ESM interop → named exports nest under `.default` (aggregator `Env`, SuinsClient). Use native RPC / normalized loaders.
- Mastra committed workflow: `await workflow.createRun()` + `run.start({inputData})` — there is NO `createRunAsync`.
- dist is loaded via `require()` in routes — re-emit after editing `packages/*/src`.
- Rate-limit per-endpoint `scope` (dev IP is constant "local" → buckets collide otherwise).
