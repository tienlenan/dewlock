# Dewlock — Production-Readiness Backlog

> Goal: bring the app to **production-ready** (mainnet-oriented). Executed as sequential **sprints** — each sprint: pick items → `ck:plan` → implement → test. This file is the master backlog; per-sprint plans live in `plans/`.
> ⚠️ Honest constraint: items marked **[needs live-env]** require a real Sui wallet / mainnet RPC / funded keys / Move publish that can't be fully exercised headless — those are implemented + unit-tested here, with on-chain validation flagged for a real run.

## Definition of "production-ready"
1. The hero flow works **end-to-end on mainnet-small** with a real wallet (track → build → Guardian → dry-run → sign → receipt).
2. The two differentiators are real: **DeepBook limit-order** + the **deliberate fail-closed BLOCK** with an on-chain-anchored Walrus receipt.
3. Hardened: error/empty/loading states, rate-limit + CORS, fresh secrets, a11y AA, responsive, performant.
4. Verified: unit + integration + E2E green; deployed to Vercel; CI on PRs; basic monitoring.
5. Security: zero user-fund keys server-side (gate), dependency audit, WYSIWYS validated against a real wallet.

## Current state (from `current-status.md` / `technical-design.md`)
Done: monorepo, Guardian spine (9 gates, 72 tests), landing + `/app` redesign, design system + `/brand-design`, demo PASS/BLOCK via `/api/prepare-trade`, WYSIWYS sign hook, Walrus/memwal wrappers. Live: wallet connect, deterministic demo, free-text chat. Preview/sample: sessions, memory recall, DeepBook card, multi-position portfolio.

---

## Sprint 1 — Make the core flow REAL on mainnet (P1)
| # | Item | Acceptance | Notes |
|---|------|-----------|-------|
| 1.1 | **Live Cetus swap** — finish `createSwapTransactionPayload`, real `preswap`/quote → swap PTB | a real mainnet-small swap builds, passes Guardian, dry-runs, signs | [needs live-env] |
| 1.2 | **Real `getPortfolio`** — live balances by coin type + Cetus LP + USD/PnL (trusted price source) | portfolio card shows real connected-wallet holdings | [needs live-env] |
| 1.3 | **SuiNS resolve** — real forward resolve; reverse-lookup alternative (SDK 1.2.0 gap) → fallback (curated/edit-distance-only) documented | `name.sui` → raw 0x shown; lookalike gate works | partial today |
| 1.4 | **Validate chat→tool→card→sign→receipt** against real wallet + AI Gateway; fix Mastra `fullStream` tool-result surfacing | one live NL action completes in browser | [needs live-env] |
| 1.5 | **Trusted USD price source** for the cap gate (curated stable refs / oracle), unknown→block | cap gate uses a real price, not the swapped pool | security |

## Sprint 2 — The differentiators (P1)
| # | Item | Acceptance | Notes |
|---|------|-----------|-------|
| 2.1 | **DeepBook limit-order** — indexer read (level2/mid/tick-lot), BalanceManager onboarding (off-stage), `placeLimitOrder` POST_ONLY PTB, orderbook Guardian gates (POST_ONLY/self-match/expiry/BM-ceiling) | a POST_ONLY order builds→Guardian→signs→rests | [needs live-env] |
| 2.2 | **The BLOCK theater** — staged fail-closed BLOCK (lookalike + broken min-out), legible raw-addr diff, **async Walrus blob receipt** | the BLOCK renders + writes a content-addressed receipt | partial (UI exists) |
| 2.3 | **Sui-object receipt anchor** — minimal Move pkg `dewlock_receipt`, publish (mainnet), HEAD pointer → blobId; blob-only degrade path | receipt anchored on-chain; degrade if publish fails | [needs live-env] |
| 2.4 | **Atomic 2-leg PTB vehicle** (swap+transfer) WYSIWYS | one signature, full bundle preview | |

## Sprint 3 — Memory + persistence (P2)
| # | Item | Acceptance | Notes |
|---|------|-----------|-------|
| 3.1 | **Conviction-Streak cap callback** — memwal `remember`/`recall`; agent recalls day-1 cap to freeze an over-cap tx | recall visibly freezes a $40 tx citing the $5 rule | |
| 3.2 | **Contacts / address-book** — verified name→0x; Guardian drift flag | stored contact drift warns | |
| 3.3 | **Receipt-on-execute** — async Walrus blob + memory decision log on every signed action | each action persists a receipt | |
| 3.4 | **Session persistence** (replace sample sessions) — real thread storage | sessions list is real | |

## Sprint 4 — Hardening (P1 for prod)
| # | Item | Acceptance |
|---|------|-----------|
| 4.1 | Error / empty / loading states across app + landing (RPC fail, wallet reject, gateway error) | no dead-ends; graceful failures |
| 4.2 | Rate-limit + CORS lockdown + input validation on all API routes | abuse-resistant |
| 4.3 | **Fresh production secrets** (rotate reused Daily-Walrus keys); grep gate = 0 user-fund keys server-side | secrets hygiene verified |
| 4.4 | a11y audit (WCAG AA): contrast, focus, keyboard, reduced-motion, alt | Lighthouse a11y ≥ 95 |
| 4.5 | Responsive/mobile pass (320/375/414/768) + performance (LCP, bundle, lazy heavy visuals) | no horiz scroll; good CWV |
| 4.6 | SEO/meta/OG image, favicon, title/description | shareable, indexable |

## Sprint 5 — Verify + ship (P1 for prod)
| # | Item | Acceptance |
|---|------|-----------|
| 5.1 | **Integration tests** — testnet self-seeded Cetus pool for swap/addLP/transfer (deterministic) | green CI |
| 5.2 | **E2E (Playwright)** — the demo flow (connect→demo PASS→preview; demo BLOCK→block card) | green CI |
| 5.3 | More Guardian edge-case unit tests (decimals per type, price-manip, expiry) | coverage up |
| 5.4 | **Vercel deploy** — env (server/public split), memwal provisioned, blob signer funded, build clean | live URL |
| 5.5 | **CI** — lint/typecheck/test on PR; **monitoring** (error tracking) | pipeline + alerts |

## Backlog (nice-to-have / later)
- Lending tracking (NAVI/Scallop read-only). Confidential transfers (mainnet when available — NOT devnet per product direction). Proactive suggestions. Best-execution quote-off (mainnet depth permitting). Multi-wallet. i18n. Analytics. Onboarding tour.

## Sprint cadence
Each sprint: `ck plan create` the picked items → implement via a Workflow (understand→implement→adversarial-verify) → run `pnpm -r typecheck` + vitest + build + (where possible) a live/visual check → mark items done → next sprint. Loop until the Definition of production-ready holds; flag **[needs live-env]** items for a real-wallet validation pass.
