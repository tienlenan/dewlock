# 09 — Implementation Phases (feed to /ck:plan)

Run `/ck:plan docs/09-implementation-phases.md` in the new repo to expand into executable phase files. Order respects dependencies. Each phase ends with the security gate (03) honored.

> ⚠️ **Build order RE-SCOPED by `13-defi-core-recenter-decision.md`.** Build the Guardian spine FIRST (fail-closed + min-out re-derivation + coin-type — it's 0% coded, the moat). Then ONE DeepBook POST_ONLY limit-order on it (BalanceManager pre-funded off-stage). Then the deliberate BLOCK + Walrus+Sui receipt. best-ex = stretch (mainnet only); atomic = 2-leg vehicle only. Add orderbook Guardian gates (POST_ONLY-enforce, self-match block, expiry-required, BalanceManager ceiling).

## Phase 0 — Scaffold + plumbing

- Next.js (App Router) + pnpm; TS strict; lint.
- `app/providers.tsx`: QueryClient + SuiClientProvider + WalletProvider (copy from Daily Walrus wallet-providers).
- Connect wallet; show address + gas balance.
- Mastra agent skeleton at `app/api/agent/route.ts` (gateway + empty tools).
- Copy Walrus memory wrapper (`lib/walrus/memory.ts`) + blob wrapper (`lib/walrus/blob.ts`); provision memwal; health check green.
- Env wired (server vs public). **Verify:** no user-fund signer key server-side.

## Phase 1 — Hero: track + transfer + swap + addLP (mainnet small)

Security pipeline first (it gates everything) — **Guardian-as-code, see ADR `10`**:
- `guardianCheck()` (`lib/agent/guardian.ts`) = deterministic, fail-closed gates: allowlist {Cetus, SuiNS, own addr} + recipient + per-tx & daily caps + min-out re-derived from fresh quote + **coin-TYPE (not ticker)** + SuiNS lookalike + **`devInspect`/`dryRun` delta, fail-CLOSED**. Runs inside `prepareTrade`; returns no PTB on block.
- tx-preview card with green/red risk badges + confirm gate.
- Client sign hook (`lib/sui/sign.ts`) — copy `sui-output-record.ts` pattern.
- (Optional, cuttable) one LLM "second-opinion" critic — advisory badge, NOT load-bearing.
- **Real money risk #1 = Cetus min-out/decimals math** — unit-test decimals per coin type; validate via on-chain dry-run before trusting "approve".

Then capabilities:
1. **Track** — `getPortfolio` tool: balances (by coin type) + Cetus LP positions + USD/PnL → portfolio card.
2. **Transfer** — `buildTransfer`: SuiNS resolve + spoof guard (raw 0x + reverse-lookup) → PTB → dry-run → sign → receipt blob + memory.
3. **Swap** — `buildSwap`: Cetus quote/slippage → PTB → dry-run → sign → receipt.
4. **Add LP** — `buildAddLp`: Cetus TickMath range → PTB → dry-run → sign → receipt.
- Memory writes: risk profile, contacts, decision log; recall changes later answers.
- Tests: testnet integration (self-seed Cetus pool) for swap/addLP/transfer; injection test; allowlist refusal test.

## Phase 2 — Lending tracking (NAVI/Scallop, mainnet read)

- Read + display lending positions (supply/borrow/health) in portfolio card.
- (Optional) execute supply/borrow mainnet-small behind same dry-run/confirm gate.
- Pick NAVI and/or Scallop per open-question #4.

## Phase 3 — Confidential transfers (devnet, feature-flag)

- Separate `SuiClient(devnet)` + network badge + `NEXT_PUBLIC_FEATURE_CONFIDENTIAL`.
- Confidential send flow via Sui OSS SDK; labeled "preview, unaudited".
- Isolated tab; no mainnet funds.

## Phase 4 — Proactive suggestions (stretch)

- Agent surfaces opportunities ("idle USDC → pool", "rebalance") from portfolio + memory.
- Still human-signed; same gate. No autonomy over funds.

## Cross-cutting (every phase)

- Honor 03 security invariants; add the matching acceptance test.
- Receipt blob + memory update on each executed action.
- Pin SDK versions on first install; smoke test per protocol.

## Definition of done (hackathon demo)

- 4 hero actions executed mainnet-small, each with visible dry-run + wallet sign.
- Memory recall visibly personalizes a response.
- A shareable receipt blob for one action.
- Confidential transfer demo on devnet.
- Security acceptance checks (03) pass.

## Open questions to resolve in /ck:plan

1. Persona/brand name. 2. Hackathon/track + deadline (caps phase ambition). 3. Per-tx USD cap. 4. NAVI vs Scallop vs both. 5. Repo org/slug. 6. Single Next.js app vs web+server split (02 shape A vs B).
