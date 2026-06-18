/**
 * GET /api/lend-options?coin=<coinType> — live supply APY for the lend picker.
 *
 * Returns each built lending protocol's current supply APY for the coin, fail-soft:
 * an unreachable/odd upstream renders `null` (the card shows "—"), never a fabricated
 * rate. Read-only, no secrets, no wallet input. Short public cache shields the source.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getLendSupplyApy } from "@/lib/lend/lend-apy";
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
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, scope: "lend-options" });
  if (rl.limited) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  const coin = req.nextUrl.searchParams.get("coin");
  if (!coin || !coin.includes("::")) {
    return Response.json(
      { error: "Query param `coin` (a canonical 0x…::module::TYPE coin type) is required" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  // getLendSupplyApy is fail-soft internally (null per protocol on a bad upstream).
  const apyByProtocol = await getLendSupplyApy(coin);
  return Response.json(
    { coin, apyByProtocol },
    {
      headers: {
        "cache-control": "public, max-age=60",
        "x-content-type-options": "nosniff",
        ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
        ...corsHeaders(origin),
      },
    },
  );
}
