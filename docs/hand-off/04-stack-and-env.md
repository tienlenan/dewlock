# 04 — Stack & Env (exact, from Daily Walrus)

Versions verified in the source repo (pnpm). Pin these to avoid SDK drift.

## Core dependencies

| Package | Version | Use |
|---|---|---|
| `@mysten/sui` | `2.17.0` | RPC client, Transaction builder, signing types |
| `@mysten/dapp-kit` | `^1` | Wallet connect + `useSignAndExecuteTransaction` (client signing) |
| `@mysten/walrus` | `1.1.7` | Blob writes via TS SDK (upload relay) |
| `@mysten-incubation/memwal` | `0.0.7` | Walrus Memory client |
| `@mastra/core` | `latest` (pin on init) | Agent + tools framework |
| `mastra` (dev) | `latest` (pin on init) | Mastra CLI/dev server |
| `@ai-sdk/gateway` | `latest` (pin) | Vercel AI Gateway provider (Gemini) |
| `zod` | `^3` | Tool input/output schemas |
| `@tanstack/react-query` | `^5` | required peer for dapp-kit |
| `react` / `react-dom` | `^19` | UI |
| `typescript` | `^5.6.3` | — |

New for this project (research in 06 before pinning):
- `@cetusprotocol/cetus-sui-clmm-sdk` — swap, add LP, create pool (testnet+mainnet).
- `@scallop-io/sui-scallop-sdk` — lending (mainnet only) — phase 2.
- NAVI SDK (`navi-sdk` / `@naviprotocol/...`) — lending alt — phase 2.
- `@mysten/suins` (SuiNS SDK) — name→address resolve.
- Confidential transfers SDK — from Sui's open-source repo (devnet) — phase 3.

Frontend swap vs Daily Walrus: that app used **Vite**; here use **Next.js (App Router)** + Vercel. dApp Kit + react-query setup is identical (client component).

**Framework choice = Mastra — rationale (see `11-agent-framework-comparison.md`):** chosen because it's TS-native and runs **in-process** in the same Next.js/Vercel runtime (zero IPC, single deploy, HITL in one codebase) — NOT because memwal forces TS. memwal is **polyglot**: official Python SDK (`pip install memwal`), official MCP server (`@mysten-incubation/memwal-mcp` + relayer SSE), and REST. Python frameworks (CrewAI/AutoGen/LangGraph-py/ADK/LlamaIndex) integrate cleanly but are rejected-for-now on KISS/runtime grounds (second runtime + cross-process). In-TS fallback if dropping Mastra: LangGraph.js or raw Vercel AI SDK.

## Node / package manager

- Node `>=20.9` (repo used `>=20.9`). pnpm `9.15.9`.

## Monorepo layout (recommended for new repo)

```
sui-defi-copilot/
├─ app/                      Next.js App Router (UI + API routes = agent)
│  ├─ (chat)/                chat UI, generative tx-preview cards
│  └─ api/agent/route.ts     Mastra agent endpoint (server-only secrets)
├─ lib/
│  ├─ sui/                   client, tx builders (transfer/swap/addLP), dry-run
│  ├─ walrus/                memory + blob (copy from Daily Walrus)
│  ├─ agent/                 Mastra agent + tools + allowlist
│  └─ suins/                 name resolution + spoof guard
├─ docs/                     ← this handoff kit
└─ ...
```
(Single Next.js app = shape A in 02. If splitting server, mirror `apps/web` + `apps/server`.)

## Environment variables

Server-only (never `NEXT_PUBLIC_`):
```
# LLM via Vercel AI Gateway
AI_GATEWAY_API_KEY=vck_xxx
AGENT_MODEL=google/gemini-2.5-flash      # or latest gemini flash

# Walrus Memory (memwal) — provision first (see 05)
MEMWAL_ACCOUNT_ID=
MEMWAL_DELEGATE_KEY=
MEMWAL_RELAYER_URL=https://relayer.memory.walrus.xyz

# Walrus Blob writes (server signer — ONLY for blob, never user funds)
WALRUS_SDK_WALLET_KEY=suiprivkey...
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-mainnet.walrus.space
WALRUS_UPLOAD_RELAY_DISABLED=false
WALRUS_UPLOAD_RELAY_TIP_MAX=10000000
WALRUS_BLOB_EPOCHS=12

# Sui networks
SUI_NETWORK=mainnet
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
SUI_DEVNET_RPC_URL=https://fullnode.devnet.sui.io:443   # confidential module
```

Client (public, no secrets):
```
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_AGENT_URL=/api/agent
NEXT_PUBLIC_EXPLORER_OBJECT_URL_TEMPLATE=https://suiscan.xyz/{network}/object/{id}
NEXT_PUBLIC_FEATURE_CONFIDENTIAL=false   # devnet feature flag
NEXT_PUBLIC_TX_USD_CAP=5                  # per-tx soft cap
```

## Gotchas captured

- Walrus SDK blob writes need the **upload relay** to finish inside serverless time limits (Vercel 60s). Keep relay enabled.
- `memwal` is incubation `0.0.7` — API may shift; the wrapper in 05 isolates it.
- dApp Kit requires a `QueryClientProvider` + `SuiClientProvider` + `WalletProvider` wrapper (client component).
