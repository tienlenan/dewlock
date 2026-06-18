# 02 — System Architecture

## Components

```
User (Sui wallet) ──► Next.js app (Vercel)
                          │  chat UI + generative tx-preview cards (signing here)
                          ▼
                  Mastra agent (Next.js API route or separate server)
                   ├─ tools: track, transfer, swap, addLP, (confidential)
                   ├─ Walrus Memory  (risk profile, contacts, decision log)
                   ├─ Walrus Blob    (immutable action receipts + reasoning)
                   └─ returns UNSIGNED PTB bytes + human-readable preview
                          │
        ┌─────────────────┼───────────────────────┐
        ▼                 ▼                         ▼
   Sui mainnet RPC   Protocol SDKs            SuiNS resolver
   (read balances)   (Cetus / NAVI / Scallop) (.sui → 0x)
        │
        ▼
   dryRunTransactionBlock → preview effects → USER SIGNS in wallet → execute
```

**Agent topology (decided — see `10-agent-orchestration-decision.md`):** ONE conversational Copilot agent + **Guardian-as-code** (deterministic gate inside `prepareTrade`) + existing wallet HITL. NOT a peer-agent swarm; NOT Mastra suspend/resume for the hero. The agent builds an unsigned PTB → `guardianCheck()` (code) → user signs. An optional single LLM "second-opinion" critic is garnish, not load-bearing. This is enough to earn the "Agentic Web" narrative (NL→mainnet action + visible guardian block) without orchestration plumbing.

Two deployment shapes (pick in planning):
- **A. Single Next.js app** — agent in Route Handlers / Server Actions. Simpler, one deploy. Recommended for hackathon.
- **B. Next.js web + separate Mastra server** — mirrors Daily Walrus (`apps/web` + `apps/server`). More moving parts; only if agent needs long-running jobs.

## Agentic action pipeline (core loop)

1. **NL intent** — user message → agent tool-call with structured args `{action, amount, token, target}`.
2. **Resolve & enrich** — SuiNS `.sui`→0x; swap quote/slippage; LP tick range; balance checks.
3. **Build unsigned PTB** — only from an **allowlisted** set of contract calls (see 03).
4. **Dry-run** — `dryRunTransactionBlock` → compute balance changes, gas, slippage.
5. **Human confirm** — generative UI card shows: action, amount, USD value, **raw 0x target** (not just name), expected effects → user clicks → wallet signs.
6. **Execute + persist** — wallet executes; write receipt blob (digest + reasoning snapshot) to Walrus; update memory (decision + rationale).

Where signing happens: **client only**, via `@mysten/dapp-kit` `useSignAndExecuteTransaction` (pattern proven in Daily Walrus `sui-output-record.ts`). The agent/server returns tx bytes or a tx-builder spec; it never signs.

## Generative UI

Chat responses carry structured tool-call parts → rendered as: portfolio card, tx-preview card (with dry-run effects + confirm button), receipt card (blob link + tx digest). Mirrors Daily Walrus chat-render-parts approach.

## Data flow — read vs write

- **Read** (free, safe): RPC `getAllBalances`, `getOwnedObjects`; protocol SDK position queries; Cetus pool/price; SuiNS resolve. Can read mainnet freely.
- **Write** (value-moving): always PTB → dry-run → human sign. Never automatic.

## Network routing

- Core (track/transfer/swap/LP): **mainnet** (`fullnode.mainnet.sui.io`).
- Confidential module: **devnet** — separate `SuiClient`, separate network badge in UI, feature-flagged.
- Testnet: dev/CI sandbox; self-seed Cetus pool for integration tests (see 06).

## State / persistence

- **Walrus Memory** = durable user knowledge (cross-session).
- **Walrus Blob** = immutable receipts/snapshots.
- Optional lightweight cache/index (Supabase or none): only if portfolio history UI needs fast reads. YAGNI for hero — RPC reads are enough at small scale.
