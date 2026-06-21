# 03 — Security Model (the differentiator)

"Bảo mật cực cao" is the headline. With human-in-the-loop + mainnet-small, the threat surface is bounded. This file is the spec the implementation must honor.

## Non-negotiable invariants

1. **Zero USER-FUND keys agent/server-side.** Signing of any value-moving tx is 100% in the user's wallet (`@mysten/dapp-kit`). The server MAY hold operational keypairs (Walrus blob publish, and in the source repo: oracle/admin) — these never touch user funds. **Pitch precisely as "never holds *user* keys"** — do not overclaim "0 keys" (a judge can puncture it; source repo holds oracle/walrus keys).
1b. **Guardian is deterministic CODE, not an LLM.** `guardianCheck()` runs inside `prepareTrade` before any PTB reaches the user; hard gates (allowlist/caps/min-out/coin-type/SuiNS/dry-run) are authoritative and fail-closed. The optional LLM critic is ADVISORY garnish only — it adds a prompt-injection surface and is NOT in the threat model. See `10-agent-orchestration-decision.md`.
2. **Agent builds, user signs.** Tools return unsigned PTB / tx-spec + preview. No code path executes a value-moving tx without a fresh wallet signature.
3. **Allowlist before build.** Agent may only construct calls against a fixed allowlist of `{package::module::function}`: coin transfer, Cetus CLMM (swap, add_liquidity), SuiNS resolve (read), and (later) NAVI/Scallop entry funcs. Anything else → refuse + explain.
4. **Mandatory dry-run.** Every proposed tx runs `dryRunTransactionBlock`; UI shows real balance deltas + gas + slippage before the confirm button enables.
5. **Per-session + per-tx caps.** Default small cap (e.g. ≤ $5/tx, configurable). Exceeding cap → require explicit extra confirmation step.

## Guardian gate pipeline (as built)

`guardianCheck(proposal, suiClient)` (`packages/agent/src/guardian.ts:296`) is the single enforcement point inside `prepareTrade`. It runs the gates below in order, accumulating `reasons[]`/`gates[]`; **any failing gate blocks** (terminal, no auto-retry) and no PTB reaches the user. It is deterministic code, fail-closed on every dependency.

1. **Allowlist** — every MoveCall `{package::module::function}` must be pre-approved (runs first).
2. **Action-shape** — the PTB's MoveCall set must match EXACTLY one declared `actionType` template; blocks "compose two allowlisted calls" smuggling ⇒ one value action per PTB (composite PTBs refused).
3. **Coin-type provenance** — `coinTypeIn/Out` verified on-chain via CoinMetadata (anti scam-clone; by TYPE not symbol).
4. **Injection provenance** — per-field `argProvenance`; a `derived` recipient (from inferred/recalled/pool data) forces a confirm gate.
5. **Trusted USD price** — real oracle; no price ⇒ block (cannot value cannot verify).
6. **Server caps** — per-tx + per-day USD caps (`TX_USD_CAP`/`DAILY_USD_CAP`, env, server-authoritative, mainnet-small in prod); bad config ⇒ block all.
7. **SuiNS lookalike** — homoglyph-normalized edit-distance vs verified contacts.
8. **Min-out re-derive** (swaps) — recompute min-output from on-chain decimals + the SAME route source; runs for every swap.
9. **Orderbook / Lending** — limit_order: POST_ONLY/self-match/expiry/BalanceManager-ceiling; lend_*: health-improving only.
10. **Dry-run + WYSIWYS digest** — dry-run the EXACT full bytes for effects verification (fail-closed); `approvedDigest = sha256(kindBytes)` over the **TransactionKind only** binds preview ⇄ signature. Client reconstructs full tx via `Transaction.fromKind()` with fresh gas coin + sender at sign time; WYSIWYS verified by re-deriving kind digest from wallet-built bytes.
11. **Authoritative value gate** — re-value from the dry-run's ACTUAL net balance deltas, re-check caps, block when outflow > 1.5× declared (`outflow_mismatch`).

Note: the small-cap intent below ("≤ $5/tx") is enforced via the `TX_USD_CAP`/`DAILY_USD_CAP` env (set mainnet-small in prod); the code defaults are higher and are overridden per deploy.

## Anti prompt-injection (the AI-specific risk)

DeFi data is attacker-controllable: pool names, token symbols/metadata, even recalled memory text. Treat ALL of it as untrusted.

- Untrusted text **never** auto-triggers a value-moving tool. The user's literal chat intent is the only trigger; tool args derived from external data must be surfaced for confirm.
- Tool args are validated with zod schemas (typed, bounded) — see Mastra tool pattern in 05.
- Token identity resolved by **coin type (0x…::module::TYPE)**, never by display symbol (symbols are spoofable; many fake "USDC").
- No tool can read+spend in one hop without the human confirm gate between.
- Strip/escape any instruction-like content from memory before injecting into the system prompt; memory is data, not commands.

## Object-ownership classification in preview

The dry-run classifies each outgoing object's destination. The pre-sign preview shows:
- **`you` / `recipient`** (neutral, expected flow) — assets staying in the user's account or moving to the address they explicitly designated (e.g. the swap-output recipient, a contact they chose to send to).
- **`third-party`** (red ⚠) — assets moving to an address the user never designated. The genuine alarm for reroutes, malicious pools, or protocol bugs that divert user funds to attacker/unknown address. Reserve the red alert for THIS case only.
- **`shared` / `object`** — protocol-scoped (pool positions, etc.). Display-only classification; the authoritative gate is the net-outflow check (gate 11, revalue from dry-run deltas).

## Name-resolution / address-spoofing guard

- For "send to NAME.sui": resolve via SuiNS, then **display the raw 0x address** + optional reverse-lookup. If reverse name ≠ typed name → warn.
- Show amount + token + USD value + destination together; require explicit confirm.
- Never sign to an address the user hasn't seen in raw form.

## Web / secrets hygiene

- Model/gateway keys (`AI_GATEWAY_API_KEY`), Walrus relayer/delegate keys → **server-side only**; never shipped to client. Public client vars use `NEXT_PUBLIC_` prefix and contain no secrets.
- CORS locked to the app origin(s).
- Rate-limit agent endpoints (prevent abuse / cost blowups).

## Confidential module (devnet) notes

- Confidential Transfers beta is **unaudited, not production-ready** — keep it isolated, devnet-only, clearly labeled "preview". Do not route mainnet funds through it.

## Threat → mitigation table

| Threat | Mitigation |
|---|---|
| Prompt-injection builds a drain tx | allowlist + untrusted-data rule + human confirm + dry-run |
| Fake-token (spoofed USDC) | resolve by coin type, not symbol; show type in preview |
| Name spoofing (`888.sui`) | raw 0x display + reverse-lookup mismatch warning |
| Mainnet real loss | small caps; explicit confirm; default conservative amounts |
| Leaked model/Walrus keys | server-only env; no secret reaches client bundle |
| Confidential beta bugs | isolate to devnet, label preview, no mainnet funds |
| Endpoint abuse / cost | rate limit + auth on agent routes |
| **Cetus min-out / decimals bug** (real money risk #1 — guardian validates its own wrong number) | re-derive min-out from fresh quote; **on-chain dry-run delta check before trusting "approve"**; unit-test decimals per coin type |
| Dry-run fail-OPEN bypass | `devInspect`/`dryRun` errors must fail-CLOSED (block), never "proceed because unavailable" |

## Acceptance (security)

- Static check: grep new repo → no user-fund signer key server-side.
- Every value-moving flow has a dry-run + confirm step (manual test each).
- Allowlist enforced in code (unit test: out-of-allowlist call is refused).
- Injection test: a pool/token named with an instruction does not move funds.
