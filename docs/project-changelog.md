# Changelog

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
