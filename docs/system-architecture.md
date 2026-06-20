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
Every value move runs through `prepareTrade` → `guardianCheck(proposal, suiClient)` (`packages/agent/src/guardian.ts:296`). It is deterministic CODE, **not** an LLM: the agent only *proposes* an unsigned PTB; the Guardian re-derives the math independently, accumulates `reasons[]`/`gates[]`, and **any failing gate → BLOCK** (terminal, no auto-retry). Zero user-fund keys server-side; the user signs the literal artifact that was dry-run (WYSIWYS — signed bytes must equal `approvedDigest` bytes). **Fail-closed on every external dependency**: a missing price, invalid cap config, dry-run/RPC failure, or unknown target all block rather than proceed.

**Gate pipeline (executed in this order):**
1. **Allowlist** — every PTB MoveCall `{package::module::function}` must be pre-approved. Runs first so unknown targets are never processed.
2. **Action-shape** — the PTB's MoveCall set must match EXACTLY one declared `actionType` template; closes the "compose two allowlisted calls" bypass (e.g. a swap that smuggles `add_liquidity`). Consequence: **one value action per PTB** — composite/multi-action PTBs are refused by design.
3. **Coin-type provenance** — `coinTypeIn`/`coinTypeOut` verified on-chain via CoinMetadata (anti scam-clone; identity by coin TYPE, never display symbol).
4. **Injection provenance** — per-field `argProvenance`; a `derived` recipient (inferred / from recalled memory / pool data) triggers a confirm gate. Anti prompt-injection. (Contact/@mention sends use `user_turn` because the 0x is resolved server-side from the wallet-signed friend book — first-party, not injected data.)
5. **Trusted USD price** — real oracle (live SUI/USD via aggregator, USDC=$1). No trusted price → BLOCK (cannot value ⇒ cannot verify).
6. **Server caps** — per-tx + per-day USD caps (`TX_USD_CAP`/`DAILY_USD_CAP`; server-authoritative, mainnet-small in prod). Invalid cap config → block everything.
7. **SuiNS lookalike** — homoglyph-normalized edit-distance vs verified contacts (catches `888-l.sui`-style spoofs).
8. **Min-out re-derive** (swaps only) — independently recompute min-output from on-chain decimals + the SAME route source; runs for EVERY swap (not gated on poolId). Anti sandwich / manipulated min-out — the #1 real-money risk.
9. **Orderbook / Lending** — `limit_order`: POST_ONLY / self-match / expiry / BalanceManager-ceiling. `lend_*`: health-improving only (deposit/repay; borrow/withdraw gated off).
10. **Dry-run + WYSIWYS digest** — dry-run the EXACT PTB bytes (`dryRunTransactionBlock`); fail-closed on any error; compute `approvedDigest = sha256(txBytes)` that binds preview ⇄ signature.
11. **Authoritative value gate** — re-value from the dry-run's ACTUAL net balance deltas (what truly leaves the wallet), re-check caps on that figure, and block when outflow > 1.5× the declared value (`outflow_mismatch`). Catches a PTB that moves more than it declares.

Pass → `{ ok:true, txBytes, approvedDigest, preview }`; `preview` (balance deltas + gas + USD value) renders before the confirm button. **Defense-in-depth:** the "moves more than declared" risk is caught independently at gates 1 (allowlist), 2 (shape), and 11 (actual-outflow).

- **Swap gate is signature-based** for aggregator routes: the Cetus aggregator emits per-route, upgradeable integration packages that can't be statically pinned, so swap-route calls are matched by `module::function` (`router::*`, `cetus::swap`, `deepbookv3::swap`) — package-agnostic — bounded by the provider constraint (CETUS+DEEPBOOK) + value gates. `0x2::coin::destroy_zero` (full-balance cleanup) is allowlisted as a zero-value framework call.

## Intent → action forms — `@dewlock/agent/intent`
A deterministic `parseIntent` + `buildIntentDirective` front-runs the LLM. Self-contained commands ("swap 5 SUI to USDC", "send 2 SUI to 0x…") route straight to `prepareTrade`. Missing args ("sell SUI", "send USDC", "lending") route to the **`requestActionForm`** tool → an interactive form card; its submit composes the canonical command and re-enters the pipeline (Guardian still gates). Counter-asset defaults: USDC→SUI, else→USDC.

## SuiNS — `@dewlock/sui/suins-resolver`
Forward + reverse resolution via the **native JSON-RPC** (`resolveNameServiceAddress` / `resolveNameServiceNames`) — NOT `@mysten/suins` SuinsClient (fails to construct under `serverExternalPackages`). Bare names auto-resolve (`roast2026wc` → `.sui`); unregistered → clear block. Reverse-lookup spoof guard + homoglyph lookalike check.

## Friend address book — `apps/web/lib/contacts` + `@dewlock/agent/memory/contacts`
Per-wallet name→0x book stored as ONE Walrus blob + a memwal pointer (`contacts-book: <blobId> @ <ts>`, latest-wins; `contacts-cleared:` tombstone for empty). Pointer ts is monotonic (`max(now, prevAt+1)`) so latest-wins holds for same-ms writes. The blob is the single source of truth — **no per-contact `contact:` lines** are written (memwal can't delete them). CRUD via `GET/POST/DELETE /api/contacts`; every write is **payload-bound wallet-signature** gated (`dewlock-contacts:<op>:<wallet>:<ts>:<sha256([op,name,address])>`, 5-min freshness) so a captured signature can't be replayed with a swapped address. GET is unauthenticated (exposes the labeled graph — documented tradeoff). Resolution is **deterministic & route-side**: the client passes its freshest book to `/api/agent`; `buildIntentDirective` runs `matchContacts` on a bare-word recipient → 1 match injects the exact 0x (`argProvenance.recipient:"derived"`), 2+ → `requestContactPicker` card, 0 → SuiNS. The LLM never supplies a 0x; names are sanitized before entering the directive. Managed from the chat-header "Friend list" dialog + a friend card on the two-column My Dashboard.

## Conversation persistence — `apps/web/lib/conversations` + `apps/web/app/api/conversations`
Two stores, clean split. **CONTENT** = one immutable Walrus blob per conversation; messages are Seal-encrypted client-side (`enc`), the server stores them opaquely. **INDEX** = a per-wallet Upstash Redis HASH `convo:idx:<wallet>` of `{id → {blobId, titleEnc, createdAt, updatedAt}}` — exact key-value (`HGETALL`/`HSET`/`HDEL`/`DEL`), the source of truth for enumeration. The index used to live in memwal (semantic vector store, ~30-43s lag + shared relayer rate limit → slow/flaky list/read/delete); Redis removed both, so a delete is a plain `HDEL` with no resurrection/tombstones. **Titles are encrypted client-side** (`titleEnc`, wallet-derived AES-GCM key — sign-once `dewlock-conversation-title-key:v1:<wallet>` → HKDF, cached in memory+localStorage; rendered `🔒 Locked` until the first sign), so the OPEN list read exposes only ciphertext titles + Seal-protected blobIds — the server stays title-blind. CRUD via `GET/POST/DELETE /api/conversations` (+ `/[id]`); every **write** (POST upsert, per-id DELETE, clear-all DELETE) is **session write-auth gated** (`dewlock-conversation-auth:<wallet>:<ts>`, 30-min token, recovers to wallet) — kills the cross-wallet IDOR. Atomicity is **report-after-HSET**: "saved" only after the Redis index write confirms (an orphan blob expires on Walrus). The `index-kv.ts` store is `server-only` (REST token never bundled); both `UPSTASH_REDIS_REST_*` and Vercel's `KV_REST_API_*` env pairs are accepted. memwal is no longer on the conversation path.

## Receipt pipeline — `apps/web/lib/workflows/post-action-effects.ts`
A plain sequential runner (`runPostActionEffectsStreaming`, NOT a Mastra workflow object — use `await createRun()`+`run.start()` elsewhere). Steps, each bounded + fail-soft:
1. **publish** → Walrus blob (immutable receipt) + its on-chain Blob `objectId` (surfaced as the receipt's Sui object when the custom HEAD anchor isn't deployed). ~32s budget (mainnet Walrus is slow).
2. **logAction** → memwal `action log:` line via `rememberBulk` (queued, ~s — NOT `rememberAndWait` which blocks ~30-43s for indexing). This is the XP source of truth.
3. **updateProfile** → recompute level/XP/badges, persist monotonically (backstop).
4. **anchor** → optional on-chain HEAD (operational key only).
`POST /api/receipt/stream` runs this and streams `steps`→per-step→`done` (SSE) to a progress dialog.

## Memory stack (memwal + Walrus)
memwal = `@mysten-incubation/memwal` (relayer; eventually-consistent ~30s; NO delete/enumerate API). Categories: `action log:` (XP), `wallet-profile:` (durable profile pointer), `risk cap:` (committed cap, seeded from env), `contacts-book:` (friend-book blob pointer), `token map:` (seeded resolution cache). **Conversations are NOT here** — the index moved to Upstash Redis (see Conversation persistence); memwal is scoped to genuine semantic memory only. Walrus blobs hold receipts, profiles, passports, and the friend book (each publish creates an on-chain Blob object).
- **Memory page** (`/app` → Memory): lists global + user categories with signature-gated clear. Clearable: **conversations** (Redis `DEL`; exact count + samples sourced from Redis, titles shown as `🔒` since encrypted) and **contacts** (book overwritten/tombstoned, count from the book). memwal counts are approximate (recall is semantic); append-only ones (action log) are permanent + shown honestly.

## Passport — `@dewlock/agent/memory/passport` + `apps/web/lib/passport`
Per-user identity: level, XP, title, earned badges, action counts, member-since (NOT cap/risk — kept private; NOT volume — structurally $0). Built **live** from the action log (display authority = `/api/user-stats` / `/api/passport`); persisted as a public Walrus blob + memwal pointer + optional on-chain HEAD **out-of-band** (background, diff-gated on level/badge change — never in the awaited receipt request). Surfaced as the Passport card atop My Dashboard with blob + Sui-object proof links + share.

**user-stats Redis cache** (`apps/web/lib/user-stats/stats-cache.ts` + `lib/redis-client.ts`): `/api/user-stats` is fronted by a per-wallet Upstash Redis read-through cache (`userstats:<wallet>`, 60s TTL). A hit returns instantly and **identically to every surface** — the dashboard `LevelCard`/`BadgeGrid` and the copilot `ProfileChatCard` read the same cached value, so level/badges can't disagree between them (the old live-memwal reads were eventually-consistent → mismatched). The cache is a **mirror of the receipt-derived value** (on-chain receipt log = source of truth), never written with client values. Re-sync on action: the dashboard's post-tx re-polls call `?fresh=1`, which re-derives from the authoritative source and overwrites the cache. Fail-soft: no Redis → derive live as before. **Known slowness:** the Memory page still recalls memwal live (~5-15s, occasionally empty under rate-limit), so its counts can lag — caching it is a future improvement.

## Key gotchas
- `serverExternalPackages` CJS/ESM interop → named exports nest under `.default` (aggregator `Env`, SuinsClient). Use native RPC / normalized loaders.
- Mastra committed workflow: `await workflow.createRun()` + `run.start({inputData})` — there is NO `createRunAsync`.
- dist is loaded via `require()` in routes — re-emit after editing `packages/*/src`.
- Rate-limit per-endpoint `scope` (dev IP is constant "local" → buckets collide otherwise).
