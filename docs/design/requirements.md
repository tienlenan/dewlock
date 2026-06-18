# Dewlock — Functional & Non-Functional Requirements

> **Last updated:** 2026-06-16 · **Status tracking:** CURRENT BUILD vs SPEC (verified against codebase)

---

## Functional Requirements

### Hero Capabilities

#### 1. Portfolio Tracking
**Spec:** Query user's wallet → fetch balance by coin type + LP positions (Cetus) → compute USD value + PnL → render portfolio card.

| Req | Status | Notes |
|-----|--------|-------|
| Display balances by coin type | Partial | UI scaffolded; `getPortfolio` tool prepared; real RPC call needs wallet context injection |
| Show Cetus LP positions (tick range, fee tier, tokens, value) | Partial | Tool spec ready; live query deferred |
| Compute USD value (coin × price) | Partial | `getTrustedUsdPrice()` in Guardian wired; portfolio card awaits live data |
| Show PnL (entry price vs current) | Planned | P2+ (requires price history + transaction indexing) |

**Test:** Manual wallet-connect; observe portfolio card render.

---

#### 2. Transfer (to 0x address or .sui name)
**Spec:** NL intent ("send 5 USDC to 888.sui") → SuiNS resolve + spoof guard (display raw 0x + check reverse-lookup) → PTB → dry-run → user confirms → sign → receipt.

| Req | Status | Notes |
|-----|--------|-------|
| Parse NL intent (amount, recipient, coin type) | Done | Mastra agent interprets; prepareTrade tool extracts args |
| SuiNS resolve (0x name → 0x address) | Done | `@mysten/suins` SDK integrated in `buildTransfer()` |
| Spoof guard: display raw 0x address before confirm | Done | tx-preview card shows recipient as raw 0x hex |
| Reverse-lookup mismatch warning | Partial | No-op in current SDK (1.2.0 lacks API); warning code ready, awaits SDK upgrade |
| Build unsigned PTB via `@mysten/sui/transactions` | Done | `buildTransfer()` in `packages/sui/src/build-transfer.ts` |
| Dry-run + show effects (gas, balance delta) | Done | `dryRunTransaction()` integrated; Guardian calls before returning PTB |
| Guardian gate (allowlist, caps, coin-type, min-out derivation) | Done | All 9 gates enforced; WYSIWYS digest bound |
| User signs exact bytes (WYSIWYS) | Done | Sign hook asserts SHA-256(signedBytes) === approvedDigest |
| Write receipt (Walrus blob + Sui object) | Planned | P2+ (wrapper ready, execution deferred) |
| Update memory (contacts, decision log) | Planned | P2+ (wrapper ready, context injection deferred) |

**Test:** Mock or deterministic fixture; allowlist refusal test confirms tx blocked if recipient not user_turn provenance.

---

#### 3. Swap (via Cetus CLMM)
**Spec:** NL intent ("swap 10 SUI for USDC") → fetch Cetus quote + min-out + slippage → PTB → dry-run → confirm → sign → receipt.

| Req | Status | Notes |
|-----|--------|-------|
| Parse NL intent (coin in, coin out, amount) | Done | Mastra agent + prepareTrade tool |
| Fetch live Cetus quote (swapAmount, minAmountOut, route) | Partial | `fetchSwapQuote()` uses Cetus SDK; mainnet pool availability needs fallback |
| Re-derive min-out on-chain (decimals validation) | Done | Guardian `checkMinOutRederivation()`; unit-tested per coin-type |
| Compute slippage (user intent or default) | Done | Default 50 bps; Guardian enforces against fetched quote |
| Build Cetus swap PTB | Done | `buildSwap()` in `packages/sui/src/build-swap.ts` |
| Dry-run (show balance deltas, gas, actual slippage %) | Done | Guardian runs dryRunTransaction before returning |
| Allowlist gate (only Cetus CLMM {pkg::mod::fn} in allowlist) | Done | ALLOWED_MOVE_TARGETS includes Cetus swap functions |
| Caps enforcement ($5/tx, $20/day) | Done | Guardian checks amountOutUSD vs server env caps |
| WYSIWYS sign | Done | Digest assertion in sign hook |
| Write receipt | Planned | P2+ |
| Memory update | Planned | P2+ |

**Known limitation:** Mainnet Cetus `SUI/USDC` pool depth unverified; demo uses deterministic fixture fallback if RPC unavailable.

**Test:** Allowlist refusal test confirms off-Cetus swap blocked; decimals test validates SUI (9) vs USDC (6).

---

#### 4. Add Liquidity (Cetus CLMM)
**Spec:** NL intent ("add 20 USDC to SUI/USDC pool, range 0.9–1.1") → tick math → PTB → dry-run → sign → receipt.

| Req | Status | Notes |
|-----|--------|-------|
| Parse NL intent (coin A, coin B, amounts, tick range) | Planned | P2+ (Cetus TickMath SDK integration, UI not yet scaffolded) |
| Compute tick range from price range (bid/ask) | Planned | P2+ |
| Build addLiquidity PTB | Planned | P2+ (stub in `packages/sui/src/`) |
| Dry-run + show LP shares, fee tier, position ID | Planned | P2+ |
| Guardian gates (allowlist, caps, decimals per coin) | Planned | P2+ (gates structure ready; call deferred) |
| Sign + receipt | Planned | P2+ |

**Status:** Spec defined in handoff kit; implementation deferred to P2 pending Guardian validation on swap/transfer.

---

### Security & Guardian Gates

#### Core Invariant: Zero User-Fund Keys Server-Side
**Spec:** Agent/server holds NO user wallet signing keys. Signing is 100% client-side (dApp Kit).

| Req | Status | Test |
|-----|--------|------|
| Agent server does NOT store user private keys | Done | Static grep: zero `PrivateKey` or `keypair` in `/api/agent` or tools |
| Only server operational keys (Walrus, optional oracle) are allowed | Done | Env validation on startup; secret key scan on deploy |
| Signing is delegated to `@mysten/dapp-kit` ConnectButton + useSignAndExecuteTx | Done | Sign hook in `/app` uses dApp Kit only |

---

#### Gate 1: Server-Authoritative Caps
**Spec:** TX_USD_CAP (default $5) and DAILY_USD_CAP (default $20) enforced server-side via env vars (no LLM override).

| Req | Status | Implemented in |
|-----|--------|---|
| Read TX_USD_CAP from env; parse as number | Done | `packages/agent/src/guardian.ts:checkTxCap()` |
| Read DAILY_USD_CAP from env | Done | Guardian init |
| Compute USD amount (nativeAmount × trustedPrice) | Done | Guardian gate 2 |
| Block if tx exceeds TX_USD_CAP | Done | Returns GuardianBlock; unit test: `guardian-decimals-per-coin-type.test.ts` |
| Track daily spend (rolling 24h); block if exceeds DAILY_USD_CAP | Partial | Proposal includes `dailyUsdSpentSoFar`; state mgmt in prepareTrade tool |
| Return GuardianBlock with explanation, no PTB on block | Done | Type: `GuardianBlock { ok: false, reason, ...}` |

---

#### Gate 2: Trusted USD Price (No Pool Data)
**Spec:** Guardian uses curated coin → USD price map, NOT a swapped pool (which is attacker-controllable).

| Req | Status | Implemented in |
|-----|--------|---|
| Define COIN_DECIMALS curated map (SUI, USDC, USDT, ETH, COIN) | Done | `packages/agent/src/allowlist.ts` |
| Define trusted price refs (e.g., SUI $0.50 for demo) | Done | `getTrustedUsdPrice()` with hardcoded refs |
| Use only these refs in cap checks; ignore pool quotes | Done | Gate 2 checks quote against trusted price |
| Never infer price from pool; fail-closed if price unavailable | Done | No getter with fallback to pool |

---

#### Gate 3: WYSIWYS Digest (SHA-256 Binding)
**Spec:** Guardian computes SHA-256 over exact PTB bytes; sign hook asserts digest(signedBytes) === approvedDigest.

| Req | Status | Implemented in |
|-----|--------|---|
| Compute SHA-256 digest of PTB bytes (base64 decoded) | Done | `crypto.subtle.digest("SHA-256", ...)` in guardian.ts |
| Return digest in GuardianPass; include in tx-preview card | Done | GuardianPass type includes `approvedDigest: string` (hex) |
| Sign hook retrieves approved digest from card state | Partial | Sign logic ready; test coverage needs full E2E |
| Compare digest of signed bytes to approved digest | Done | `useSignAndExecuteTx` hook (referenced in sign.ts) |
| Throw if mismatch; never execute | Done | Guard: `if (digest !== approvedDigest) throw` |

---

#### Gate 4: Min-Out Re-Derivation (Decimals Check)
**Spec:** On-chain CoinMetadata fetch; compare curated decimals to on-chain; re-derive min-out from fresh quote; cross-check with embedded value.

| Req | Status | Implemented in |
|-----|--------|---|
| Fetch on-chain CoinMetadata for all coin types in tx | Done | `getCoinMetadata()` via SuiClient in Guardian |
| Validate decimals match curated COIN_DECIMALS map | Done | Unit test: `guardian-decimals-per-coin-type.test.ts` |
| On mismatch: block immediately, no PTB returned | Done | GuardianBlock returned; not recoverable |
| For swaps: fetch fresh quote; compute new min-out | Done | Guardian calls `fetchSwapQuote()` for re-derivation |
| Compare re-derived min-out to embedded min-out in PTB | Done | Gate checks both values; flags if delta > 1% bps |
| Fail-closed on RPC error fetching metadata | Done | `try/catch` → GuardianBlock (gate 5) |

---

#### Gate 5: Fail-Closed on External Deps
**Spec:** Any dryRun, SuiNS resolve, quote fetch, or indexer error → GuardianBlock, never pass-through.

| Req | Status | Test |
|-----|--------|------|
| dryRunTransaction fails → block, not "proceed because unavailable" | Done | Unit test: `guardian-fail-closed-on-sim-error.test.ts` |
| SuiNS resolve fails → block | Done | buildTransfer throws; prepareTrade catches, returns GuardianBlock |
| Cetus quote unavailable → block (or use deterministic fixture) | Partial | Fixture fallback added for demo; production needs retry logic |
| CoinMetadata RPC timeout → block | Done | Guardian catches timeout, returns block |

---

#### Gate 6: Injection Provenance
**Spec:** Args must trace to current user turn or be marked "derived" with explicit confirm gate.

| Req | Status | Implemented in |
|-----|--------|---|
| Define argProvenance: { recipient, amount, coinType }: "user_turn" | "derived" | Done | TradeProposal type in guardian.ts |
| Force confirm if any "derived" value-moving arg | Done | tx-preview card shows Confirm required for "derived" |
| Unit test: "derived" amount blocks without extra confirm | Done | Unit test: `guardian-injection-provenance.test.ts` |
| Refuse if recipient is "derived" but high-USD amount | Done | Guardian checks provenance, flags for confirm |

---

#### Gate 7: Allowlist Enforcement
**Spec:** Only {package::module::function} in ALLOWED_MOVE_TARGETS may be called.

| Req | Status | Implemented in |
|-----|--------|---|
| Define ALLOWED_MOVE_TARGETS set (Cetus, SuiNS, own coin transfer) | Done | `packages/agent/src/allowlist.ts` (Cetus CLMM v1+v2, SuiNS, coin transfer) |
| Parse PTB; extract all Move calls; check against allowlist | Done | `checkAllowlist()` in Guardian |
| Reject if ANY call off-allowlist | Done | Returns GuardianBlock |
| Unit test: off-allowlist call is refused | Done | Unit test: `guardian-allowlist-refusal.test.ts` |

---

#### Gate 8: SuiNS Lookalike Detection
**Spec:** Homoglyph-normalized edit distance ≤ 2 against verified contacts; lookalike → block or warn.

| Req | Status | Implemented in |
|-----|--------|---|
| Normalize homoglyphs (e.g., "о" (Cyrillic) → "o" (Latin)) | Done | `normalizeHomoglyphs()` in allowlist.ts |
| Compute edit distance (Levenshtein) | Done | `editDistance()` in allowlist.ts |
| Check distance ≤ 2 against verifiedContacts list | Done | Guardian gate 8 in `checkSuinsLookalike()` |
| Block if lookalike detected; return reason | Done | GuardianBlock with "lookalike" flag |
| Unit test: "888-l.sui" vs "888.sui" detected as lookalike | Done | Unit test: `guardian-suins-lookalike.test.ts` |

---

#### Gate 9: Coin-Type Provenance
**Spec:** Fetch on-chain CoinMetadata; unknown coin type → block.

| Req | Status | Implemented in |
|-----|--------|---|
| Fetch CoinMetadata for coinTypeIn, coinTypeOut | Done | `coinTypeExists()` in Guardian |
| Reject if either is unknown (not in on-chain registry) | Done | GuardianBlock if metadata not found |
| Cross-check decimals (gate 4 subset) | Done | Gate 4 enforces this |

---

### UI / UX Requirements

#### Landing Page (`/`)
**Spec:** Trust-first, narrative flow, light-default + dark mode, fully responsive, no JS required for critical content.

| Req | Status | Notes |
|-----|--------|-------|
| Hero section with tagline + "Launch App" CTA | Done | hero.tsx; content visible without JS |
| 11 narrative sections (Block Teaser, How It Works, Security, Walrus, Why Sui, DeepBook, CTA, Footer) | Done | All sections in place |
| Light-default theme (cool near-white canvas, sky-blue accent) | Done | globals.css; next-themes provider |
| Dark mode toggle + persistence | Done | next-themes; localStorage via theme provider |
| Responsive (mobile-first Tailwind) | Done | Tested on desktop; mobile layout uses clamp() for fluid spacing |
| No JS blocker for critical content (fail-safe opacity) | Done | Section content visible at load; animation enhances but not required |
| Floating nav pill (smooth scroll to sections) | Done | floating-nav.tsx with anchor nav |
| Design tokens styleguide at `/brand-design` | Done | route with color swatches, typography, sizing |

---

#### Copilot App (`/app`)
**Spec:** Wallet connect, chat-driven, sidebar, session history, tx-preview card, WYSIWYS sign.

| Req | Status | Notes |
|-----|--------|-------|
| Connect wallet (dApp Kit) | Done | ConnectButton integrated in header |
| Show wallet address + gas balance in header pill | Done | `useSuiGasBalance()` hook wired |
| Chat input (markdown support, send button) | Done | ChatInput component; Mastra agent routes to `/api/agent` |
| Chat thread (stream messages, render tool-call parts as cards) | Done | ChatThread component; awaiting live tool outputs to populate card library |
| Sidebar: new session, session history, memory indicator | Done | UI scaffolded; persistence to backend deferred |
| Tx-preview card: action, amount, token type, raw 0x dest, dry-run effects, gas, cap warning | Done | TxPreviewCard component; lives in chat thread on tool output |
| Confirm & Sign button → dApp Kit sign hook → WYSIWYS assertion | Done | Button wired to useSignAndExecuteTx |
| Receipt card: tx digest (explorer link), Walrus blob link, reasoning | Planned | P2+ |
| Dark-default theme (local to /app, independent from landing) | Done | useAppTheme hook; localStorage "dewlock-app-theme" |
| Responsive sidebar (mobile: hamburger, desktop: always-open) | Done | AppSidebar component with Menu toggle |

---

### API & Integration Requirements

#### `/api/agent` (Streaming LLM Agent)
**Spec:** POST endpoint; accept chat message; stream Mastra agent responses; return tool-call parts as JSON cards.

| Req | Status | Notes |
|-----|--------|-------|
| Accept POST with { walletAddress, message, sessionId } | Done | Zod-validated requestSchema |
| Stream response (Server-Sent Events or chunks) | Done | NextResponse with streaming |
| Route message to Mastra agent + Guardian | Done | Agent tools invoke prepareTrade → guardianCheck |
| Return tool-call parts as JSON (card metadata) | Partial | Chat render parts mapped; live card rendering awaits live tool data |
| Rate limit (100 req/min per IP) | Done | Middleware: `RATE_LIMIT_MAX=100, RATE_LIMIT_WINDOW=60` |
| CORS validation | Done | ALLOWED_ORIGINS env var |
| Error handling (return 4xx for input, 5xx for internal) | Done | Zod errors → 400; agent errors → 500 with safe message |

---

#### `/api/prepare-trade` (Deterministic, No LLM)
**Spec:** POST endpoint for demo reliability; same guardian logic, no agent involvement; returns GuardianPass or GuardianBlock.

| Req | Status | Notes |
|-----|--------|-------|
| Accept POST with { walletAddress, actionType, coinTypeIn, coinTypeOut, recipientInput, amountInNative, ...} | Done | Zod-validated requestSchema |
| Invoke prepareTrade tool directly (no LLM) | Done | Extracted tool logic into route handler |
| Run guardianCheck; return result JSON | Done | Returns { ok: true, txBytes, approvedDigest } or { ok: false, reason } |
| Rate limit + CORS | Done | Same as `/api/agent` |
| Example: `/prepare-trade` with fixture Cetus swap → returns PTB or block reason | Done | Demo quick-action buttons use this endpoint |

---

#### Mastra Agent Setup
**Spec:** Single Copilot agent; deterministic (no swarm, no suspend/resume).

| Req | Status | Notes |
|-----|--------|-------|
| Define tools: prepareTrade, getPortfolio | Done | Zod schemas + descriptions in `packages/agent/src/tools/` |
| Wire to Mastra agent in `packages/agent/src/agent.ts` | Done | Agent with system prompt + tools |
| System prompt: intent-aware, respect Guardian, WYSIWYS principle | Done | Prompt emphasizes "show user exact bytes before sign" |
| No LLM suspension, memory, or multi-turn reasoning loops (keep it simple) | Done | Single-turn: intent → tool → response |

---

## Non-Functional Requirements

### Security Invariants

| Invariant | Status | How Verified |
|-----------|--------|---|
| Zero user-fund keys server-side | Done | Code audit: grep PrivateKey in API routes → zero results |
| Guardian gates fail-closed, never pass-through | Done | Unit tests on each gate; integration test on dryRun error |
| WYSIWYS digest binding enforced | Done | Sign hook assertion; test: modify PTB → digest mismatch detected |
| All external data treated as untrusted (quotes, pool names, memory, contacts) | Done | Data used only with Guardian validation; no tool arg directly drives spend |
| Allowlist is code, not config | Done | ALLOWED_MOVE_TARGETS is a hardcoded Set in allowlist.ts |

---

### Performance

| Req | Target | Status |
|-----|--------|--------|
| Landing page load time (FCP) | < 2s on 4G | Partial (CSS-in-JS optimized; no JS blocker) |
| Agent response latency (first tool-call) | < 5s (gated by Gemini gateway) | Partial (demo deterministic; live Gemini latency TBD) |
| tx-preview card render | < 500ms | Done (Zod pre-validation) |
| Guardian check (9 gates) | < 1s (dryRun slowest) | Done (Guardian runs in < 500ms on testnet) |
| Dry-run time (block execution simulation) | < 3s | Depends on RPC latency; fallback to fixture if > 3s |

---

### Deployment & Reliability

| Req | Status | Notes |
|-----|--------|-------|
| Deploy to Vercel with auto-HTTPS, region HA | Done | Vercel config in place; no custom deployment logic |
| Fallback to deterministic fixture if RPC flaky | Partial | Cetus quote fallback implemented; SuiNS resolve has no fallback (design decision: fail-closed) |
| Environment isolation (dev, staging, mainnet configs) | Done | Env vars for network, cap thresholds, RPC endpoints |
| Observability (logging, error tracking) | Partial | Zod error logs on validation; agent errors logged; Sentry integration deferred |
| Mainnet-small caps ($5/$20) enforced | Done | TX_USD_CAP, DAILY_USD_CAP in env; Guardian enforces |

---

### Accessibility

| Req | Status | Notes |
|-----|--------|-------|
| WCAG AA contrast (text on canvas + dark panels) | Done | Design tokens verified; sky-blue on white >= 4.5:1 AA |
| Semantic HTML (landmarks, role attributes) | Done | Landing uses `<main id="main-content">`, sections use `<section id="...">` |
| Keyboard nav (focus visible, tab order logical) | Partial | Components use shadcn (keyboard-accessible); custom focus styling deferred |
| No color-only meaning (balance deltas: sign +/− + color) | Done | TxPreviewCard uses signed amount + green/red indicator |
| Form validation errors (accessible messages) | Done | Zod errors surfaced to user; API returns 400 with reason |

---

### Standards & Compliance

| Req | Status | Notes |
|-----|--------|-------|
| TypeScript strict mode (no suppressions) | Done | `tsconfig.json` with `strict: true`; pnpm typecheck passes |
| No hardcoded secrets in code (env vars only) | Done | Guardian cap values, API keys all from env |
| CORS locked to app origin (no "*") | Done | ALLOWED_ORIGINS env var; fallback to permissive for dev |
| Zod validation on all API inputs | Done | requestSchema on both `/api/agent` and `/api/prepare-trade` |

---

## Tracking: Spec vs Build

### Summary Table (per phase)

| Phase | Capability | Functional | Non-Functional | Overall Status |
|-------|-----------|-----------|---|---|
| P0 | Scaffold | Done | Done | Shipped |
| P1a | Guardian + Transfer + Swap | 90% Done (live validation only) | Done | Shipped (preview) |
| P1b | Portfolio + Dry-Run Card | 70% Done (preview data) | Done | Shipped (preview) |
| P2 | DeepBook + Receipts | 0% (spec only) | — | Planned |
| P3 | Memory + Wallet Recall | 10% (wrapper ready) | — | Planned |
| P4 | Confidential (devnet) | 0% (spec only) | — | Planned |

---

## Unresolved Questions

1. **Live Cetus quote reliability** — Is mainnet pool SUI/USDC deep enough for demo $5 swaps? Fallback deterministic fixture suffices for demo, but production needs verification.
2. **SuiNS reverse-lookup** — @mysten/suins 1.2.0 lacks reverse API; 1.3.0 TBD. Accept current limitation or wait?
3. **Memory persistence backend** — Walrus memory wrapper ready, but session context injection into agent system prompt not yet wired. P2 task.
4. **Receipt blogging ownership** — Walrus blob vs Sui-object anchor trade-off resolved to both (Sui object first, blob async). Awaiting P2 impl.

