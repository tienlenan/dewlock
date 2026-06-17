/**
 * GET /api/metrics — protocol-wide dashboard metrics.
 *
 * Joins the REAL protocol registry (status / build state / enforced-target count)
 * with live TVL (DefiLlama) + honest activity metrics. Every external metric is
 * fail-soft: a failing source renders `unavailable`, never a fabricated number.
 *
 * Read-only, no secrets, no wallet input. Server-side TTL cache + a public
 * max-age so the page never blocks on a slow upstream.
 *
 * [needs live-env] DefiLlama reachability for TVL; a dedicated Sui analytics API
 * for protocol-wide active users / tx count (currently `unavailable`).
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getDashboardMetrics } from "@/lib/metrics/aggregate";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";

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
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX });
  if (rl.limited) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  // getDashboardMetrics is fail-soft internally — it never throws on a bad
  // upstream, returning `unavailable` metrics instead. Guard anyway.
  try {
    const metrics = await getDashboardMetrics();
    return Response.json(metrics, {
      headers: {
        "cache-control": "public, max-age=60",
        "x-content-type-options": "nosniff",
        ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
        ...corsHeaders(origin),
      },
    });
  } catch {
    return Response.json(
      { error: "Metrics temporarily unavailable" },
      { status: 503, headers: corsHeaders(origin) },
    );
  }
}
