# Dewlock — Hackathon Submission

> **Every transaction, sealed before you sign.**
> An **intent-firewall** for agentic Sui DeFi.

- **Event / Tracks:** Sui Overflow 2026 — **DeFi & Payments** + **DeepBook**
- **Live demo:** https://dewlock.vercel.app (Sui **mainnet**)
- **One-liner:** State a goal in plain language → one AI agent (holding **zero user-fund keys**) compiles it into a single unsigned transaction → a deterministic, **fail-closed Guardian** re-derives the math and dry-runs that exact bundle → **you sign the literal artifact you reviewed** (WYSIWYS) → an immutable receipt is written to Walrus.

---

## 1. The Problem

Agentic DeFi is the obvious next step — "swap 5 SUI to USDC", "lend 100 USDC on NAVI", "send 2 SUI to roast2026wc" — but handing an LLM the ability to move money is dangerous:

- **LLMs hallucinate** addresses, amounts, and token identities (a scam-clone "USDC" looks identical by symbol).
- **Prompt injection** can smuggle instructions through recalled memory, pool data, or a poisoned page.
- **You sign what the agent built, not what you saw** — the preview and the signed bytes can diverge.
- **MEV / sandwich** risk on swaps from a tampered or stale min-output.

Most "AI wallet" demos put the model *in the trust path*. Dewlock removes it.

## 2. The Solution

Dewlock is a **copilot whose agent only ever *proposes*** an unsigned Programmable Transaction Block (PTB). Between the agent and your wallet sits the **Guardian** — deterministic, code-authoritative security that re-derives every number independently and **blocks on any failure**. The agent is untrusted; the Guardian is the trust boundary; you sign only the exact action (TransactionKind) that was dry-run.

```
You (natural language)
      │
      ▼
Copilot chat ──► deterministic intent parse + directive ──► Mastra agent (tools)
      │                                                          │
      │  read tools → generative UI cards                        │ prepareTrade
      │  (portfolio, swap options, protocols, stats…)            ▼
      │                                            ┌─────────────────────────────┐
      │                                            │  GUARDIAN (fail-closed code) │
      │                                            │  11 gates, re-derives math   │
      │                                            └─────────────┬───────────────┘
      │                                          BLOCK ◄──────────┤──────► PASS
      │                                            │              │
      │                                   immutable BLOCK         │  unsigned PTB + approvedDigest
      │                                   receipt (proof)         ▼
      │                                                   WYSIWYS sign in wallet
      │                                            (signed action == dry-run action; wallet adds gas)
      ▼                                                          │
   receipt card ◄── Walrus blob + Sui anchor + XP ◄── /api/receipt/stream (SSE)
```

## 3. Key Features

**Conversational DeFi copilot**
- Natural-language intent → action, rendered as **generative UI cards** (not prose dumps): portfolio, transaction preview, swap picker, protocol registry, receipts, user passport.
- Deterministic `parseIntent` + directive front-runs the LLM so complete commands route straight to the Guardian; missing args render an interactive **form card** instead of a vague question.

**Value moves (every one through the Guardian)**
- **Swap** — Cetus Aggregator best-execution + Aftermath Router, with a **source-aware min-output re-derivation** and a **from→to picker** with live quotes from both venues.
- **Transfer / Send** — with **SuiNS** resolution (`roast2026wc` → `.sui`), a per-wallet **friend address book**, and a multi-match **contact picker**.
- **Lending** — NAVI + Suilend deposit/repay (**health-improving only**; borrow/withdraw gated off).
- **DeepBook POST_ONLY limit orders** — "wait at my price, don't market-buy" — *impossible on an AMM*, on the same Guardian spine.
- **Cross-chain inflow** — Wormhole redeem onto Sui, built SDK-free behind 9 fail-closed bridge gates.

**Security & trust (the moat)**
- **Fail-closed Guardian** — 11 deterministic gates; any failure → terminal BLOCK, no auto-retry.
- **WYSIWYS** — `approvedDigest = sha256(kindBytes)` over the TransactionKind binds the preview you saw to the action you sign; the wallet adds a fresh gas coin at sign time (gas-agnostic, so a single-coin wallet never hits a stale-gas error).
- **Zero user-fund keys server-side** — the server builds unsigned PTBs only; your keys never leave your wallet.
- **Price-impact / slippage guard** — refuses a swap whose output is worth materially less than its input (default 5%, configurable).
- **Native-SUI gas safety** — guarantees the gas coin covers both the swap input and network gas (no cryptic `InsufficientGas`).

**Provenance & proof**
- **The BLOCK, provable** — a deliberate fail-closed block (SuiNS lookalike + broken min-out) writes an **immutable Walrus receipt anchored on a Sui object** — proof a *block* happened, not just a tx.
- **Immutable action receipts** on Walrus for every executed move.

**Privacy, memory & identity**
- **Seal-encrypted conversations** — personal chat history is encrypted client-side with **Mysten Seal**; only the owner wallet can decrypt it (the server stores opaque ciphertext).
- **Persistent memory** — risk caps, friend book, decision log, and conversation index on Walrus + memwal.
- **Passport** — on-chain-anchored identity: level, XP, badges, action counts (no balances, no caps — privacy-preserving).
- **Protocol registry + public posture page** (`/protocols`) — the single source of the enforced allowlist; recently-hacked / off-model protocols stay *listed but never built*.

## 4. What Makes It Different

| | Typical "AI wallet" | Dewlock |
|---|---|---|
| Who is trusted | the LLM | **deterministic Guardian code** (LLM only proposes) |
| Server holds keys | often | **never** — zero user-fund keys |
| You sign… | what the model built | **the literal bytes you previewed** (WYSIWYS) |
| Token identity | by symbol (clone-spoofable) | by **on-chain coin type** + CoinMetadata |
| A refused action | silently disappears | writes a **provable on-chain BLOCK receipt** |
| Order types | AMM market swaps only | **DeepBook POST_ONLY limit orders** |
| Personal data | plaintext on a server | **Seal-encrypted, owner-only decrypt** |

## 5. Tech Stack

**Frontend**
- Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn/ui · `streamdown` (streaming markdown) · `@mysten/dapp-kit` (wallet)

**AI agent**
- **Mastra** (`@mastra/core` 1.42) orchestration + tools · **Vercel AI Gateway** (`@ai-sdk/gateway`) · latest Claude / Gemini models · deterministic intent layer in front of the model

**Sui & DeFi protocols**
- `@mysten/sui` 2.18 (PTBs, dry-run, sign) · `@mysten/deepbook-v3` (limit orders) · Cetus CLMM + Aggregator · Aftermath Router · NAVI + Suilend (lending) · `@mysten/suins` (native RPC resolution) · Wormhole (cross-chain redeem)

**Decentralized storage & privacy**
- **Walrus** (`@mysten/walrus` 1.1.7) — immutable receipts, profiles, passports, friend book
- **memwal** (`@mysten-incubation/memwal` 0.0.7) — eventually-consistent semantic memory layer
- **Seal** (`@mysten/seal` 1.2.0) — identity-based threshold encryption for personal conversation data

**On-chain (Move)**
- `dewlock_receipt` — on-chain receipt HEAD anchor
- `dewlock_seal` — account-based `seal_approve` access policy (only the owner address decrypts)

**Engineering**
- pnpm monorepo (Turborepo) · TypeScript · **620 passing unit tests** (Vitest) · deployed on Vercel with GitHub auto-deploy

```
apps/web        Next.js app (landing + /app copilot + /api routes)
packages/sui    PTB builders (transfer/swap/limit-order/lend/bridge), dry-run, sign, SuiNS, gas-safety
packages/agent  Guardian + Mastra agent + tools + deterministic intent layer
packages/walrus memwal memory + Walrus blob + receipt
move/           dewlock_receipt (receipt anchor) + dewlock_seal (access policy)
```

## 6. How It Works — Core Flows

### Flow A — Intent → safe execution (the heart)
1. **Intent.** You type "swap 5 SUI to USDC". A deterministic parser resolves the exact, allowlisted coin **types** (never the symbol) and emits a strong directive.
2. **Propose.** The Mastra agent calls `prepareTrade`, which builds **one unsigned PTB** via the protocol SDKs.
3. **Guard.** `guardianCheck` runs the 11-gate pipeline (below). Any failure → BLOCK with a plain-language reason; **no PTB ever reaches you on a block.**
4. **Preview.** On pass, you get `{ txBytes, approvedDigest, preview }`; the card shows real balance deltas, gas, and USD value **before** the confirm button.
5. **Sign (WYSIWYS).** Your wallet signs the literal bytes; a sign-time check asserts `sha256(signed) === approvedDigest`.
6. **Receipt.** `/api/receipt/stream` (SSE) publishes an immutable Walrus blob, logs XP, updates your passport, and anchors a Sui object — streamed live into a progress card.

### Flow B — The Guardian gate pipeline (deterministic, in order)
1. **Allowlist** — every MoveCall `{package::module::function}` must be pre-approved.
2. **Action-shape** — the PTB must match exactly one declared action template (no composing two allowlisted calls; one value action per PTB).
3. **Coin-type provenance** — `coinTypeIn/Out` verified on-chain via CoinMetadata (anti scam-clone).
4. **Injection provenance** — a `derived` recipient (from memory/pool data) triggers a confirm gate (anti prompt-injection).
5. **Trusted USD price** — real oracle; no price → BLOCK (can't value ⇒ can't verify).
6. **Server caps** — per-tx + per-day USD caps (server-authoritative, mainnet-small).
7. **SuiNS lookalike** — homoglyph-normalized edit-distance vs your verified contacts.
8. **Min-out re-derive** (swaps) — recompute min-output from on-chain decimals + the same route source (anti sandwich).
9. **Price-impact** (swaps) — block when output USD < input USD beyond the configured threshold (thin-liquidity / bad-rate protection).
10. **Orderbook / Lending** — POST_ONLY / self-match / expiry / BalanceManager-ceiling; lending is health-improving only.
11. **Dry-run + WYSIWYS digest + authoritative value** — dry-run the exact bytes; re-value from actual net balance deltas; block when the tx moves more than it declared.

### Flow C — The BLOCK theater (a feature, not a failure)
A deliberately unsafe intent (a SuiNS look-alike recipient + a tampered min-out) is **refused before a PTB exists**, and the refusal itself is written as an **immutable Walrus blob anchored on a Sui object** — verifiable proof that the firewall fired.

### Flow D — Seal-encrypted conversations
Your chat history is serialized, **encrypted client-side with Seal** (access bound to your wallet address via an on-chain `seal_approve` policy), and stored as opaque ciphertext on Walrus. Re-opening a thread costs one wallet signature to mint a session key and decrypt locally — **the server can never read your conversations.**

## 7. Status

- Core flow (track / transfer / swap / lend / limit-order / bridge), the security-verified Guardian, the BLOCK theater, Seal-encrypted conversations, and the receipt/passport pipeline are **implemented and unit-tested (620 tests)**.
- Running on **Sui mainnet** with small server-authoritative USD caps and **zero user-fund keys** server-side.
- Live at **https://dewlock.vercel.app**.

## 8. Try It (demo script)

1. Connect a Sui wallet on `/app`.
2. `show my portfolio` → live balances card.
3. `swap 1 SUI to USDC` → Guardian preview (deltas + gas + USD) → sign → receipt.
4. `send 1 SUI to <a .sui name>` → SuiNS resolution + confirm card.
5. Trigger a **block**: try a look-alike recipient or a bad-rate swap → see the fail-closed BLOCK (and its receipt).
6. Open `/protocols` → the public allowlist posture.
