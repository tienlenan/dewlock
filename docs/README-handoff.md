# Sui DeFi Copilot — Handoff Kit

Self-contained bootstrap package for the **new repo**. Copy this whole folder → new repo `docs/`. Goal: zero re-research — stack versions, env, reusable code map, protocol integration, deployment all captured here.

## What this is

Chat-driven **agentic DeFi copilot on Sui**. Reads portfolio → explains/warns → builds the transaction → **user signs in wallet**. Agent never holds keys. Persistent memory + auditable receipts on Walrus. Next.js on Vercel.

Source of patterns: the **Daily Walrus** repo (`gil-var-shamebook` / World Cup) — proven Walrus Memory, Walrus Blob, Mastra agent, Sui dApp Kit signing. This kit extracts what to copy.

## Files

| File | Purpose |
|---|---|
| `01-product-overview-pdr.md` | Problem, hero, scope, decisions, success metrics |
| `02-system-architecture.md` | Components, agentic action pipeline, data flow |
| `03-security-model.md` | The differentiator — human-in-the-loop, allowlist, dry-run, anti-injection |
| `04-stack-and-env.md` | Exact dep versions, env vars, monorepo layout |
| `05-reusable-code-map.md` | File-by-file: what to copy from Daily Walrus + snippets + adaptation |
| `06-protocol-integration.md` | Cetus / NAVI / Scallop / SuiNS / Confidential — SDKs, networks, faucets, gotchas |
| `07-deployment-guide.md` | Vercel + Walrus relay + secrets |
| `08-design-direction.md` | DeFi copilot UI (fresh — NOT the WC troll theme) |
| `09-implementation-phases.md` | Phase breakdown → feed to `/ck:plan` in new repo |
| `10-agent-orchestration-decision.md` | **ADR**: single agent + Guardian-as-code (NOT multi-agent swarm); red-team-verified |
| `11-agent-framework-comparison.md` | Framework × Walrus Memory: memwal is polyglot (Python SDK + MCP + REST); keep Mastra (TS in-process), CrewAI = skip |
| `12-innovation-and-gamification-strategy.md` | Win strategy: pure-innovation hero (Guardian Dry-Run Theater) + 1 memory-native beat (Conviction Streak); a bolt-on game DILUTES — all games cut |
| `13-defi-core-recenter-decision.md` | **AUTHORITATIVE hero framing** — DeFi=core/memwal=side; hero = Guardian correctness + DeepBook limit-order; best-ex=stretch; supersedes 01/09 hero framing |
| `14-product-naming.md` | Working name **Dewlock** (runner-up Dewpoint); Sui droplet/pastel theme; logo + avoid-list + verification checklist (TM/WHOIS not yet run) |

## Quick start in new repo

1. `git init` new repo; copy this folder → `docs/`.
2. Scaffold Next.js (App Router) + Mastra server (see `04-stack-and-env.md`).
3. Copy reusable files per `05-reusable-code-map.md` (memory, blob, agent, signing).
4. Wire env per `04` + `07`.
5. Run `/ck:plan docs/09-implementation-phases.md` to generate the executable plan.

## Locked decisions (do not re-litigate)

- Custody: **human-in-the-loop** (agent builds unsigned PTB, user signs).
- Network: **mainnet, tested with small portfolio**; **devnet** for confidential (isolated, feature-flag); testnet = dev sandbox only.
- Hero: track + transfer (SuiNS) + swap + add LP (Cetus). Lending (NAVI/Scallop) = later phase.
- Frontend: **new repo**, Next.js / Vercel.
- Walrus: Memory (profile/contacts/decision log) + Blob (immutable action receipts).
- Agent topology: **single Copilot agent + Guardian-as-code + wallet HITL** (NOT a multi-agent swarm, NOT Mastra suspend/resume for hero) — see `10`.

## Open questions to close before/during planning

1. Product/agent persona name + brand.
2. Target hackathon/track + deadline.
3. Mainnet per-tx cap (e.g. ≤ $5).
4. Lending: NAVI, Scallop, or both for the demo.
5. New repo GitHub org + slug.
