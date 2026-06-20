import "server-only";

/**
 * Single source of truth for a wallet's derived gamification identity (level / XP /
 * badges / stats), shared by EVERY surface — the dashboard, the copilot profile card
 * (/api/user-stats) AND the Passport (/api/passport). Read-through the `userstats:`
 * Redis cache so all surfaces return the SAME value (no level/badge divergence), and
 * a miss re-derives from the authoritative on-chain receipt log + durable profile.
 *
 * level/xp are read from the durable monotonic profile (never decrease on a partial
 * memwal recall); action counts are a live snapshot (a partial recall must NOT lock
 * them). Badges are the durable union. This is what kept the Passport stale: it used
 * a separate persisted blob + uncached live recall, so it lagged the cached profile.
 */

import { memNamespace, recall, isMemoryEnabled } from "@dewlock/walrus";
import {
  deriveStats,
  deriveBadgeInput,
  parseReceipts,
  parseReceiptLine,
  sumVolumeForLocalDay,
  type UserStats,
} from "@dewlock/agent/memory/user-stats";
import { computeBadges, badgesFromEarnedIds, type BadgeState } from "@dewlock/agent/memory/badges";
import { computeLevel, levelFromXp, type LevelState } from "@dewlock/agent/memory/level";
import { monotonicMerge, profileChanged, type WalletProfile } from "@dewlock/agent/memory/wallet-profile";
import { getWalletOverview } from "@/lib/blockvision/client";
import { readProfile, persistProfile } from "@/lib/profile/profile-store";
import { readStatsCache, writeStatsCache } from "@/lib/user-stats/stats-cache";

export interface UserStatsPayload {
  walletAddress: string;
  stats: UserStats;
  level: LevelState;
  badges: { earned: BadgeState[]; locked: BadgeState[] };
  wallet: Awaited<ReturnType<typeof getWalletOverview>>;
  recentReceipts: ReturnType<typeof parseReceipts>;
  dailyUsage: { usedUsd: number; capUsd: number | null };
  memoryEnabled: boolean;
}

export type CacheStatus = "HIT" | "MISS" | "REFRESH";

export interface BuildOpts {
  /** Bypass the Redis cache and re-derive from the authoritative source (post-tx refresh). */
  fresh?: boolean;
  /** Viewer's Date.getTimezoneOffset() so "today's volume" uses the local day. */
  tzOffsetMinutes?: number;
  /** Just-written "action log:" lines to fold in (deduped by tx) before memwal indexes them. */
  extraReceiptLines?: string[];
  /**
   * Durable-profile write strategy. "background" (default) fires a non-blocking write so the
   * read path never blocks on Walrus. "skip" leaves persistence to the caller — the
   * post-action pipeline awaits it itself (a background write is unreliable in serverless).
   */
  persist?: "background" | "skip";
}

/** Result of a derive: the payload + (when freshly derived) the merged profile + change flag. */
export interface UserStatsResult {
  payload: UserStatsPayload;
  cache: CacheStatus;
  /** Merged durable profile (undefined on a cache HIT). */
  profile?: WalletProfile;
  /** True when identity (level/badges) changed vs the persisted profile (undefined on a HIT). */
  changed?: boolean;
}

/** Recall the wallet's receipt log lines from memwal (empty when memory off / on failure). */
async function recallReceipts(wallet: string): Promise<string[]> {
  if (!isMemoryEnabled()) return [];
  try {
    const lines = await recall(memNamespace(wallet), "action log:", 100);
    return lines.filter((l) => l.trim().startsWith("action log:"));
  } catch {
    return [];
  }
}

/** Fold caller-supplied lines into the recalled set, deduped by tx digest. */
function mergeReceiptLines(recalled: string[], extra?: string[]): string[] {
  if (!extra?.length) return recalled;
  const seen = new Set(parseReceipts(recalled).map((r) => r.txDigest));
  const fresh = extra.filter((line) => {
    const p = parseReceiptLine(line);
    return p ? !seen.has(p.txDigest) : false;
  });
  return fresh.length ? [...recalled, ...fresh] : recalled;
}

/**
 * Build (or read from cache) the canonical user-stats payload for a wallet.
 * Read-through `userstats:` cache; a miss re-derives, reconciles the durable
 * profile (monotonic), and mirrors the result back into the cache.
 */
export async function getUserStatsPayload(
  wallet: string,
  opts: BuildOpts = {},
): Promise<UserStatsResult> {
  const fresh = opts.fresh ?? false;
  if (!fresh) {
    const cached = await readStatsCache<UserStatsPayload>(wallet);
    if (cached) return { payload: cached, cache: "HIT" };
  }

  // Receipts (badge/level source) + wallet footprint (BlockVision) + the durable
  // monotonic profile, all in parallel. readProfile is fail-soft (null on miss).
  const [recalled, wallet_, persisted] = await Promise.all([
    recallReceipts(wallet),
    getWalletOverview(wallet),
    readProfile(wallet),
  ]);
  // Fold in caller-supplied just-written lines (post-action) so counts reflect THIS action
  // even before memwal indexes it (~30-43s); deduped so an already-indexed line isn't doubled.
  const receipts = mergeReceiptLines(recalled, opts.extraReceiptLines);

  const stats = deriveStats(receipts);
  // Richer badge input: receipt-derived stats + the wallet's portfolio value
  // (from BlockVision) + wallet age, then the derived level from the combined XP.
  const badgeInput = deriveBadgeInput(receipts, { portfolioUsd: wallet_.totalUsdValue }, Date.now());
  const derivedLevel = computeLevel(badgeInput);
  const derivedBadges = computeBadges({ ...badgeInput, level: derivedLevel.level });

  // Reconcile against the durable profile (monotonic union): a badge once earned stays lit,
  // and level/xp never decrease on a partial recall. Persistence is background by default
  // (read path never blocks on Walrus); a "skip" caller awaits the write itself.
  const merged = monotonicMerge(
    persisted,
    { walletAddress: wallet, level: derivedLevel.level, xp: derivedLevel.xp, earnedBadgeIds: derivedBadges.earned.map((b) => b.id) },
    new Date().toISOString(),
  );
  const changed = profileChanged(persisted, merged);
  if (changed && opts.persist !== "skip") {
    void persistProfile(wallet, merged).catch(() => {});
  }
  // Level state from the MONOTONIC xp (the durable max) — consistent across surfaces
  // and never flickers down while memwal is mid-index.
  const level = levelFromXp(merged.xp);
  const badges = badgesFromEarnedIds(merged.earnedBadges.map((b) => b.id));

  // Recent receipts (newest first) + today's volume vs the daily cap.
  const parsed = parseReceipts(receipts);
  const recentReceipts = parsed.slice(0, 5);
  const tzOffsetMinutes = opts.tzOffsetMinutes ?? 0;
  const localToday = new Date(Date.now() - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
  const capRaw = Number(process.env.DAILY_USD_CAP);
  const dailyUsage = {
    usedUsd: sumVolumeForLocalDay(parsed, localToday, tzOffsetMinutes),
    capUsd: Number.isFinite(capRaw) && capRaw > 0 ? capRaw : null,
  };

  const payload: UserStatsPayload = {
    walletAddress: wallet,
    stats,
    level,
    badges,
    wallet: wallet_,
    recentReceipts,
    dailyUsage,
    memoryEnabled: isMemoryEnabled(),
  };
  // Mirror the freshly-derived value into the cache (best-effort, non-blocking) so the
  // next read on ANY surface is instant + identical.
  void writeStatsCache(wallet, payload);
  return { payload, cache: fresh ? "REFRESH" : "MISS", profile: merged, changed };
}
