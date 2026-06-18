/**
 * Dewlock Passport — a per-user identity + stats snapshot derived from the immutable
 * receipt action-log (the same source as /api/user-stats). Persisted as a public
 * Walrus blob + memwal pointer (+ optional on-chain HEAD) so a user has a shareable,
 * on-chain-anchored identity.
 *
 * Pure module (no walrus/chain imports) — reuses the XP engine. Privacy: the passport
 * deliberately OMITS the committed cap / risk profile (public blob = recon leak) and
 * volumeUsd (structurally $0 today — no fabricated fields).
 *
 * Monotonicity: level/xp/badges are earned-once → max/union merged. Action counts are
 * a NON-monotonic live snapshot (the action-log recall is semantic + eventually
 * consistent, so a partial read must NOT lock counts via max). The UI treats live
 * /api/user-stats as the display authority; the blob is the shareable proof artifact.
 */

import { deriveStats, deriveBadgeInput } from "./user-stats";
import { computeLevel } from "./level";
import { computeBadges } from "./badges";

export interface PassportActionCounts {
  transfer: number;
  swap: number;
  lend: number;
  bridge: number;
  limit: number;
}

export interface DewlockPassport {
  walletAddress: string;
  level: number;
  xp: number;
  title: string;
  earnedBadgeIds: string[];
  actionCounts: PassportActionCounts;
  txCount: number;
  distinctActions: number;
  /** ISO timestamp of the first action, or null (newbie). */
  memberSince: string | null;
  updatedAt: string;
  schemaVersion: 1;
}

/** Build a passport from receipt action-log lines (pure; deterministic with nowMs). */
export function buildPassport(walletAddress: string, lines: string[], nowMs: number): DewlockPassport {
  const stats = deriveStats(lines);
  const badgeInput = deriveBadgeInput(lines, { portfolioUsd: 0 }, nowMs);
  const level = computeLevel(badgeInput);
  const badges = computeBadges({ ...badgeInput, level: level.level });
  return {
    walletAddress,
    level: level.level,
    xp: level.xp,
    title: level.title,
    earnedBadgeIds: badges.earned.map((b) => b.id),
    actionCounts: stats.actions,
    txCount: stats.txCount,
    distinctActions: stats.distinctActions,
    memberSince: stats.firstTs,
    updatedAt: new Date(nowMs).toISOString(),
    schemaVersion: 1,
  };
}

function earliestIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/**
 * Merge a freshly-derived passport with the persisted one. level/xp = max,
 * badges = union (never un-earn). Counts/txCount/distinctActions take the DERIVED
 * snapshot (NOT max — a partial recall must not lock them). memberSince = earliest.
 * Tolerates an older/partial `prev` (missing fields treated as zero/empty).
 */
export function monotonicMergePassport(
  prev: DewlockPassport | null,
  derived: DewlockPassport,
): DewlockPassport {
  if (!prev) return derived;
  const level = Math.max(prev.level ?? 0, derived.level);
  return {
    ...derived,
    level,
    xp: Math.max(prev.xp ?? 0, derived.xp),
    // Title follows the higher level (don't downgrade on a partial re-derive).
    title: derived.level >= (prev.level ?? 0) ? derived.title : prev.title,
    earnedBadgeIds: [...new Set([...(prev.earnedBadgeIds ?? []), ...derived.earnedBadgeIds])],
    memberSince: earliestIso(prev.memberSince ?? null, derived.memberSince),
  };
}

/** True when the identity-defining fields changed — gates the (expensive) blob publish. */
export function passportIdentityChanged(prev: DewlockPassport | null, next: DewlockPassport): boolean {
  if (!prev) return true;
  if (prev.level !== next.level) return true;
  const a = [...(prev.earnedBadgeIds ?? [])].sort().join(",");
  const b = [...next.earnedBadgeIds].sort().join(",");
  return a !== b;
}
