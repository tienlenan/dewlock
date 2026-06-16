# 10 — Agent Orchestration Decision (ADR)

Decision: **single conversational agent + Guardian-as-code + wallet HITL.** NOT a multi-agent peer swarm. NOT Mastra suspend/resume backbone for the hero.

Source: multi-agent workflow (scout repo + research Mastra + research agentic-DeFi patterns → synthesize → adversarial red-team, 2026-06-15). Red-team verified claims against actual repo files; verdict = **SIMPLIFY**.

## Question

Should the DeFi Copilot be multi-agent / orchestrator? Is orchestration already present?

## Findings

- Existing repo "Daily What's Up" multi-agent is **choreography** (plain async fns in `apps/server/src/services/daily-briefing-workflow.ts` + `traced()` helper), **NOT a Mastra `createWorkflow`**. The chat agent (`gil`) is **single-agent + 2 tools**. No `createWorkflow`/`suspend`/`resume` anywhere; `@mastra/core` is `latest` (unpinned); **no Mastra storage adapter installed** → durable suspend/resume is unproven on Vercel.
- Production agent-wallets (MetaMask Agent Wallet + Blockaid) put safety **structurally outside the agent** with deterministic checks. That, not "many LLMs talking", is the security pattern.
- A supervisor/worker swarm buys decision-quality, not safety; adds 100–500ms/hop, coordination edges, demo-crash vectors. Over-engineering for a small-amount mainnet hackathon.

## Decision (what to ship)

| Actor | What it is | Notes |
|---|---|---|
| **Copilot agent** | 1 Mastra Agent (clone `gil.ts`), chat + Walrus Memory | Holds **0 user-fund keys**. Read tools + `prepareTrade` tool. The "agentic" face. |
| **Read tools** | `getQuote`, `getPositions`, `resolveSuiNS` (clone `get-fixtures.ts`) | Safe for LLM to call freely. |
| **`prepareTrade` tool** | Builds unsigned PTB, then calls `guardianCheck()` **internally** | Extends `packages/contract/src/transactions.ts` builder pattern with `buildTransfer`/`buildSwap`/`buildAddLiquidity`. Returns no PTB on block. |
| **Guardian = ordinary code** | Deterministic, fail-closed gates | **The security headline.** See below. |
| **Wallet HITL** | Reuse `apps/web/src/lib/sui-output-record.ts` verbatim | User signs in own wallet. Proposal UI green/red badges. **No Mastra suspend/resume.** |
| **Walrus receipt** | `publishJsonBlob(proposal + verdict + digest)` + `traced()` audit | Tamper-evident provenance. |
| **LLM critic** | OPTIONAL one call, "second opinion" badge | **Garnish, not load-bearing. First thing to cut.** |

### Guardian gates (all deterministic, code, LLM cannot override, run first, short-circuit)
- Package/protocol allowlist = **exactly {Cetus pkg(s), SuiNS pkg, user's own address}**.
- Recipient ∈ {own addr, allowlist}.
- Per-tx cap + rolling-daily cap (SUI/USD) — **user-chosen numbers**.
- Min-amount-out re-derived from a **fresh** quote vs stated slippage.
- Coin-**TYPE** check (not ticker — Sui symbols not unique → spoof vector).
- SuiNS lookalike/typo check (edit-distance).
- **`devInspect`/`dryRun` delta check, fail-CLOSED on dry-run error** (naive impl fails open = bypass).

## Why this still earns "Agentic Web"

Judges need to SEE: (1) natural language → real mainnet action; (2) an independent gate visibly refusing a bad tx (red path: typo recipient / 30% slippage / off-allowlist → BLOCK with reasons). One agent + a named guardian module delivers both. They cannot tell (and it doesn't matter) whether the guardian is a "separate agent" or a function.

## Red-team corrections to earlier synthesis (adopted — new verified data)

1. **LLM Guardian critic is not load-bearing safety** and adds a prompt-injection surface (attacker → `approve`). Deterministic gates + 0-key + wallet-sign carry 95%+ of protection. The "adversarial-critic improves accuracy" study is a category error (tx safety HAS a deterministic oracle; that study's domain did not).
2. **Real money risk = Cetus decimals/min-out math**, not topology. Validate with on-chain dry-run before trusting any "approve".
3. **"0 keys" must be scoped to user funds.** Server holds operational keypairs (oracle/admin/walrus-publish: `score-keeper.ts`, `briefing-publisher.ts`, `walrus-blob.ts`). Pitch precisely: "never holds *user* keys."
4. **Reuse story ~60% real.** Reusable: unsigned-PTB pattern, wallet HITL, `createTool` shape, `publishJsonBlob`, `traced()`. **Net-new long poles: Cetus/SuiNS builders, dry-run gate, (if kept) Mastra workflow durability.** Don't plan as if these are solved.

## Failure modes of the rejected (heavier) topology

Unproven Mastra suspend/resume on Vercel with no storage adapter → resume 404s after user signs; coin-type/decimals bug passes guardian but executes bad swap; dry-run fail-open bypass; critic injection returns approve; schema/handoff breaks on unpinned `@mastra/core: latest`; "0 keys" overclaim punctured by a judge.

## Defer (do NOT build for hero)

Market-scout as separate agent (fold one Cetus-quote into `prepareTrade`); gas/MEV/multi-DEX routing; cross-vendor critic model; jaccard proposal dedup; **the entire Mastra multi-agent/workflow/suspend-resume backbone**. Promote to real `createWorkflow` only post-hackathon if async, survives-restart approvals are ever needed.

## Amendment (2026-06-15) — framework rationale

Conclusion (Mastra, single agent) stands. Correction to the *why*: Mastra is chosen for being **TS-native / in-process** in the Next.js/Vercel runtime — **not** because Walrus Memory forces TS. memwal is polyglot (official Python SDK + MCP + REST), so CrewAI/LangGraph-py/AutoGen/ADK/LlamaIndex are technically integrable; rejected-for-now on KISS/runtime grounds (second runtime + cross-process + HITL fragmentation), not impossibility. In-TS fallback = LangGraph.js / Vercel AI SDK. Full analysis: `11-agent-framework-comparison.md`.

## Open questions

1. Cetus depth: live SDK/aggregator quotes, or a single hardcoded pool-id for the demo? (the actual long pole)
2. Guardian caps: exact per-tx + daily SUI/USD limits (business decision).
3. Critic: same model reject-prompt (hero) vs different vendor (stronger story, extra config)?
4. Cetus/SuiNS transitive `@mysten/sui` version vs pinned `2.17.0` — confirm interop.
5. Allowlist confirmed exactly {Cetus, SuiNS, own addr} for hero.
