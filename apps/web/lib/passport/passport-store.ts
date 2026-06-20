/**
 * Passport proof persistence (server-only): public Walrus blob (immutable proof) +
 * memwal pointer + optional on-chain HEAD anchor. The LIVE passport identity comes from
 * the SAME shared, cached, on-chain-derived profile the dashboard + copilot render — so
 * the surfaces never diverge. The blob is REFRESHED once per confirmed action (in the
 * post-action pipeline) so its counts/level stay current; the read path here is read-only.
 *
 * Pointer format: "passport: <blobId> <blobObjectId> <anchorObjectId|-> @ <ts>".
 * The anchor reuses the receipt HEAD module (action="passport"); it degrades to
 * blob-only (not_configured) until the Move package is deployed.
 */

import { memNamespace, rememberBulk, recall, isMemoryEnabled, publishJsonBlob } from "@dewlock/walrus";
import { anchorReceiptHead } from "@dewlock/sui";
import { type DewlockPassport } from "@dewlock/agent/memory/passport";
import type { LevelState } from "@dewlock/agent/memory/level";
import type { UserStats } from "@dewlock/agent/memory/user-stats";
import type { UserStatsPayload } from "@/lib/user-stats/build-user-stats";

const POINTER_PREFIX = "passport:";
const POINTER_RE = /^passport:\s+(\S+)\s+(\S+)\s+(\S+)\s+@\s+(\d+)/;

export interface PassportResult {
  passport: DewlockPassport;
  /** Walrus blob id of the latest persisted passport (null until first persist lands). */
  blobId: string | null;
  /** On-chain Walrus Blob object id. */
  blobObjectId: string | null;
  /** Sui object to surface: HEAD anchor if deployed, else the Walrus Blob object. */
  suiObjectId: string | null;
}

interface PassportPointer {
  blobId: string;
  blobObjectId: string | null;
  anchorObjectId: string | null;
}

function dash(v: string): string | null {
  return v === "-" ? null : v;
}

/** Latest persisted passport proof pointer (blob + object ids) — no blob content read. */
async function readPassportPointer(wallet: string): Promise<PassportPointer | null> {
  if (!isMemoryEnabled()) return null;
  try {
    const lines = await recall(memNamespace(wallet), POINTER_PREFIX, 8);
    let best: { p: PassportPointer; at: number } | null = null;
    for (const line of lines) {
      const m = POINTER_RE.exec(line.trim());
      if (!m) continue;
      const at = Number(m[4]);
      if (!best || at > best.at) {
        best = { p: { blobId: m[1], blobObjectId: dash(m[2]), anchorObjectId: dash(m[3]) }, at };
      }
    }
    return best?.p ?? null;
  } catch {
    return null;
  }
}

/**
 * Shared builder: a derived identity → the Passport. Renders the SAME earned badges
 * (and level/xp/counts) the dashboard + copilot show from the cached on-chain-derived
 * identity, so no surface diverges. (The wallet address is already on the blob and its
 * balance is queryable on-chain, so portfolio-tier badges leak nothing extra.)
 */
export function buildPublicPassport(input: {
  walletAddress: string;
  level: LevelState;
  earnedBadges: { id: string }[];
  stats: UserStats;
  nowMs: number;
}): DewlockPassport {
  return {
    walletAddress: input.walletAddress,
    level: input.level.level,
    xp: input.level.xp,
    title: input.level.title,
    earnedBadgeIds: input.earnedBadges.map((b) => b.id),
    actionCounts: input.stats.actions,
    txCount: input.stats.txCount,
    distinctActions: input.stats.distinctActions,
    memberSince: input.stats.firstTs,
    updatedAt: new Date(input.nowMs).toISOString(),
    schemaVersion: 1,
  };
}

/** Map the shared user-stats payload → a public Passport (same identity the copilot shows). */
export function passportFromUserStats(payload: UserStatsPayload, nowMs: number): DewlockPassport {
  return buildPublicPassport({
    walletAddress: payload.walletAddress,
    level: payload.level,
    earnedBadges: payload.badges.earned,
    stats: payload.stats,
    nowMs,
  });
}

/**
 * Read-only: attach the latest persisted proof ids to a (live) passport. Publishing happens
 * in the post-action pipeline, not here — so the read path never blocks on a Walrus write.
 */
export async function attachPassportProof(wallet: string, passport: DewlockPassport): Promise<PassportResult> {
  const ptr = await readPassportPointer(wallet);
  return {
    passport,
    blobId: ptr?.blobId ?? null,
    blobObjectId: ptr?.blobObjectId ?? null,
    suiObjectId: ptr?.anchorObjectId ?? ptr?.blobObjectId ?? null,
  };
}

/**
 * Publish the public passport blob + pointer — called ONCE per confirmed action so the
 * blob's counts/level stay current. The on-chain HEAD anchor is a Sui tx, so it runs only
 * when identity (level/badges) changed; otherwise the previous anchor is carried forward
 * (a counts-only refresh must not drop the "anchored" proof). Fail-soft.
 */
export async function publishPassportBlob(
  wallet: string,
  passport: DewlockPassport,
  opts: { anchor?: boolean } = {},
): Promise<void> {
  if (!isMemoryEnabled()) return;
  try {
    // Publish the new blob and (for a counts-only refresh) read the prior anchor concurrently.
    const [ptr, prev] = await Promise.all([
      publishJsonBlob("dewlock-passport", passport),
      opts.anchor ? Promise.resolve(null) : readPassportPointer(wallet),
    ]);
    if (!ptr.blobId) return;
    const blobObjectId = ptr.objectId ?? "-";
    let anchorObjectId = "-";
    if (opts.anchor) {
      try {
        const anchor = await anchorReceiptHead({
          walletAddress: wallet,
          action: "passport",
          blobId: ptr.blobId,
          contentHash: ptr.hash ?? "",
        });
        if (anchor.anchorObjectId) anchorObjectId = anchor.anchorObjectId;
      } catch {
        /* anchor not configured / failed → blob-only (degrade) */
      }
    } else if (prev?.anchorObjectId) {
      anchorObjectId = prev.anchorObjectId; // carry the HEAD anchor forward
    }
    await rememberBulk(memNamespace(wallet), [
      `${POINTER_PREFIX} ${ptr.blobId} ${blobObjectId} ${anchorObjectId} @ ${Date.now()}`,
    ]);
  } catch {
    /* fail-soft — the live passport still renders; proof catches up next action */
  }
}
