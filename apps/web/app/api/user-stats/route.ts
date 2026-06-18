/**
 * GET /api/user-stats?wallet=0x… — per-wallet dashboard data.
 *
 * Two distinct, honestly-separated sources:
 *  - badges + stats  → DERIVED from the immutable Dewlock receipt log recalled
 *    from memwal ("action log: …" lines). This is what the user did THROUGH
 *    Dewlock — the source of truth for rewards. Empty/newbie when memory is off.
 *  - wallet          → the user's FULL on-chain footprint (portfolio USD + tx
 *    activity) from BlockVision. Fail-soft + `degraded` when unavailable; never
 *    a fabricated number.
 *
 * Returns 200 always for a valid wallet (absence of memory/data is not an error).
 * Security: walletAddress is a public on-chain address; no private keys here.
 * recall + BlockVision are read-only; returned text is data, not executable.
 *
 * [needs live-env] real badges require a provisioned memwal account; real wallet
 * data requires a BLOCKVISION_API_KEY with account-endpoint (Pro) access.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { memNamespace, recall, isMemoryEnabled } from "@dewlock/walrus";
import { deriveStats, deriveBadgeInput, parseReceipts, sumVolumeForDate } from "@dewlock/agent/memory/user-stats";
import { computeBadges, badgesFromEarnedIds } from "@dewlock/agent/memory/badges";
import { computeLevel } from "@dewlock/agent/memory/level";
import { getWalletOverview } from "@/lib/blockvision/client";
import { readProfile, reconcileProfile } from "@/lib/profile/profile-store";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";

const WALLET_RE = /^0x[0-9a-fA-F]{1,64}$/;
const RATE_LIMIT_MAX = 30;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
  const ok = allowed.length === 0 || (origin != null && allowed.includes(origin));
  return {
    "access-control-allow-origin": ok && origin ? origin : "null",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** Recall the wallet's receipt log lines from memwal (empty when memory off). */
async function recallReceipts(wallet: string): Promise<string[]> {
  if (!isMemoryEnabled()) return [];
  try {
    const lines = await recall(memNamespace(wallet), "action log:", 100);
    return lines.filter((l) => l.trim().startsWith("action log:"));
  } catch {
    return []; // recall failure is non-fatal — derive an empty (newbie) state
  }
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");

  const ip = clientIp(req.headers);
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, scope: "user-stats" });
  if (rl.limited) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json(
      { error: "Missing or invalid wallet query parameter" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const okHeaders = {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
    ...corsHeaders(origin),
  };

  // Receipts (badge/level source) + wallet footprint (BlockVision) + the durable
  // monotonic profile, all in parallel. readProfile is fail-soft (null on miss).
  const [receipts, wallet_, persisted] = await Promise.all([
    recallReceipts(wallet),
    getWalletOverview(wallet),
    readProfile(wallet),
  ]);

  const stats = deriveStats(receipts);
  // Richer badge input: receipt-derived stats + the wallet's portfolio value
  // (from BlockVision) + wallet age, then level from the combined XP.
  const badgeInput = deriveBadgeInput(receipts, { portfolioUsd: wallet_.totalUsdValue }, Date.now());
  const level = computeLevel(badgeInput);
  const derivedBadges = computeBadges({ ...badgeInput, level: level.level });

  // Render from the MONOTONIC union (durable ∪ derived-now): a badge once earned
  // stays lit even when a volatile source (e.g. BlockVision portfolio value) would
  // not re-award it now. The durable WRITE is scheduled in the background, so the
  // response never blocks on Walrus/memwal.
  const merged = reconcileProfile(
    persisted,
    { walletAddress: wallet, level: level.level, xp: level.xp, earnedBadgeIds: derivedBadges.earned.map((b) => b.id) },
    new Date().toISOString(),
  );
  const badges = badgesFromEarnedIds(merged.earnedBadges.map((b) => b.id));

  // Recent receipts (newest first) + today's volume vs the daily cap — both
  // derived from the same immutable receipt source. This daily figure is an
  // informational view; the enforced daily tracker (prepare-trade) is the authority.
  const parsed = parseReceipts(receipts);
  const recentReceipts = parsed.slice(0, 5);
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const capRaw = Number(process.env.DAILY_USD_CAP);
  const dailyUsage = {
    usedUsd: sumVolumeForDate(parsed, todayPrefix),
    capUsd: Number.isFinite(capRaw) && capRaw > 0 ? capRaw : null,
  };

  return Response.json(
    {
      walletAddress: wallet,
      stats,
      level,
      badges,
      wallet: wallet_,
      recentReceipts,
      dailyUsage,
      memoryEnabled: isMemoryEnabled(),
    },
    { headers: okHeaders },
  );
}
