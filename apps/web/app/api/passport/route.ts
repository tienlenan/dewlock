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
import { memNamespace, recall, isMemoryEnabled } from "@dewlock/walrus";
import { buildAndMaybePersistPassport } from "@/lib/passport/passport-store";
import { buildPassport } from "@dewlock/agent/memory/passport";
import { levelFromXp } from "@dewlock/agent/memory/level";
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

  // Recall the action log (XP source). When memory is off, return a newbie passport
  // built from an empty log — honest, never fabricated.
  let lines: string[] = [];
  if (isMemoryEnabled()) {
    try {
      lines = (await recall(memNamespace(wallet), "action log:", 100)).filter((l) => l.trim().startsWith("action log:"));
    } catch {
      lines = [];
    }
  }

  if (!isMemoryEnabled()) {
    const passport = buildPassport(wallet, [], Date.now());
    const lvl = levelFromXp(passport.xp);
    return Response.json(
      { memoryEnabled: false, passport, blobId: null, blobObjectId: null, suiObjectId: null, progress: { xpIntoLevel: lvl.xpIntoLevel, xpForNext: lvl.xpForNext } },
      { headers },
    );
  }

  const result = await buildAndMaybePersistPassport(wallet, lines, Date.now());
  // XP-bar progress, derived live (not persisted in the blob).
  const lvl = levelFromXp(result.passport.xp);
  return Response.json(
    { memoryEnabled: true, ...result, progress: { xpIntoLevel: lvl.xpIntoLevel, xpForNext: lvl.xpForNext } },
    { headers },
  );
}
