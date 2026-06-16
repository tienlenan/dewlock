# 12 — Innovation & Gamification Strategy

Research: 17-agent workflow (what-wins + GameFi + memory-native games → ideate 12 concepts → judge panel w/ gimmick-risk → synthesize), 2026-06-15.

## Stance (brutal honesty)

**A bolt-on game DILUTES; exactly ONE intrinsic, security-native mechanic HELPS.** On a money tool, XP/badges/leaderboards/streaks-as-product "signal unserious and dilute the trust thesis." The team's playful "Gil" instinct is a **TRAP here**. GiveRep (Sui Overflow 2025 Entertainment winner) won only because gamification *WAS* the product (a reputation graph) — not a sticker layer.

**The win sentence:** *"An agent that holds zero user keys, remembers your rules on decentralized storage, and is provably blocked from doing the wrong thing before you sign."* A game adds nothing to that sentence; at best one mechanic makes its invisible half (the silent cap) visceral.

→ **Recommended: pure-innovation hero + exactly ONE memory-native fusion beat. Game as VOICE, not product.**

## What wins in 2026 (verified)

- Judging axes (ETHGlobal-style): Technicality, Originality, Practicality, Usability, WOW. Sui Overflow Demo-Day rewards ONE polished E2E flow + a shareable artifact (195k community votes decided 2025 rankings).
- Winners' shared gene: the AI **provably DOES** on-chain work (verifiable / persisted / settled), not narrates it. Magma (AI rebalancing only viable on Sui), Suithetic (verifiable AI output), DIVE (multi-agent consensus settlement), ENShell (policy-gated signing — **finalist-grade, so the bare gate is no longer novel** → must out-execute on Sui-native correctness).
- Privacy swept payments/crypto (PIVY stealth, Shroud confidential swap) → Confidential Transfers angle is on-trend but stays a feature-flagged differentiator (devnet/unaudited can't carry the hero).
- "Use Sui/Walrus primitives that couldn't exist elsewhere" + "Walrus not window dressing" are explicit bars.

## Ranked concepts (judge panel, total = sum of 5 axes − gimmickRisk)

| Concept | Total | Verdict |
|---|---|---|
| **Guardian Dry-Run Theater** (the deliberate BLOCK) | 38 | **strong — HERO** |
| **Conviction Streak** (memory-scored discipline, cap moment) | 35 | **strong — 2nd beat** |
| Human vs Agent Forecast Duel | 32 | maybe → fold in as Calibration (no game) |
| Time-Lock Thesis Vault | 31 | maybe |
| Portable Discipline Passport | 31 | strong-but-secondary (only if Walrus/data track) |
| Confidential Payroll Splitter | 28 | maybe (confidential beat) |
| Guardian Credit Score SBT | 24 | drop |
| Streak Vault / Companion Pet / Sealed-Bid Duel / Memory Heist / Rival Pools | 7–19 | **drop** (2nd surface, reward activity over restraint) |

## What to actually build (priority, KISS, reuse-heavy)

1. **HERO — Guardian Dry-Run Theater** (must land first). Stage the deliberate BLOCK: agent attempts a dangerous tx (lookalike `888-l.sui` recipient + broken min-out), deterministic Guardian **fails-closed BEFORE signature**, flashes the raw-address mismatch (independently checkable), writes an **immutable Walrus near-miss receipt anchored on a Sui object/digest**. Originality hook = **"on-chain proof that a BLOCK happened, not just that a tx happened."** Reuses locked pipeline + `publishJsonBlob` (verified `walrus-blob.ts:177`) + sign hook (`sui-output-record.ts`). Net-new long poles (already flagged): Cetus/SuiNS PTB builders + `dryRunTransactionBlock` fail-closed gate (verified absent from app code today).

2. **2nd BEAT — Conviction Streak** (deterministic-cap moment only). Every unsigned tx takes a one-line rationale → hashed into an immutable Walrus Blob at decision time. Later the agent quotes your **own past committed rule** back: "you set a $5 cap day 1; this is $40 — FROZEN," citing your immutable receipt. Memory-native (a stateless tool literally cannot do this). The "game" IS the silent per-tx cap made visible → **strengthens** the security headline. Reuses memwal `remember/recall` + Guardian cap. Keep fuzzy LLM "conviction scoring" OUT of the demo path.

3. **GARNISH (only if time):** *Calibration Ledger* folded into the agent (NOT a standalone duel) — agent logs its own probability per call to an append-only Walrus-anchored ledger, shows a Brier/accuracy score on demand (honesty axis, additive to Guardian). *Walrus Receipt Provenance* — tap any past action/block to load its content-addressed proof (shareable, vote-bait, answers "not window dressing").

4. **CUT, do not build:** Streak Vault, Companion Pet, Confidential Sealed-Bid Duel, Memory Heist PvP, Rival Pools/Coach Handoff, Guardian Credit Score SBT, standalone Forecast Duel. They add a 2nd product surface, reward activity over restraint, and several overclaim memwal capabilities the SDK lacks.

## Verified corrections (must fix before pitching)

1. **memwal is the MUTABLE layer.** Tamper-evidence/immutability comes from the **Walrus Blob + a Sui-object HEAD pointer** (`docs/06-research-notes.md:48`), NOT from memwal. Any slide saying "memwal is tamper-evident" is **wrong** and a judge will pull the thread. Pitch: "rationale hashed into an immutable Walrus Blob; streak anchored on a Sui object."
2. **memwal-client.ts exposes only** `isMemoryEnabled / memNamespace / remember / rememberBulk / recall / memoryHealth` — **NO grant/share/ACL/owner.** Any "portable/shareable/Sui-gated memory ownership" feature needs net-new access-control plumbing. Do NOT pitch it unless built (→ kills Portable Passport unless a Walrus/data track justifies the work).
3. **Block flash must be ASYNC** of Walrus write — the red BLOCK must never wait on Walrus latency (known cold-blob pain). Write the receipt async; resolve the link a beat later.

## Changes to apply to the rest of the kit

- `03-security-model.md`: add Demo-packaging note — deliberate Guardian BLOCK = hero beat; near-miss receipt anchored on Sui object/digest; receipts written async (never block the red flash).
- `09-implementation-phases.md`: promote Guardian Dry-Run Theater to explicit P1 demo deliverable; add optional P4 = Conviction Streak cap-callback; mark all other game concepts "evaluated, cut."
- `05-reusable-code-map.md`: add the memwal-mutable + no-ACL correction (applied — see file).
- `10-agent-orchestration-decision.md`: add all gamification surfaces (XP, leaderboards, streaks-as-product, pet, PvP, SBT) to "Defer/do-not-build"; keep ONLY Conviction-Streak cap-callback as optional augment.

## Open questions

1. Exact hackathon + track? Security/DeFi (OZ/OtterSec) → Guardian BLOCK is sole hero. Walrus/data → Portable Passport may become a 2nd beat (needs ACL plumbing).
2. Demo dry-run on live mainnet RPC (credible, network-flake risk) vs canned fixture? Tied to Cetus depth (live SDK vs hardcoded pool) — decide before P1.
3. Per-tx + daily caps still unset — the Conviction Streak "$5 cap" punchline needs the real locked number.
4. Near-miss receipt: anchor on Sui object/digest (recommended, +innovation, adds a Move write path) vs Walrus-blob-only?
5. Did Suithetic win on verifiable EXECUTION or verifiable REASONING? Determines how hard to lean originality on the block-receipt/rationale framing vs Cetus-math correctness.
