# Changelog

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
