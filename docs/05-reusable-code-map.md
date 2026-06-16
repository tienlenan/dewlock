# 05 — Reusable Code Map (copy from Daily Walrus)

Paths below are in the source repo `walrus-memory-world-cup/`. Copy + adapt. Each entry: what it is, why reuse, how to adapt.

## A. Walrus Memory — COPY almost as-is

**Source:** `packages/walrus/src/memwal-client.ts` (+ `index.ts` re-export).
Clean wrapper over `@mysten-incubation/memwal`: `isMemoryEnabled`, `memNamespace`, `remember`, `rememberBulk`, `recall`, `memoryHealth`. Namespace-cached clients.

Adapt: rename namespace prefix `daily-walrus:` → `defi-copilot:`. Namespace per user = wallet address. Provision via `packages/walrus/scripts/provision-memwal.ts` (copy it) to get `MEMWAL_ACCOUNT_ID` + `MEMWAL_DELEGATE_KEY`.

> ⚠️ **CORRECTION (do not pitch wrong):** memwal is the **MUTABLE** memory layer. Tamper-evidence / immutability comes from the **Walrus Blob + a Sui-object HEAD pointer** (`docs/06-research-notes.md:48`), NOT from memwal. Never put "memwal is tamper-evident" on a slide.
> The wrapper exposes ONLY `isMemoryEnabled / memNamespace / remember / rememberBulk / recall / memoryHealth` — **no grant/share/ACL/owner**. Any "portable / shareable / Sui-gated memory ownership" feature needs net-new access-control plumbing; do not pitch it unless built. See `12-innovation-and-gamification-strategy.md`.

Pattern (verbatim shape):
```ts
export function memNamespace(walletAddr: string) { return `defi-copilot:${walletAddr}`; }
await remember(ns, "User risk profile: conservative, max 20% volatile.");
const hits = await recall(ns, "what is the user's risk tolerance?", 5);
```
Use cases here: risk profile, named contacts ("888.sui = cold wallet"), decision log + rationale, recurring intents.

## B. Walrus Blob writes — COPY + simplify

**Source:** `packages/walrus/scripts/{smoke-memory,health}.ts` and **`apps/server/src/services/walrus-blob.ts`** (the actual blob write impl: SDK + upload relay + aggregator read). Also `briefing-publisher.ts` shows the publish flow end-to-end.

Adapt: strip briefing/WC specifics. Keep: write JSON payload → blobId; read by blobId via aggregator. Use for **action receipts**: `{ txDigest, action, args, dryRunEffects, agentReasoning, ts }`. Write **after** sign (async; never block UX).

## C. Mastra agent + tools — COPY pattern

**Source:** `apps/server/src/mastra/agents/gil.ts`, `apps/server/src/mastra/tools/get-fixtures.ts`, `apps/server/src/mastra/index.ts`.

Agent pattern (adapt persona + tools):
```ts
import { Agent } from "@mastra/core/agent";
import { createGateway } from "@ai-sdk/gateway";
const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
export const copilot = new Agent({
  id: "copilot", name: "Sui DeFi Copilot",
  instructions: COPILOT_PERSONA + TOOL_USE_RULES + SECURITY_RULES,
  model: gateway(process.env.AGENT_MODEL ?? "google/gemini-2.5-flash"),
  tools: { getPortfolio, buildTransfer, buildSwap, buildAddLp },
});
```

Tool pattern (zod in/out — enforces typed, bounded args = injection defense):
```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
export const buildTransfer = createTool({
  id: "build-transfer",
  description: "Build an UNSIGNED transfer PTB. Does NOT sign. Returns tx bytes + preview.",
  inputSchema: z.object({
    token: z.string().describe("coin TYPE 0x..::mod::SYMBOL, not display symbol"),
    amount: z.string().describe("human amount, validated against balance"),
    to: z.string().describe("0x address or NAME.sui"),
  }),
  outputSchema: z.object({ txBytes: z.string(), preview: z.object({/*…*/}) }),
  execute: async ({ context }) => { /* resolve, build PTB, dryRun, return */ },
});
```
Key change vs Gil: tools **build transactions**, they do not move funds. Signing is client-side.

## D. Client-side signing — COPY the pattern

**Source:** `apps/web/src/lib/sui-output-record.ts` — the gold reference for **build → sign → read effects**:
- `useSignAndExecuteTransaction({ execute })` with `showRawEffects/showObjectChanges/showEvents`.
- `stableJson` + `sha256Hex` (content hashing for receipts) — reuse verbatim.
- Reading object changes from the result.

Adapt: instead of `buildSubmitOutputRecord`, plug in transfer/swap/addLP tx builders. Add a **dry-run preview step before `mutateAsync`** (new — Daily Walrus didn't need it; we do for security).

## E. Wallet providers — COPY

**Source:** `apps/web/src/wallet-providers.tsx`, `app-providers.tsx`, `components/connect-bar.tsx`, `lib/wallet-session.ts`, `lib/use-sui-gas-balance.ts`.
`createNetworkConfig` + `SuiClientProvider` + `WalletProvider autoConnect`. Convert to a Next.js `"use client"` provider wrapped in `QueryClientProvider`.

## F. Shared types / persona — REFERENCE

**Source:** `packages/shared/src/{gil-persona,types,index}.ts`. Pattern for a stable persona constant + shared types. Write a fresh `COPILOT_PERSONA`.

## What NOT to reuse

- WC/fixtures/predictions/roast logic, Move `prediction_game.move`, Supabase WC tables, the newspaper/troll **design** (build fresh — see 08), Walrus Sites deploy (we use Vercel).

## Copy checklist

- [ ] `memwal-client.ts` (+ provision script) → `lib/walrus/memory.ts`
- [ ] `walrus-blob.ts` → `lib/walrus/blob.ts` (receipts)
- [ ] Mastra agent + tool pattern → `lib/agent/*`
- [ ] `sui-output-record.ts` (stableJson, sha256Hex, sign hook) → `lib/sui/sign.ts`
- [ ] wallet providers → `app/providers.tsx`
