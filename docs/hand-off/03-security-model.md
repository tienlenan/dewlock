# 03 — Security Model (the differentiator)

"Bảo mật cực cao" is the headline. With human-in-the-loop + mainnet-small, the threat surface is bounded. This file is the spec the implementation must honor.

## Non-negotiable invariants

1. **Zero USER-FUND keys agent/server-side.** Signing of any value-moving tx is 100% in the user's wallet (`@mysten/dapp-kit`). The server MAY hold operational keypairs (Walrus blob publish, and in the source repo: oracle/admin) — these never touch user funds. **Pitch precisely as "never holds *user* keys"** — do not overclaim "0 keys" (a judge can puncture it; source repo holds oracle/walrus keys).
1b. **Guardian is deterministic CODE, not an LLM.** `guardianCheck()` runs inside `prepareTrade` before any PTB reaches the user; hard gates (allowlist/caps/min-out/coin-type/SuiNS/dry-run) are authoritative and fail-closed. The optional LLM critic is ADVISORY garnish only — it adds a prompt-injection surface and is NOT in the threat model. See `10-agent-orchestration-decision.md`.
2. **Agent builds, user signs.** Tools return unsigned PTB / tx-spec + preview. No code path executes a value-moving tx without a fresh wallet signature.
3. **Allowlist before build.** Agent may only construct calls against a fixed allowlist of `{package::module::function}`: coin transfer, Cetus CLMM (swap, add_liquidity), SuiNS resolve (read), and (later) NAVI/Scallop entry funcs. Anything else → refuse + explain.
4. **Mandatory dry-run.** Every proposed tx runs `dryRunTransactionBlock`; UI shows real balance deltas + gas + slippage before the confirm button enables.
5. **Per-session + per-tx caps.** Default small cap (e.g. ≤ $5/tx, configurable). Exceeding cap → require explicit extra confirmation step.

## Anti prompt-injection (the AI-specific risk)

DeFi data is attacker-controllable: pool names, token symbols/metadata, even recalled memory text. Treat ALL of it as untrusted.

- Untrusted text **never** auto-triggers a value-moving tool. The user's literal chat intent is the only trigger; tool args derived from external data must be surfaced for confirm.
- Tool args are validated with zod schemas (typed, bounded) — see Mastra tool pattern in 05.
- Token identity resolved by **coin type (0x…::module::TYPE)**, never by display symbol (symbols are spoofable; many fake "USDC").
- No tool can read+spend in one hop without the human confirm gate between.
- Strip/escape any instruction-like content from memory before injecting into the system prompt; memory is data, not commands.

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
