# Dewlock — Technical Architecture & Design

> **Last updated:** 2026-06-16 · **Design phase:** Live implementation verified against code

---

## Monorepo Structure

```
sui-overflow-2026-hackathon/
├── apps/
│   └── web/                           # Next.js 16 (App Router), Vercel
│       ├── app/
│       │   ├── page.tsx               # Landing page (/) — light default
│       │   ├── app/
│       │   │   └── page.tsx           # Copilot shell (/app) — dark default
│       │   ├── brand-design/
│       │   │   └── page.tsx           # Design tokens styleguide
│       │   ├── api/
│       │   │   ├── agent/route.ts     # POST /api/agent (Mastra + Gemini)
│       │   │   └── prepare-trade/route.ts # POST /api/prepare-trade (sync fallback)
│       │   ├── globals.css            # Design system (tokens, custom properties)
│       │   ├── layout.tsx             # Root (fonts, providers, next-themes)
│       │   └── providers.tsx          # QueryClient, SuiClientProvider, WalletProvider
│       ├── components/
│       │   ├── landing/               # Landing sections (11 files, 37 total components)
│       │   ├── app/                   # Copilot shell, sidebar, header, theme toggle
│       │   ├── chat/                  # ChatThread, ChatInput, useCopilotChat hook
│       │   ├── ui/                    # shadcn/ui buttons, cards, input, etc.
│       │   └── ...
│       ├── lib/
│       │   ├── agent/                 # Agent-related: Guardian, tools
│       │   ├── sui/                   # Sui utilities: sign.ts, tx builders
│       │   ├── walrus/                # Walrus memory + blob wrappers
│       │   ├── hooks/                 # useSuiGasBalance, useSignAndExecuteTx
│       │   └── utils.ts               # formatMistAsSui, shortAddress, etc.
│       ├── public/                    # Static assets (favicons, brand logo)
│       └── package.json
│
├── packages/
│   ├── agent/                         # Core agent + Guardian logic
│   │   ├── src/
│   │   │   ├── guardian.ts            # Guardian spine (610 LOC, 9 gates, fail-closed)
│   │   │   ├── guardian-gates.ts      # Helper functions per gate (isTargetAllowed, etc.)
│   │   │   ├── allowlist.ts           # ALLOWED_MOVE_TARGETS, COIN_DECIMALS, getTrustedUsdPrice
│   │   │   ├── agent.ts               # Mastra agent definition + tools
│   │   │   ├── tools/
│   │   │   │   ├── prepare-trade.ts   # Tool: build PTB, invoke Guardian
│   │   │   │   └── get-portfolio.ts   # Tool: fetch balances + LP positions
│   │   │   └── __tests__/             # 7 hard-gate unit test suites
│   │   └── package.json
│   ├── sui/                           # Sui-specific builders + utilities
│   │   ├── src/
│   │   │   ├── dry-run.ts             # dryRunTransaction() wrapper
│   │   │   ├── build-transfer.ts      # buildTransfer PTB (SuiNS resolve, tx)
│   │   │   ├── build-swap.ts          # buildSwap PTB (Cetus quote, swap)
│   │   │   ├── quotes-source.ts       # fetchSwapQuote (Cetus SDK isolation)
│   │   │   └── index.ts               # Re-exports
│   │   └── package.json
│   └── walrus/                        # Walrus memory + blob wrappers
│       ├── src/
│       │   ├── memory.ts              # Walrus memory session API
│       │   ├── blob.ts                # Walrus blob (immutable receipt storage)
│       │   └── types.ts
│       └── package.json
│
├── .claude/rules/                     # Agent orchestration rules (skill routing, workflows)
├── docs/                              # Handoff kit (01-14*.md, original spec)
├── docs/docs/                         # LIVING DOCS (this directory)
│   ├── current-status.md              # What's built, what's live, what's deferred
│   ├── requirements.md                # Functional + non-functional req tracking
│   └── technical-design.md            # This file
├── plans/                             # Implementation phase files
├── pnpm-workspace.yaml                # Workspace config
└── README.md                          # Root project guide

**Deployment:**
- `apps/web` → Vercel (auto-HTTPS, region HA, serverless functions)
- Environment vars: Sui RPC, Gemini API key, Walrus relayer, cap thresholds
- No custom server; all logic serverless via Next.js route handlers
```

---

## Package Responsibilities

### `apps/web` (Next.js 16, Tailwind v4, shadcn/ui)

**Purpose:** Single user-facing web app (landing + copilot).

**Key decisions:**
- **Single Next.js app** (shape A from 02 ADR): landing + copilot under one origin simplifies CORS, auth, and deployment.
- **App Router** (not Pages): native `app/api/` routes, streaming SSE for agent, async Server Components.
- **Tailwind v4** with CJS dist for Turbopack compatibility (lazy Cetus SDK import to avoid bundle bloat).
- **shadcn/ui** for unstyled Button, Card, Input components; Dewlock tokens override default colors.
- **next-themes** for landing dark mode (global `<html class="dark">`); copilot uses local `useAppTheme` hook (isolated to `/app` subtree).
- **TypeScript strict** (no `any`, `@ts-ignore` suppressed → error on build).

**Entry points:**
- `app/page.tsx` — Landing, light-default
- `app/app/page.tsx` — Copilot shell, dark-default
- `app/brand-design/page.tsx` — Styleguide

**API routes (serverless):**
- `app/api/agent/route.ts` — POST; Mastra streaming agent; rate-limited
- `app/api/prepare-trade/route.ts` — POST; deterministic Guardian (demo fallback)

---

### `packages/agent` (Core security & orchestration)

**Purpose:** Guardian security spine + Mastra agent definition + tools.

**Guardian (`guardian.ts`, ~1.4k LOC):**

`guardianCheck(proposal, suiClient)` runs deterministic, fail-closed gates in this order, accumulating `reasons[]`/`gates[]`; ANY failing gate blocks (terminal, no auto-retry):

```
TradeProposal (unsigned PTB + user context)
  ↓
1. checkAllowlist()        → every {pkg::mod::fn} in ALLOWED_MOVE_TARGETS? (runs first)
2. checkActionShape()      → PTB MoveCall set == EXACTLY one actionType template?
                             (blocks "compose two allowlisted calls" ⇒ one action per PTB)
3. checkCoinTypeOnChain()  → on-chain CoinMetadata exists for coinTypeIn/Out? (by TYPE, not symbol)
4. checkProvenance()       → per-field argProvenance; "derived" recipient ⇒ confirm gate
5. trusted USD price       → real oracle (SUI/USD, USDC=$1); no price ⇒ block
6. server caps             → estimatedUsd ≤ TX_USD_CAP and daily+est ≤ DAILY_USD_CAP? (bad cfg ⇒ block all)
7. checkSuiNSLookalike()   → homoglyph-normalized edit-distance vs verifiedContacts
8. checkMinOut()           → (swaps) re-derive min-out from on-chain decimals + SAME route source
9. orderbook / lending     → limit_order: POST_ONLY/self-match/expiry; lend_*: health-improving only
10. runDryRunGate()        → dry-run EXACT bytes (fail-closed); approvedDigest = SHA-256(txBytes)
11. authoritative value    → re-value from ACTUAL dry-run net outflow; re-check caps;
                             block if outflow > 1.5× declared (outflow_mismatch)
  ↓
GuardianResult { ok: true, txBytes, approvedDigest, dryRunResult, preview }
  OR  { ok: false, reasons[], gates[] }
```

**Key features:**
- No LLM involvement; code is the gate. The LLM only proposes; the Guardian re-derives independently.
- Fail-closed on EVERY external dep (RPC, quote, SuiNS, price, cap config) — never "proceed because unavailable".
- `dryRunTransactionBlock` runs inside the Guardian; effects (balance deltas + gas + USD) visible before the user signs.
- WYSIWYS: `approvedDigest = sha256(txBytes)` binds preview ⇄ signature; the sign hook asserts equality.
- Defense-in-depth: "moves more than declared" is caught independently at gates 1, 2, and 11.
- TS strict; unit tests per gate; hard-gate suites in `__tests__/`.

**Allowlist (`allowlist.ts`):**

```typescript
ALLOWED_MOVE_TARGETS = Set [
  // Cetus CLMM
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7c9881aea08::router::swap",
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7c9881aea08::router::swap_exact_coin_a_for_coin_b",
  // ... more Cetus funcs
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7c9881aea08::pool::add_liquidity",

  // SuiNS (read-only)
  "0xd22b24490e146521c7f63c2d96c53f8f6575d74cebf8b4548c8b1166a09036bc::suins::query",

  // Coin transfer
  "0x2::coin::transfer",
  "0x2::coin::transfer_public",
]

COIN_DECIMALS = {
  "0x0000...::sui::SUI": 9,
  "0xdba3...::usdc::USDC": 6,
  "0x375f...::usdt::USDT": 6,
  // ... curated
}

getTrustedUsdPrice(coinType) → number | null
  // Hardcoded refs for demo; no oracle
```

**Mastra agent (`agent.ts`):**

```typescript
Agent {
  system: "You are Dewlock, a DeFi copilot...",
  tools: [prepareTrade, getPortfolio],
  model: "gemini-2.0-flash" (via @ai-sdk/gateway),
}
```

- Single-turn; no suspension or memory loops.
- System prompt emphasizes "show exact bytes before sign".
- Tools return Zod-typed JSON; agent shapes into prose + card render hints.

**Tools:**
- `prepareTrade({ walletAddress, actionType, coinTypeIn, ... })` — build & validate PTB; run Guardian; return PTB or block reason.
- `getPortfolio({ walletAddress })` — fetch balances (by coin type) + Cetus LP positions; return portfolio card data (stub in P1).

---

### `packages/sui` (Sui SDK wrappers)

**Purpose:** Isolate Cetus + Sui builders from the agent; lazy-load to avoid bundle bloat.

**dry-run.ts:**
```typescript
dryRunTransaction(
  client: SuiClient,
  txBytes: string,
  walletAddress: string
): Promise<DryRunResult | null>
  // Calls devInspect; returns balance deltas, gas, effects
  // Throws on error (fail-closed by Guardian)
```

**build-transfer.ts:**
```typescript
buildTransfer({
  walletAddress,
  recipientInput, // 0x... or .sui name
  coinType,
  amountNative,
}): Promise<{ txBytes, recipientAddress }>
  // SuiNS resolve (if .sui name)
  // Build coin::transfer PTB
  // Return base64 txBytes (unsigned)
```

**build-swap.ts:**
```typescript
buildSwap({
  walletAddress,
  coinTypeIn,
  coinTypeOut,
  amountInNative,
  slippageBps,
}): Promise<{ txBytes, quote }>
  // Fetch Cetus quote (via quotes-source)
  // Compute min-out + slippage
  // Build swap PTB
  // Return txBytes + quote metadata
```

**quotes-source.ts:**
```typescript
fetchSwapQuote({
  a: CoinType,
  b: CoinType,
  amount: bigint,
  byAmountIn: boolean,
}): Promise<SwapQuote>
  // Uses CetusSDK aggregator or hardcoded pool fallback
  // Lazy-loaded to avoid bundle bloat
  // Throws on unavailable (Guardian catches, blocks)
```

---

## Pipeline: NL → WYSIWYS Sign

```
┌─────────────────────────────────────────────────────────────────┐
│ User types: "swap 10 SUI for USDC"                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ /app (client):                                                  │
│ ChatInput.tsx → POST /api/agent { message, walletAddress }     │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ /api/agent/route.ts (server):                                   │
│ 1. Zod validate input                                           │
│ 2. Stream Mastra agent                                          │
│ 3. Agent interprets intent → tool call: prepareTrade(...)      │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ prepareTrade() tool (in Guardian scope):                         │
│ 1. buildSwap() → { txBytes, quote }                            │
│ 2. Invoke guardianCheck(txBytes, ...)                          │
│ 3. If block: return GuardianBlock { reason }                   │
│ 4. If pass: compute WYSIWYS digest, return GuardianPass        │
│    { txBytes, approvedDigest, dryRunResult }                   │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Agent formats response:                                          │
│ "Here's your swap. Dry-run shows..."                           │
│ [card: { kind: "swap", txBytes, approvedDigest, dryRunResult }]│
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ /app (client):                                                  │
│ ChatThread renders card                                         │
│ TxPreviewCard.tsx shows:                                        │
│   - Action: "Swap 10 SUI → ~1234 USDC"                         │
│   - Dry-run: "Balance delta: -10 SUI, +1234 USDC, gas -0.01"  │
│   - Digest shown (truncated) for transparency                  │
│   - [Confirm & Sign] button enables                            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ User clicks [Confirm & Sign]:                                   │
│ useSignAndExecuteTx hook (from dApp Kit):                       │
│ 1. Decode txBytes (base64 → Uint8Array)                        │
│ 2. Open wallet for signature                                   │
│ 3. Wallet returns signedBytes                                  │
│ 4. Compute digest(signedBytes) → actualDigest                  │
│ 5. Assert actualDigest === approvedDigest                      │
│ 6. If match: mutate wallet RPC to execute                      │
│ 7. If mismatch: throw; tx never sent                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ On success:                                                      │
│ 1. Show receipt card: "✓ Swap executed. Tx: 0xabc..."          │
│ 2. Async: write Walrus blob (immutable receipt)                │
│ 3. Async: update memory (swap history, contacts)               │
│ 4. Sidebar: add to session history                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design System & Theming

**File:** `apps/web/app/globals.css` (150+ LOC custom properties)

### Token Architecture

**Light-default (root):**
```css
--bg: hsl(205 38% 99%);           /* cool near-white canvas */
--fg: hsl(213 24% 13%);           /* ink text */
--accent: hsl(206 90% 48%);       /* Sui sky-blue primary */
--accent-soft: hsl(205 100% 95%); /* sky tint for badges, subtle BGs */
```

**Dark (.dark):**
```css
/* Flips to cool slate ink + lifted blue */
--bg: hsl(217 28% 12%);
--fg: hsl(205 30% 95%);
--accent: hsl(204 93% 56%);
```

**Always-dark panels** (invariant across light/dark):
```css
--bg-dark: hsl(215 40% 8%);
--bg-ink: hsl(217 38% 11%);
--border-dark: hsl(217 28% 18%);
--fg-inverse: hsl(205 25% 96%);   /* text on always-dark panels */
```

### Per-Route Theming

**Landing (`/`):**
- Default light (next-themes + `<html class="">`)
- Dark mode: `<html class="dark">` (affects all CSS custom properties)
- Pastel wash backdrop (3 radial gradients, fixed behind everything)
- Sections use canvas + always-dark panels mix

**Copilot (`/app`):**
- Default dark (local state via `useAppTheme`)
- Stored in localStorage `dewlock-app-theme`
- Theme toggle (dark/light) in header
- Does NOT affect landing (`.dark` class on copilot root `<div>`, not `<html>`)
- Dark backdrop; minimal pastel

### Semantic Tokens

| Token | Usage | Light | Dark |
|-------|-------|-------|------|
| `--success` | Balance gains, price up | hsl(143 72% 35%) | hsl(143 75% 45%) |
| `--warning` | Gas, slippage, price down | hsl(38 92% 44%) | hsl(38 95% 55%) |
| `--border` | Canvas edges, input focus | hsl(205 24% 90%) | hsl(217 28% 22%) |

### Typography

**Fonts (wired in `layout.tsx` via next/font/google):**
- **Display:** Plus Jakarta Sans (400, 500, 600, 700)
- **Mono:** JetBrains Mono (400, 500) — addresses, tx digests, code blocks

**Sizing:**
- Base: 16px (1rem)
- Headings: fluid clamp (1.5rem–3rem)
- Body: 1rem
- Small: 0.875rem (captions, badges)

---

## Data Persistence

### Walrus Memory (Session Context)

**Wrapper:** `lib/walrus/memory.ts`

```typescript
MemoryManager {
  async write(key: string, value: any): Promise<void>
    // Serialize to JSON; POST to Walrus memory relayer
    // Key pattern: "{walletAddress}:{sessionId}:{dataType}"
    // Idempotent; returns on success

  async read(key: string): Promise<any>
    // GET from Walrus; deserialize JSON
    // Returns null if key not found

  async queryByPrefix(prefix: string): Promise<Record<string, any>>
    // List all keys matching prefix; return values
    // Used for session history, contacts, risk profile
}
```

**Usage:**
- After trade execution: write swap history, contact (if transfer), risk-profile update
- On chat load: read session memory; inject into agent system prompt
- Not yet wired in P1; P2 task

### Walrus Blob (Immutable Receipt)

**Wrapper:** `lib/walrus/blob.ts`

```typescript
BlobManager {
  async write(data: Receipt): Promise<string>
    // Serialize receipt { txDigest, action, timestamp, dryRunResult }
    // POST to Walrus blob endpoint
    // Returns blob reference (immutable ID)

  read(blobRef: string): Promise<Receipt>
    // GET blob by reference
    // Immutable; can be shared, stored off-chain
}
```

**Usage:**
- On successful tx execution: async write receipt blob
- Receipt card shows blob link (immutable proof of action)
- P2 task

### Session History (Local Storage)

**Current:** UI scaffolded, no backend persistence.

**Planned:** 
- Walrus memory write: `{walletAddress}:sessions:{sessionId}`
- Contents: [ { role: "user", content }, { role: "assistant", content, toolCalls: [...] } ]
- On `/app` load: fetch session list from memory; render in sidebar

---

## Security Boundaries

### Client → Server
- **Sent:** walletAddress (public), chat message, tx request
- **NOT sent:** private keys, wallet secrets, auth tokens
- **Validation:** Zod schema + rate limit on receipt

### Server → Client
- **Sent:** tx PTB (unsigned base64), dry-run effects, error reasons
- **NOT sent:** API keys (Gemini, Walrus), admin keys, internal logs
- **Validation:** Signed responses not applicable (PTBs are unsigned); client trust is dApp Kit signature

### Signing Boundary
- **Client-side only:** dApp Kit ConnectButton opens wallet
- **Wallet computes:** SHA-256(txBytes), signature
- **Sign hook asserts:** digest(signed) === approvedDigest
- **Never signed without:** User seeing exact bytes in tx-preview card

### Guardian Boundary
- **Runs:** Inside prepareTrade tool on server
- **Inputs:** Unsigned PTB bytes, user context, external data (prices, metadata)
- **Outputs:** GuardianPass (with digest) or GuardianBlock (with reason)
- **Invariant:** No PTB leaves server if blocked; no override possible by LLM

---

## Key Trade-Offs & Decisions

### 1. Single Next.js App vs Web+Server Split
**Decision:** Single app (shape A from 02 ADR).

**Rationale:**
- Simplifies CORS: both landing + copilot share origin
- Easier deployment: one Vercel project
- Shared design system, providers, auth context
- Trade-off: routes mix (landing in root, copilot in `/app` subtree)

### 2. Guardian Determinism vs LLM Flexibility
**Decision:** Guardian is pure code; LLM is advisory only.

**Rationale:**
- Non-negotiable for security: an LLM cannot make a fund-moving decision
- LLM crafts the response; Guardian is the gate
- Trade-off: Requires tight tool contracts (Zod schemas); agent creativity is bounded

### 3. Fail-Closed on External Deps
**Decision:** Any dryRun, SuiNS, quote error → block, not "proceed if unavailable".

**Rationale:**
- $5/tx mainnet; a silent failure or wrong quote is dangerous
- Deterministic fixture fallback used for demo (not prod)
- Trade-off: Slower / less resilient to RPC flake; worth the safety

### 4. Lazy Cetus SDK Import (quotes-source.ts)
**Decision:** Cetus SDK imported only in `quotes-source.ts`; not in root.

**Rationale:**
- Cetus SDK is large (~200KB gzipped); avoids inflating main bundle
- Subpath import (quotes-source.ts) is lazy-loaded when buildSwap tool runs
- Trade-off: Slightly slower first swap (load delay); saves ~200KB on landing page

### 5. Light-Default Landing, Dark-Default Copilot
**Decision:** Landing uses light theme by default; copilot uses dark (local).

**Rationale:**
- Landing: light projects trust + clarity (white background, readable text)
- Copilot: dark matches fintech + mockup aesthetic
- Isolation: copilot theme toggle doesn't affect landing (`.dark` on `/app` div, not `<html>`)
- Trade-off: Inconsistent global theme; required per-route CSS scope

### 6. No JS Required for Critical Content
**Decision:** Landing content visible before hydration; animations enhance, not required.

**Rationale:**
- Fail-safe UX: no white flash, no opacity:0 trap on SSR mismatch
- Design: all sections start at full opacity; animations fade-in on mount
- Trade-off: CSS complexity for fail-safe state management

### 7. CJS dist for Tailwind v4 + Turbopack
**Decision:** Tailwind v4 uses CJS output; Turbopack (Next.js default bundler) requires it.

**Rationale:**
- Next.js 16 uses Turbopack; Tailwind v4 ships ESM + CJS
- Explicitly use CJS dist to avoid Turbopack failures
- Trade-off: Manual config; not future-proof to ESM-only tooling

### 8. Memory Wrapper Ready, Not Wired
**Decision:** Walrus memory manager implemented; not yet injected into agent context.

**Rationale:**
- P1 focuses on Guardian + sign pipeline; memory adds complexity
- Wrapper exists, tested; injection is P2 task (low risk)
- Trade-off: Memory feature advertised but not live; P2 shortfall

---

## Testing Strategy

### Unit Tests (Guardian gates)

**Framework:** Vitest (fast, TS-native, Vite integration)

**Coverage:**

| Test Suite | File | Purpose |
|-----------|------|---------|
| Allowlist refusal | `guardian-allowlist-refusal.test.ts` | Off-allowlist {pkg::mod::fn} blocked |
| Decimals | `guardian-decimals-per-coin-type.test.ts` | Per-coin-type decimals validated |
| Fail-closed on error | `guardian-fail-closed-on-sim-error.test.ts` | dryRun error → block, not pass |
| Injection provenance | `guardian-injection-provenance.test.ts` | "derived" args require confirm |
| Min-out re-derivation | `guardian-min-out-redeivation.test.ts` | Min-out re-derived + cross-checked |
| SuiNS lookalike | `guardian-suins-lookalike.test.ts` | Homoglyphs caught (edit-distance ≤ 2) |
| WYSIWYS digest | `guardian-wysiwys-digest-assertion.test.ts` | Digest binding enforced |

**Run:** `pnpm --filter @dewlock/agent test`

### Integration Tests (future)

- E2E: connect wallet → chat → sign → execute (testnet)
- API: /api/prepare-trade endpoint → Guardian → response
- Dry-run: dryRunTransaction mocked; verify effects shown

### Manual QA

- Landing responsive (mobile, tablet, desktop)
- Landing light/dark toggle
- Copilot shell renders (chat, sidebar, wallet pill)
- Guardian blocks allowlist violation (manual API call)
- tx-preview card shows digest + dry-run effects

---

## Deployment & Operations

### Environment Variables

**Public (NEXT_PUBLIC_*):**
```
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.mainnet.sui.io
NEXT_PUBLIC_CETUS_POOL_ID=0x...
NEXT_PUBLIC_FEATURE_CONFIDENTIAL=false
```

**Server-only:**
```
TX_USD_CAP=5
DAILY_USD_CAP=20
GEMINI_API_KEY=...
WALRUS_RELAYER_KEY=...
ALLOWED_ORIGINS=https://dewlock.example.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60
```

### Deployment Pipeline

**Vercel:**
1. Push to main branch
2. Vercel auto-detects Next.js; builds `pnpm build`
3. Deploys to serverless functions (API routes) + static (landing)
4. Auto-HTTPS, global CDN, region failover

**Pre-deploy checks:**
- `pnpm -r typecheck` (TS strict)
- `pnpm -r lint` (ESLint)
- `pnpm --filter @dewlock/agent test` (Guardian unit tests)
- `pnpm --filter web build` (Next.js build)

---

## Known Limitations & TODOs

| Item | Impact | Workaround | Plan |
|------|--------|-----------|------|
| Cetus pool fallback (not deterministic for demo) | $5 swaps may fail if pool unavailable | Use fixture pool | P2: add retry + aggregator fallback |
| SuiNS reverse-lookup missing API | Lookalike detection less precise | No reverse-check; accept risk | Upgrade @mysten/suins when 1.3.0 available |
| Memory not injected into agent context | Session context not personalized | Walrus wrapper ready; wire P2 | P2: inject session history into system prompt |
| Receipt blob writing async | Delayed immutability guarantee | Sync Sui object anchor first | P2: add blob write + receipt card |
| Mastra fullStream needs live test | May timeout on live Gemini key | Deterministic demo fallback | Final demo: smoke test with live key |
| No observable logging (Sentry, etc.) | Production errors opaque | stderr on Vercel logs | Post-launch: add Sentry or equivalent |

---

## Unresolved Architectural Questions

1. **DeepBook state management** — BalanceManager pre-funding orchestration (P2) not yet designed. Guardian scope needs clarification: does it gate BalanceManager budget separately, or just the user trade?
2. **Memory recall + LLM context window** — Walrus session history serialization may bloat context. Need strategy for truncation or summary on large histories.
3. **Best-execution quote aggregation** — Phase 6 (mainnet-only) needs oracle design. Hardcoded trusted prices don't scale to N pools; need feed or aggregator without compromising Guardian.
4. **Confidential Transfer SDK readiness** — @mysten/sui confidential API (devnet) still in flux. P3 implementation may need SDK version pin or workarounds.

