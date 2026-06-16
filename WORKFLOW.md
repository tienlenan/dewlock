# Dewlock — Working Workflow (per plan)

The repeatable loop for executing every plan in `docs/plans/`. Mirrors the CK skill pipeline: **pick → plan → implement → test → review → ship**. Run it once per phase (or per coherent slice), smallest-id unblocked phase first.

## The loop

```
┌─ 1. PICK ─────────────────────────────────────────────────────────────┐
│  ck plan status docs/plans/<plan>/plan.md      # see phase states      │
│  choose the lowest-id phase whose dependencies are all completed       │
│  cd docs/plans/<plan> && ck plan check <phase-id> --start   # in-progress│
└────────────────────────────────────────────────────────────────────────┘
┌─ 2. PLAN (only if the phase is under-specified) ───────────────────────┐
│  /ck:plan <phase-file>     # expand a thin phase into concrete steps    │
│  skip when the phase file already has Implementation Steps + criteria   │
└────────────────────────────────────────────────────────────────────────┘
┌─ 3. IMPLEMENT ─────────────────────────────────────────────────────────┐
│  /ck:cook docs/plans/<plan>/phase-XX.md                                 │
│  • follow the phase's Related Code Files + Implementation Steps         │
│  • honor docs/03 security invariants + the Red-Team Hardening notes     │
│  • files < 200 LOC, kebab-case, descriptive comments (no plan refs)     │
│  • after each file: run typecheck/build (pnpm typecheck && pnpm build)  │
└────────────────────────────────────────────────────────────────────────┘
┌─ 4. TEST ──────────────────────────────────────────────────────────────┐
│  /ck:test          # unit + integration; the phase's acceptance tests   │
│  Guardian phases: decimals-per-coin-type + adversarial tests are HARD    │
│  completion gates — phase is not done until they pass                    │
└────────────────────────────────────────────────────────────────────────┘
┌─ 5. REVIEW ────────────────────────────────────────────────────────────┐
│  /ck:code-review   # security-critical money code → always review       │
│  apply findings; re-test                                                │
└────────────────────────────────────────────────────────────────────────┘
┌─ 6. SHIP / CLOSE PHASE ────────────────────────────────────────────────┐
│  cd docs/plans/<plan> && ck plan check <phase-id>   # mark completed     │
│  commit (conventional, no AI refs); loop back to PICK                    │
└────────────────────────────────────────────────────────────────────────┘
```

## Delegation (per orchestration-protocol)

- **Scaffold / shared base** → do directly or one focused agent (it's the shared dependency; build first, sequentially).
- **Independent slices** (e.g. landing sections vs Guardian lib) → parallel `fullstack-developer` agents with **strict file ownership** (no overlapping files).
- **Guardian / money code** → supervise closely; review every gate. The optional LLM critic is non-load-bearing (first to cut).
- Always pass each agent: work context path, the specific phase-file path, acceptance criteria, and `LOCAL-ENV-KEYS.md` for env (never paste raw secrets into prompts — point to the file).

## Two active plans

| Plan | What | Order |
|------|------|-------|
| `260616-0315-dewlock-sui-defi-copilot` | The DeFi copilot (Guardian → DeepBook → BLOCK → memory → deferred) | core product |
| `260616-0859-dewlock-landing-and-theme` | Landing page + shared theme system (r-ai-landing structure, Sui-aqua reskin) | theme first, then landing; app UI theming pairs with copilot P2 |

**Interleave:** Landing-plan Phase 1 (theme tokens) runs alongside copilot Phase 1 (scaffold) since both touch the shared design system. Then copilot P2 (Guardian) + landing P2 (sections) parallelize.

## De-scope ladder (when the deadline squeezes)

Demo-minimum = copilot **P1–P4** + landing **P1–P2**. If time slips, in this order:
1. Cut copilot P6–P9 (already deferred, guarded).
2. DeepBook (copilot P3) → fixture-only book read (SDK still builds the PTB; dry-run on fixture) if BalanceManager/indexer become long poles.
3. Landing → ship hero + Guardian-story + CTA only; drop secondary sections.
4. Move anchor (copilot P4) → blob-only receipt (degrade path already specced).

## Guardrails (every loop)

- No user-fund signer key server-side (grep gate each phase).
- Server-authoritative caps; `NEXT_PUBLIC_*` is display-only.
- Fail-closed on every external dependency on the value path.
- Receipt/blob writes are async; never block the UI or the red BLOCK flash.
- Pin SDK versions on first install; commit the lockfile.
