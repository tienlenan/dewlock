/**
 * GET /api/passport?wallet=0x… — the user's Dewlock Passport (identity + stats),
 * built live from the immutable receipt action-log, plus the latest persisted proof
 * ids (Walrus blob + on-chain object). Persistence happens in the background when
 * identity changes — this read never blocks on Walrus.
 *
 * Security: walletAddress is public; no keys here. Live stats are the display
 * authority; the blob/object are the shareable proof. Cap/risk are deliberately NOT
 * included (kept private). Returns 200 always for a valid wallet.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getUserStatsPayload } from "@/lib/user-stats/build-user-stats";
import { passportFromUserStats, attachPassportProof } from "@/lib/passport/passport-store";
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

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: RATE_LIMIT_MAX, scope: "passport" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } });
  }
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ error: "Missing or invalid wallet" }, { status: 400, headers: corsHeaders(origin) });
  }
  const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", ...rateLimitHeaders(rl, RATE_LIMIT_MAX), ...corsHeaders(origin) };

  // ONE shared identity for every surface: read-through the same `userstats:` cache the
  // dashboard + copilot use (on-chain receipt log → durable monotonic profile). `?fresh=1`
  // re-derives. The Passport drops portfolio-tier badges (privacy) but otherwise renders
  // the SAME level/xp/counts/badges — so it can never lag behind the copilot again.
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const { payload } = await getUserStatsPayload(wallet, { fresh });
  const passport = passportFromUserStats(payload, Date.now());
  const proof = await attachPassportProof(wallet, passport);
  // XP-bar progress comes from the same level state (not persisted in the blob).
  return Response.json(
    {
      memoryEnabled: payload.memoryEnabled,
      passport: proof.passport,
      blobId: proof.blobId,
      blobObjectId: proof.blobObjectId,
      suiObjectId: proof.suiObjectId,
      progress: { xpIntoLevel: payload.level.xpIntoLevel, xpForNext: payload.level.xpForNext },
    },
    { headers },
  );
}
