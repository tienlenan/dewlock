# 11 — Agent Framework × Walrus Memory Integration

Research (multi-agent workflow, 2026-06-15): which agent frameworks integrate with Walrus Memory (memwal), e.g. CrewAI. **Verdict: keep Mastra — but for the right reason (TS in-process), not because memwal forces TS.**

## Corrected fact (retire the old assumption)

**Walrus Memory is NOT TypeScript-only.** memwal is polyglot, all first-party from MystenLabs/MemWal:

| Surface | What | Auth |
|---|---|---|
| **TS/JS SDK** | npm `@mysten-incubation/memwal` 0.0.7 (current). Subpaths: `.`, `/manual`, `/account`, `/ai` (Vercel AI SDK `withMemWal` middleware) | Ed25519 delegate key + SEAL session |
| **Python SDK** | PyPI `memwal` 0.1.4 (MIT, py≥3.9, pure `httpx`+`PyNaCl`). Extras `memwal[langchain]`, `memwal[openai]`. Reimplements Ed25519 + SEAL session in pure Python — **no Node sidecar** | same |
| **MCP server** | npm `@mysten-incubation/memwal-mcp` 0.0.5 (`npx -y @mysten-incubation/memwal-mcp`) + relayer-native MCP-over-SSE (`/api/mcp/sse`). Tools: `memwal_remember/recall/analyze/restore/health`. Language-agnostic | Bearer delegateKey + `x-memwal-account-id` |
| **REST API** | relayer `POST /api/{remember,recall,analyze,restore,embed}`, `GET /health,/config`. Any language | per-request Ed25519 sign |

So **CrewAI (and any Python framework) CAN integrate cleanly** — via the official Python SDK or MCP, no bridge. The premise of the question is valid. The decision is therefore NOT "can it?" but "**is switching off Mastra worth it?**" — and the answer is no.

## Comparison matrix

| Framework | Lang | Walrus path | Effort | Verdict |
|---|---|---|---|---|
| **Mastra** (current) | TS | Direct in-process import (repo already does this). Wrap `remember()/recall()` in a tool / MemoryProcessor. **Avoid** MastraVector adapter (wants precomputed vector; memwal embeds server-side) | low | **KEEP** — same Node runtime as Next.js, zero IPC, batteries-included |
| Vercel AI SDK | TS | No memory model — call `recall()` before `generateText`, `rememberBulk()` after, in tool `execute()` | low | Lighter TS fallback; you rebuild retrieval/scoping yourself |
| LangGraph.js | TS | Custom `BaseStore`: `search(query)`→`recall` 1:1 (raw text, no vector) — cleanest structural twin | medium | Best in-TS fallback if dropping Mastra; more graph boilerplate |
| **CrewAI** | Python | `ExternalMemory(storage=custom)`→Python SDK `remember/recall`; or `memwal[langchain]`; or `memwal-mcp` via `crewai-tools[mcp]`. (Deep `StorageBackend` poor fit — wants `query_embedding`) | medium | **Skip** — clean now, but a separate Python service on a TS/Vercel stack |
| AutoGen / AG2 | Python | Subclass text-native `Memory` protocol: `query(text)`→`recall`. Python SDK or MCP | medium | Cleaner protocol than CrewAI, same Python-service cost. Only if already Python |
| LangGraph (Py) | Python | `BaseStore` awkward (needs exact get/delete/list memwal lacks). Better: LangMem tools | high | Weak fit + Python overhead. Skip |
| OpenAI Agents SDK | Py/TS | Do **not** back `Session` on memwal (needs lossless ordered transcript; memwal is lossy top-K). Use as a side recall tool only | high | Not a memory-framework replacement. Skip |
| Google ADK | Python (+TS/Go/Java) | Subclass `BaseMemoryService`, 2 methods: `search_memory(query)`→`recall`. **Best semantic fit** of Python set | medium | Strong shape, but Python service. Only if committing to ADK/Vertex |
| LlamaIndex | Python (TS thinner) | Custom `BaseMemoryBlock`: `_aget(query)`→`recall`. 2–3 methods, 1:1 | medium | Strong via memory-block; Python service. Note if RAG-heavy path emerges |

## Recommendation — KEEP Mastra

Switching to any Python framework buys almost nothing here and costs real infra:
- **Runtime:** Mastra imports memwal **in the same Node process** as Next.js/Vercel (repo already does it). A Python framework = second runtime, cross-process HTTP every agent turn, second deploy pipeline, second dep tree, second cold-start/observability surface. Opposite of KISS/YAGNI.
- **HITL DeFi:** approval gates + tx safety live in the Next.js UI/API. Same-TS-runtime keeps approve/reject synchronous in one codebase; a process boundary fragments it.
- **memwal fit in Mastra is already low-effort** (tool/MemoryProcessor over existing `remember()/recall()`).
- CrewAI's strength = multi-agent role crews — a problem we DON'T have (ADR 10: single agent + Guardian-as-code). The DeFi copilot is single-agent-with-tools.

Reconsider only if the project pivots to (a) heavy multi-agent orchestration Mastra can't express, or (b) a Python-first ML/RAG/backtesting tier.

- **Best non-Mastra (stay TS):** LangGraph.js (cleanest `BaseStore`↔`recall` match) or Vercel AI SDK (lightest).
- **Best Python (if a Python tier is ever added):** Google ADK (2-method `BaseMemoryService` = memwal's exact shape).

## New option worth noting: MCP

The official **memwal MCP** (`@mysten-incubation/memwal-mcp` / relayer SSE) means memory can be **exposed to / consumed by any MCP client** (Claude Desktop, Cursor, partner agents) without SDK code. Not needed for the hero (direct TS import is simpler), but a clean future surface if external agents must read/write this copilot's memory — and a nice "interoperable agent memory" talking point.

## Effect on prior decisions

- ADR 10 conclusion (Mastra, single-agent) **stands**. Correction: Mastra is chosen because it's **TS-native / in-process**, NOT because memwal forces TS (it doesn't). Python frameworks are recorded as *rejected-for-now on KISS/runtime grounds, not technical impossibility*.
- No code change — `packages/walrus/src/memwal-client.ts` pattern stays.

## Open questions

1. Any non-TS agent tier (Python research/backtesting) in scope? If yes, ADK/CrewAI move up.
2. Will any external MCP client need to read/write this copilot's memory? If yes, expose via memwal MCP now.
3. Hard requirement for multi-agent role orchestration Mastra can't express? (Only scenario justifying CrewAI's cost.)
