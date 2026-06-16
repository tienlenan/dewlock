# Dewlock — Current Build Status

> **Last updated:** 2026-06-16 · **Project:** Sui DeFi Copilot · **Build phase:** End-to-End Demo (P0–P1 complete, P2 underway)

## Executive Summary

**Dewlock** is a human-in-the-loop Sui DeFi copilot that converts natural-language intent into **unsigned transactions** guarded by a deterministic, fail-closed security spine called **Guardian**. The user sees a preview of exact effects, then signs the exact bytes they reviewed. Zero user-fund keys are held server-side.

**What's built and live:**
- Guardian security spine (9 hardened deterministic gates, 610 lines, 7 hard-gate unit tests)
- Core agent pipeline: NL → `prepareTrade` → Guardian → tx-preview card → wallet sign → receipt
- Landing page (dark + light themes, design tokens, 11 sections, responsive)
- Copilot app shell with sidebar, chat thread, session history, local dark/light toggle
- Mastra agent + API routes with rate limiting, CORS, Zod validation
- tx-preview card component with WYSIWYS (What-You-See-Is-What-You-Sign) SHA-256 digest assertion

**Live capabilities (mainnet-small):**
- `/` (landing): polished, fully styled, navigation pill, "brand-design" styleguide route
- `/app` (copilot): wallet connect, chat input, placeholder session history, demo portfolio card
- `/api/agent` (agentic route): open-to-close demo; deterministic `/api/prepare-trade` fallback
- `POST /api/prepare-trade`: synchronous trade prep without LLM (stage-demo reliability)
- Guardian: blocks off-allowlist calls, enforces caps, re-derives min-out, checks coin types, SuiNS lookalike detection, dry-run fail-closed

**What's labeled PREVIEW / SAMPLE (not live):**
- Session history persistence (UI scaffolded, backend not yet wired)
- Memory recall (Walrus memory wrapper present, not yet injected into chat context)
- Receipt blob writing (Walrus blob wrapper present; placeholder in `/api/prepare-trade`)
- Portfolio card (real API stub; live data requires wallet RPC call + Cetus LP indexing)
- Live Cetus quote + swap execution (quote SDK wired, execution deferred to P2)
- DeepBook limit-order (scaffolded in phase plan, not yet coded)
- Confidential transfers (devnet feature flag, no code yet)

---

## What's Built

### Guardian Security Spine (THE MOAT)

**File:** `packages/agent/src/guardian.ts` (610 lines)

Nine hardened gates, all deterministic, all fail-closed:

| Gate | What It Guards | Code Ref | Status |
|------|---|---|---|
| 1. Server-authoritative caps | TX_USD_CAP ($5), DAILY_USD_CAP ($20) | `env:TX_USD_CAP` | Live |
| 2. Trusted USD price | Curated coin refs, NOT swapped pool | `getTrustedUsdPrice()` | Live |
| 3. WYSIWYS digest | SHA-256 exact PTB bytes | `crypto.subtle.digest()` | Live |
| 4. Min-out re-derivation | On-chain decimals per coin type | `CoinMetadata` via RPC | Live |
| 5. Fail-closed on external deps | dryRun, SuiNS, quote, indexer errors → block | `try/catch → GuardianBlock` | Live |
| 6. Injection provenance | Args from "user_turn" only or marked "derived" | `argProvenance` field | Live |
| 7. Allowlist enforcement | {package::module::function} only | `ALLOWED_MOVE_TARGETS` set | Live |
| 8. SuiNS lookalike detection | Homoglyph norm + edit-distance ≤ 2 | `editDistance()` | Live |
| 9. Coin-type provenance | On-chain CoinMetadata; unknown type → block | `coinTypeExists()` check | Live |

**Tests:** 7 unit test suites (7 files, ~200 LOC):
- `guardian-allowlist-refusal.test.ts` — off-allowlist calls rejected
- `guardian-decimals-per-coin-type.test.ts` — decimals per coin validated
- `guardian-fail-closed-on-sim-error.test.ts` — dryRun errors block, never pass-through
- `guardian-injection-provenance.test.ts` — injection attempts blocked
- `guardian-min-out-redeivation.test.ts` — min-out re-derived & cross-checked
- `guardian-suins-lookalike.test.ts` — homoglyphs caught
- `guardian-wysiwys-digest-assertion.test.ts` — digest binding enforced

**How to verify:** `pnpm -r test` (Guardian tests in `packages/agent` scope).

---

### Agent Pipeline

**Files:**
- `packages/agent/src/agent.ts` — Mastra agent with tools
- `apps/web/app/api/agent/route.ts` — streaming `/api/agent` endpoint
- `apps/web/app/api/prepare-trade/route.ts` — sync fallback endpoint
- `packages/agent/src/tools/` — prepareTrade, getPortfolio tools (Zod-validated)

**Flow:**
```
User chat input
  ↓
/api/agent (Mastra + AI Gateway)
  ├─ interpretIntent (LLM)
  ├─ tool call: prepareTrade / getPortfolio
  │    ├─ build PTB, fetch Cetus quote
  │    └─ invoke guardianCheck() → GuardianPass or GuardianBlock
  └─ respond to user (card or block-explanation)
  ↓
UI renders tx-preview card with "Confirm & Sign" button
  ↓
useSignAndExecuteTx hook (from @mysten/dapp-kit)
  ├─ WYSIWYS digest assertion (approvedDigest === crypto(signedBytes))
  ├─ throw if mismatch
  └─ execute via wallet RPC
```

**Rate limiting:** 100 req/min per IP on both routes (env: `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX`).

**CORS:** Locked to `ALLOWED_ORIGINS` env var; defaults to permissive if empty (for dev).

---

### Landing Page

**Route:** `/` (default `light` theme via next-themes)

**Sections:**
1. **Hero** — product tagline, CTA, pastel gradient background
2. **Block Teaser** — "the BLOCK" (blocklist, deterministic fail-closed) visual
3. **How It Works** — 3-step NL→Sign→Receipt narrative
4. **DeepBook Beat** — novelty: limit-order at your price (future)
5. **Security & Trust** — Guardian gates, WYSIWYS, zero-keys headline
6. **Walrus Receipts** — memory + blob on Walrus
7. **Why Sui** — network benefits, Walrus, Mastra
8. **CTA** — "Launch app" button
9. **Footer** — links, copyright

**Design:** 
- Light default (cool near-white canvas, ink text, Sui-ish sky-blue accent)
- Dark mode toggle (next-themes, sets `.dark` on `<html>`)
- Pastel wash backdrop (3 fixed radial gradients: sky-blue dominant, orange + lime accents)
- Plus Jakarta Sans (display) + JetBrains Mono (addresses/code)
- Radius: 0.25rem (small uniform rounding)
- Grid lines: subtle, on canvas + dark panels
- `/brand-design` route: styleguide (tokens, color swatches, typography)

**Responsive:** Mobile-first Tailwind; fluid spacing via `clamp()`.

**No JS required:** Content visible before hydration (fail-safe opacity handling).

---

### Copilot App Shell

**Route:** `/app` (default `dark` theme, local localStorage key: `dewlock-app-theme`)

**Components:**
- **Header** — Dewlock logo, app-theme toggle (dark/light), wallet pill + disconnect button
- **Sidebar** — new session, session history (placeholder), memory beat indicator, footer links
- **Chat thread** — streamed messages + tool-call parts → cards (portfolio, tx-preview, receipt)
- **Chat input** — markdown support, "Send" button, loading state
- **Chat context** — `useCopilotChat` hook (state mgmt, message history, loading)

**Session persistence:** UI scaffolded (sidebar list, click to load); data layer (localStorage fallback) not yet wired to backend.

**Memory:** Walrus memory wrapper available (`lib/walrus/memory.ts`); placeholder in agent response.

---

### Design System

**File:** `apps/web/app/globals.css` (150+ LOC custom properties)

**Light-default tokens (flip in `.dark` mode):**
- Canvas: `--bg` hsl(205 38% 99%) (cool near-white)
- Text: `--fg` hsl(213 24% 13%) (ink)
- Primary: `--accent` hsl(206 90% 48%) (Sui sky-blue)
- Pastel tints: sky, periwinkle, blush, peach, mint
- Always-dark panels: `--bg-dark`, `--bg-ink`, `--border-dark`, `--fg-inverse`

**Shadcn integration:** Full token map for Button, Card, Input, Dialog, etc.

**Semantic status:** `--success` (green, balance gains), `--warning` (orange, gas/slippage alerts).

---

## What's NOT Yet Built (Deferred, Labeled)

### Phase 2 — DeepBook Limit-Order
- DeepBook POST_ONLY flow
- BalanceManager pre-funding orchestration
- Order expiry + self-match block
- Planned spec in `docs/03-deepbook-limit-order.md` (under plans/)

### Phase 3 — Memory & Wallet Recall
- Walrus memory injection into system prompt
- Session persistence to backend
- Risk-profile personalization
- Contact recall in agent responses
- Planned spec in `docs/05-memory-beats-and-payload.md`

### Phase 4 — Receipt Blogging (Walrus+Sui)
- Blob writing on trade execution
- Sui-object receipt anchor (minimal Move write)
- Receipt card UI (explorer link + blob link)
- Planned spec in `docs/04-guardian-dry-run-theater.md`

### Phase 5 — Confidential Transfers
- Devnet-only feature flag
- Confidential transfer SDK integration
- Isolated tab + preview badge
- Planned for post-demo phase

### Phase 6+ — Stretch
- Best-execution quote aggregation (mainnet-only)
- Lending protocol integration (NAVI / Scallop read + execute)
- Proactive suggestions from portfolio data
- Deferred to post-hackathon

---

## Live Routes & Entry Points

| Route | Status | Notes |
|-------|--------|-------|
| `/` | Live | Landing page, light default, fully styled |
| `/brand-design` | Live | Design tokens styleguide |
| `/app` | Live (shell only) | Copilot app; chat + sidebar; no live Cetus yet |
| `/api/agent` | Live (with preview) | Mastra + Gemini gateway; returns card-renderable JSON |
| `/api/prepare-trade` | Live (hardened) | Sync endpoint; Guardian runs; tx never returned on block |

---

## How to Run Locally

### Prerequisites
- Node 20+, pnpm 9+
- Set `GEMINI_API_KEY` (AI Gateway requires it for demo)
- Set `NEXT_PUBLIC_*` vars for Sui RPC, Cetus pool ID, etc. (see `.env.example`)

### Start dev server
```bash
pnpm install
pnpm -r build          # Verify monorepo builds
pnpm -r test           # Run Guardian unit tests
pnpm --filter web dev  # Next.js dev server on :3000
```

### Test Guardian
```bash
pnpm --filter @dewlock/agent test
```

### Build for production
```bash
pnpm -r build
pnpm --filter web build
# Deploy with Vercel or via `next start`
```

---

## Known Issues & TODOs

| Issue | Impact | Plan |
|-------|--------|------|
| Cetus live quote needs mainnet fallback pool | P2 swap execute blocked if pool unavailable | Use deterministic fixture pool for demo |
| SuiNS reverse-lookup API missing (@mysten/suins 1.2.0) | Lookalike detection less precise | Scheduled for @mysten/suins 1.3.0; accept current limitation |
| Memory persistence not wired to backend | Session history / contacts not persisted | P2/P3 task (Walrus wrapper ready) |
| DeepBook integration not started | Limit-order demo not live | Scheduled for P2 phase |
| Mastra `fullStream` needs smoke test on live Gemini key | May timeout under load | Test with live key before final demo |

---

## Test Results Summary

- **Guardian unit tests:** 7 suites, ~200 LOC, all gates tested
- **Zod validation:** All API endpoints validated (agents, prepare-trade)
- **Tailwind build:** No linting issues; design tokens verified
- **TypeScript:** `pnpm -r typecheck` passes (strict mode, no suppressions)
- **E2E:** Landing page loads, `/app` shell renders, Guardian blocks off-allowlist calls

---

## Unresolved Questions

1. **Mainnet pool depth for demo quote** — Is Cetus pool `SUI/USDC` liquid enough for a $5 swap? (Fallback: deterministic fixture)
2. **SuiNS reverse-lookup** — @mysten/suins 1.2.0 lacks the API; accept no-op for demo or wait for 1.3.0?
3. **Hackathon submission** — Can one entry claim DeFi&Payments + DeepBook tracks both, or pick one primary?
4. **Walrus network status** — Is mainnet Walrus blob endpoint stable? (Fallback: Sui object receipt anchor only)

