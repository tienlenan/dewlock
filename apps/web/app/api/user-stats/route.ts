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
import { getUserStatsPayload } from "@/lib/user-stats/build-user-stats";
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

  // Read-through Redis cache: a hit returns instantly and identically to every surface
  // (dashboard + copilot + passport read the same value → no level/badge mismatch).
  // `?fresh=1` bypasses it to re-derive from the authoritative source (post-tx refresh).
  // "today" uses the VIEWER's local day (client passes tzOffset = Date.getTimezoneOffset();
  // default 0 = UTC for older clients) so a swap made in the local morning isn't dropped.
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const tzRaw = Number(new URL(req.url).searchParams.get("tzOffset"));
  const tzOffsetMinutes = Number.isFinite(tzRaw) ? tzRaw : 0;

  const { payload, cache } = await getUserStatsPayload(wallet, { fresh, tzOffsetMinutes });
  return Response.json(payload, { headers: { ...okHeaders, "x-cache": cache } });
}
