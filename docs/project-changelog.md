# Changelog

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
