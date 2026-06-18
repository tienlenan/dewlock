/**
 * XP / level model — pure, derived from a BadgeInput.
 *
 * XP is earned from ALL mechanics: weighted per-action-type counts, traded
 * volume, and bonus signals (conviction days, security events). Levels come from
 * a deterministic cumulative-XP curve with band titles. Pure + CJS-safe (no IO).
 *
 * Receipts remain the source of truth; XP/level are a deterministic function of
 * them, so they can be recomputed any time and persisted durably (Phase 7).
 */

import type { BadgeInput } from "./user-stats";

/** XP awarded per action of each type (per-action-type progression). */
export const XP_WEIGHTS = {
  transfer: 10,
  swap: 20,
  lend: 30,
  limit: 25,
  bridge: 50,
} as const;

/** Volume contributes 1 XP per $10 moved, capped so it can't dwarf actions. */
const VOLUME_XP_PER_USD = 0.1;
const VOLUME_XP_CAP = 2_000;
/** Bonus XP for durable-good behaviour. */
const CONVICTION_XP_PER_DAY = 5;
const BLOCK_HEEDED_XP = 15;
const LOOKALIKE_DODGED_XP = 25;

/** Total XP for an input — deterministic, monotonic in every component. */
export function xpFromInput(input: BadgeInput): number {
  const a = input.actions;
  const actionXp =
    a.transfer * XP_WEIGHTS.transfer +
    a.swap * XP_WEIGHTS.swap +
    a.lend * XP_WEIGHTS.lend +
    a.limit * XP_WEIGHTS.limit +
    a.bridge * XP_WEIGHTS.bridge;
  const volumeXp = Math.min(VOLUME_XP_CAP, Math.floor(Math.max(0, input.volumeUsd) * VOLUME_XP_PER_USD));
  const convictionXp = (input.convictionDays ?? 0) * CONVICTION_XP_PER_DAY;
  const securityXp =
    (input.blocksHeeded ?? 0) * BLOCK_HEEDED_XP + (input.lookalikeDodged ?? 0) * LOOKALIKE_DODGED_XP;
  return actionXp + volumeXp + convictionXp + securityXp;
}

export interface LevelTier {
  level: number;
  minXp: number;
  title: string;
}

/** Title band for a level. */
function bandTitle(level: number): string {
  if (level >= 25) return "Sentinel Prime";
  if (level >= 20) return "Sentinel";
  if (level >= 15) return "Tactician";
  if (level >= 10) return "Strategist";
  if (level >= 5) return "Operator";
  return "Novice";
}

/**
 * Cumulative-XP thresholds, levels 1..25. Gentle quadratic curve:
 * minXp(level) = round(40 * (level-1)^1.55). Level 1 starts at 0 XP.
 * Generated once at module load — deterministic (no Date/random).
 */
export const LEVELS: LevelTier[] = Array.from({ length: 25 }, (_, i) => {
  const level = i + 1;
  const minXp = level === 1 ? 0 : Math.round(40 * Math.pow(level - 1, 1.55));
  return { level, minXp, title: bandTitle(level) };
});

export interface LevelState {
  level: number;
  xp: number;
  title: string;
  /** XP accumulated within the current level. */
  xpIntoLevel: number;
  /** XP needed to reach the next level (null at max level). */
  xpForNext: number | null;
}

/** Level state from a raw XP value (used for the durable/merged profile). */
export function levelFromXp(xp: number): LevelState {
  let tier = LEVELS[0];
  for (const t of LEVELS) if (xp >= t.minXp) tier = t;
  const next = LEVELS.find((t) => t.level === tier.level + 1) ?? null;
  return {
    level: tier.level,
    xp,
    title: tier.title,
    xpIntoLevel: xp - tier.minXp,
    xpForNext: next ? next.minXp - xp : null,
  };
}

/** Compute the level state for an input. */
export function computeLevel(input: BadgeInput): LevelState {
  return levelFromXp(xpFromInput(input));
}
