/**
 * Durable per-wallet gamification profile — pure types + monotonic merge.
 *
 * Receipts are the derive-on-read source of truth; this profile is the DURABLE,
 * lifetime record persisted to Walrus (immutable proof) + memwal (recall). The
 * merge is MONOTONIC: a badge once earned is never lost, and level/xp never
 * decrease — even if receipts age out or a derive returns fewer badges. CJS-safe
 * (no IO / no walrus import); the caller persists.
 */

export interface EarnedBadge {
  id: string;
  /** ISO timestamp first observed as earned. */
  earnedAt: string;
}

export interface WalletProfile {
  walletAddress: string;
  level: number;
  xp: number;
  earnedBadges: EarnedBadge[];
  updatedAt: string;
  /** Bumped on each material change — lets the store skip no-op writes. */
  version: number;
}

/** What a fresh derive (from receipts + portfolio) produces. */
export interface DerivedProfile {
  walletAddress: string;
  level: number;
  xp: number;
  earnedBadgeIds: string[];
}

/**
 * Monotonic merge: union of earned badges (earliest earnedAt preserved), max
 * level, max xp. Returns the merged durable profile.
 */
export function monotonicMerge(
  persisted: WalletProfile | null,
  derived: DerivedProfile,
  nowIso: string,
): WalletProfile {
  const existing = new Map((persisted?.earnedBadges ?? []).map((b) => [b.id, b.earnedAt]));
  const allIds = new Set<string>([...existing.keys(), ...derived.earnedBadgeIds]);
  const earnedBadges: EarnedBadge[] = [...allIds]
    .map((id) => ({ id, earnedAt: existing.get(id) ?? nowIso }))
    .sort((a, b) => (a.earnedAt < b.earnedAt ? -1 : a.earnedAt > b.earnedAt ? 1 : a.id.localeCompare(b.id)));

  return {
    walletAddress: derived.walletAddress,
    level: Math.max(persisted?.level ?? 0, derived.level),
    xp: Math.max(persisted?.xp ?? 0, derived.xp),
    earnedBadges,
    updatedAt: nowIso,
    version: (persisted?.version ?? 0) + 1,
  };
}

/** True when the merge changed anything material (badge set / level / xp). */
export function profileChanged(persisted: WalletProfile | null, merged: WalletProfile): boolean {
  if (!persisted) return merged.earnedBadges.length > 0 || merged.level > 0 || merged.xp > 0;
  if (persisted.level !== merged.level || persisted.xp !== merged.xp) return true;
  if (persisted.earnedBadges.length !== merged.earnedBadges.length) return true;
  const ids = new Set(persisted.earnedBadges.map((b) => b.id));
  return merged.earnedBadges.some((b) => !ids.has(b.id));
}
