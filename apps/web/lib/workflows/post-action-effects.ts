/**
 * post-action-effects — runs ALL post-confirm side effects as ONE deterministic,
 * ordered sequence so the receipt blob + XP/badges + anchor actually land after
 * every action:
 *
 *   1. publish        → Walrus blob (immutable receipt) + its on-chain Blob object
 *   2. logAction      → memwal "action log:" line  (the XP source of truth)
 *   3. updateProfile  → recompute level/XP + badges, persist monotonically (backstop)
 *   4. anchor         → on-chain HEAD anchor (operational key; optional package)
 *
 * A plain sequential runner (NOT a Mastra workflow) so each step can report live
 * progress via an onStep callback — the SSE route streams these to a progress dialog.
 * Every step is fail-soft + bounded by a timeout (a dead/slow upstream degrades that
 * step, never hangs the request). The route AWAITS this so a serverless lambda can't
 * freeze before the writes land. Idempotent by txDigest upstream.
 */

import { z } from "zod";
import {
  buildAndPublishReceipt,
  memNamespace,
  rememberBulk,
  recall,
  isMemoryEnabled,
} from "@dewlock/walrus";
import { anchorReceiptHead } from "@dewlock/sui";
import { deriveStats, deriveBadgeInput } from "@dewlock/agent/memory/user-stats";
import { computeBadges } from "@dewlock/agent/memory/badges";
import { computeLevel } from "@dewlock/agent/memory/level";
import { mergeAndPersistProfile } from "@/lib/profile/profile-store";

// Walrus mainnet publish is ~11s typically but occasionally fails/slows
// transiently. Bound EACH attempt, and allow a second attempt within a total
// budget so a blip doesn't drop the receipt blob (the user-visible proof). Both
// fit the route's maxDuration=60 alongside the memwal + profile steps.
const PUBLISH_ATTEMPT_MS = 24_000;
const PUBLISH_TOTAL_BUDGET_MS = 40_000;
// Generous enough for the relayer to ACCEPT a queued write (rememberBulk, ~seconds),
// NOT the full ~30-43s indexing wait.
const MEMWAL_TIMEOUT_MS = 15_000;
const ANCHOR_TIMEOUT_MS = 10_000;
// The durable-profile recompute/persist is a backstop only (dashboard live-derives
// XP). The recall now returns up to 100 rows, so a 5s cap spuriously skipped it;
// 12s lets the recompute land while still leaving the 60s request budget headroom.
const PROFILE_TIMEOUT_MS = 12_000;

/** Reject if `p` doesn't settle within `ms` — bounds each external step. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// Accumulating context — each step augments and returns it.
const ctxSchema = z.object({
  txDigest: z.string().nullable(),
  approvedDigest: z.string().nullable(),
  action: z.string(),
  args: z.record(z.unknown()),
  dryRunEffects: z.unknown().optional(),
  verdict: z.enum(["approved", "blocked"]),
  blockReasons: z.array(z.string()),
  blockGates: z.array(z.string()),
  walletAddress: z.string(),
  // Guardian-computed USD value of the action — recorded in the action-log line so the
  // dashboard's "today via Dewlock" volume + per-receipt USD are real (not $0).
  estimatedUsdValue: z.number().default(0),
  blobId: z.string().nullable(),
  blobObjectId: z.string().nullable(),
  contentHashHex: z.string().nullable(),
  anchorObjectId: z.string().nullable(),
  anchorTxDigest: z.string().nullable(),
  status: z.enum(["pending", "blob_ready", "blob_only", "anchored"]),
  error: z.string().optional(),
});
type Ctx = z.infer<typeof ctxSchema>;

// ---------------------------------------------------------------------------
// Step contract — each step returns the next ctx + a progress outcome
// ---------------------------------------------------------------------------

export type StepId = "publish" | "logAction" | "updateProfile" | "anchor";
export type StepStatus = "running" | "done" | "skipped" | "failed";

export interface StepProgress {
  id: StepId;
  label: string;
  status: StepStatus;
  detail?: string;
}
export type OnStep = (p: StepProgress) => void;

interface StepOutcome {
  ctx: Ctx;
  status: Exclude<StepStatus, "running">;
  detail?: string;
}
type StepFn = (c: Ctx) => Promise<StepOutcome>;

async function stepPublish(c: Ctx): Promise<StepOutcome> {
  const started = Date.now();
  let lastErr = "publish failed";
  // Up to 2 attempts within a total budget — a transient Walrus blip on the
  // first try shouldn't drop the receipt blob. "not_configured" is terminal
  // (no point retrying a missing config).
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = PUBLISH_TOTAL_BUDGET_MS - (Date.now() - started);
    if (left < 5_000) break; // no room for a real second attempt
    try {
      const { blob } = await withTimeout(
        buildAndPublishReceipt({
          txDigest: c.txDigest,
          approvedDigest: c.approvedDigest,
          action: c.action,
          args: c.args,
          dryRunEffects: c.dryRunEffects,
          verdict: c.verdict,
          blockReasons: c.blockReasons,
          blockGates: c.blockGates,
        }),
        Math.min(PUBLISH_ATTEMPT_MS, left),
        "walrus publish",
      );
      if (blob.status === "not_configured") {
        return { ctx: { ...c, status: "blob_only" } as Ctx, status: "skipped", detail: "Walrus not configured" };
      }
      if (blob.blobId && blob.status !== "failed") {
        const ctx = {
          ...c,
          blobId: blob.blobId,
          blobObjectId: blob.objectId ?? null,
          contentHashHex: blob.hash ?? null,
          status: "blob_ready",
        } as Ctx;
        return { ctx, status: "done", detail: `blob ${String(blob.blobId).slice(0, 10)}…${attempt > 0 ? " (retry)" : ""}` };
      }
      lastErr = blob.error ?? "publish failed";
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  return { ctx: { ...c, status: "blob_only", error: lastErr } as Ctx, status: "failed", detail: lastErr };
}

async function stepLogAction(c: Ctx): Promise<StepOutcome> {
  // The action log is the XP source of truth. Only for approved on-chain actions.
  if (!(c.txDigest && c.verdict === "approved" && isMemoryEnabled())) {
    return { ctx: c, status: "skipped", detail: isMemoryEnabled() ? "no on-chain action" : "memory off" };
  }
  const ts = new Date().toISOString();
  const blobPart = c.blobId ? `blob:${c.blobId}` : "blob:pending";
  const line = `action log: ${ts} | ${c.action} | tx:${c.txDigest} | usd:$${(c.estimatedUsdValue ?? 0).toFixed(2)} | ${blobPart}`;
  // This line is the SOLE XP source (user-stats + passport live-derive from it),
  // so a transient relayer blip would permanently lose this action's XP. Retry once.
  // rememberBulk only queues (returns on accept, ~seconds); it indexes async and the
  // dashboard's live recall picks it up.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await withTimeout(rememberBulk(memNamespace(c.walletAddress), [line]), MEMWAL_TIMEOUT_MS, "memwal remember");
      return { ctx: c, status: "done", detail: attempt === 0 ? "XP queued to memwal" : "XP queued (retry)" };
    } catch (err) {
      lastErr = err;
    }
  }
  return { ctx: c, status: "failed", detail: lastErr instanceof Error ? lastErr.message : String(lastErr) };
}

async function stepUpdateProfile(c: Ctx): Promise<StepOutcome> {
  if (!(c.verdict === "approved" && isMemoryEnabled())) {
    return { ctx: c, status: "skipped", detail: "memory off" };
  }
  try {
    const receipts = (await withTimeout(recall(memNamespace(c.walletAddress), "action log:", 100), PROFILE_TIMEOUT_MS, "memwal recall"))
      .filter((l) => l.trim().startsWith("action log:"));
    const stats = deriveStats(receipts);
    const badgeInput = deriveBadgeInput(receipts, { portfolioUsd: 0 }, Date.now());
    const level = computeLevel(badgeInput);
    const badges = computeBadges({ ...badgeInput, level: level.level });
    await withTimeout(
      mergeAndPersistProfile(
        {
          walletAddress: c.walletAddress,
          level: level.level,
          xp: level.xp,
          earnedBadgeIds: badges.earned.map((b) => b.id),
        },
        new Date().toISOString(),
      ),
      PROFILE_TIMEOUT_MS,
      "persist profile",
    ).catch(() => undefined);
    void stats; // stats are derived live by /api/user-stats; profile holds level+badges
    return { ctx: c, status: "done", detail: `level ${level.level}` };
  } catch {
    // fail-soft — dashboard recompute will catch up
    return { ctx: c, status: "skipped", detail: "deferred to dashboard" };
  }
}

async function stepAnchor(c: Ctx): Promise<StepOutcome> {
  if (!c.blobId) return { ctx: c, status: "skipped", detail: "no blob to anchor" };
  try {
    const anchor = await withTimeout(
      anchorReceiptHead({
        walletAddress: c.walletAddress,
        action: c.action,
        blobId: c.blobId,
        contentHash: c.approvedDigest ?? c.contentHashHex ?? "",
      }),
      ANCHOR_TIMEOUT_MS,
      "anchor head",
    );
    const ctx = {
      ...c,
      anchorObjectId: anchor.anchorObjectId,
      anchorTxDigest: anchor.txDigest,
      status: anchor.status === "anchored" ? "anchored" : "blob_only",
    } as Ctx;
    return {
      ctx,
      status: anchor.status === "anchored" ? "done" : "skipped",
      detail: anchor.status === "anchored" ? "HEAD anchored" : "anchor package not deployed",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ctx: { ...c, status: "blob_only", error: msg } as Ctx, status: "failed", detail: msg };
  }
}

const STEPS: { id: StepId; label: string; run: StepFn }[] = [
  { id: "publish", label: "Publishing receipt to Walrus", run: stepPublish },
  { id: "logAction", label: "Writing XP to memwal", run: stepLogAction },
  { id: "updateProfile", label: "Updating profile & badges", run: stepUpdateProfile },
  { id: "anchor", label: "Anchoring on Sui", run: stepAnchor },
];

/** Ordered step metadata — lets a client render the full step list before they run. */
export const POST_ACTION_STEPS = STEPS.map((s) => ({ id: s.id, label: s.label }));

export interface PostActionInput {
  txDigest: string | null;
  approvedDigest: string | null;
  action: string;
  args: Record<string, unknown>;
  dryRunEffects?: unknown;
  verdict: "approved" | "blocked";
  blockReasons: string[];
  blockGates: string[];
  walletAddress: string;
  /** Guardian-computed USD value of the action (defaults to 0 when absent). */
  estimatedUsdValue?: number;
}

export interface PostActionResult {
  status: "blob_ready" | "blob_only" | "anchored";
  blobId: string | null;
  /** On-chain Walrus Blob object id (created by the publish). */
  blobObjectId: string | null;
  anchorObjectId: string | null;
  anchorTxDigest: string | null;
  /** Sui object to surface: HEAD anchor if configured, else the Walrus Blob object. */
  suiObjectId: string | null;
  contentHashHex: string | null;
  error?: string;
}

function toResult(ctx: Ctx): PostActionResult {
  return {
    status: ctx.status === "anchored" ? "anchored" : ctx.blobId ? "blob_ready" : "blob_only",
    blobId: ctx.blobId,
    blobObjectId: ctx.blobObjectId,
    anchorObjectId: ctx.anchorObjectId,
    anchorTxDigest: ctx.anchorTxDigest,
    suiObjectId: ctx.anchorObjectId ?? ctx.blobObjectId ?? null,
    contentHashHex: ctx.contentHashHex,
    error: ctx.error,
  };
}

/**
 * Run the post-action steps in order, reporting live progress via onStep (running
 * before each step, then its terminal status after). Returns the terminal result.
 */
export async function runPostActionEffectsStreaming(
  input: PostActionInput,
  onStep?: OnStep,
): Promise<PostActionResult> {
  let ctx: Ctx = {
    ...input,
    estimatedUsdValue: input.estimatedUsdValue ?? 0,
    blobId: null,
    blobObjectId: null,
    contentHashHex: null,
    anchorObjectId: null,
    anchorTxDigest: null,
    status: "pending",
  };
  for (const step of STEPS) {
    onStep?.({ id: step.id, label: step.label, status: "running" });
    const outcome = await step.run(ctx);
    ctx = outcome.ctx;
    onStep?.({ id: step.id, label: step.label, status: outcome.status, detail: outcome.detail });
  }
  return toResult(ctx);
}

/** Run the post-action workflow to completion and return the terminal result. */
export async function runPostActionEffects(input: PostActionInput): Promise<PostActionResult> {
  return runPostActionEffectsStreaming(input);
}
