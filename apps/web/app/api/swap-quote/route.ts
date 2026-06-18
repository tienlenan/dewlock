/**
 * GET /api/swap-quote?in=<coinType>&out=<coinType>&amount=<native> — indicative
 * swap quote for the swap-form card. Wraps the Cetus aggregator quote, fail-soft:
 * an unroutable pair / slow upstream returns `available:false` (card shows "—"),
 * never a fabricated number. Read-only. The Guardian re-derives min-out at build,
 * so this is purely a display estimate.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";

const RATE_LIMIT_MAX = 60;

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
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, scope: "swap-quote" });
  if (rl.limited) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  const q = req.nextUrl.searchParams;
  const coinIn = q.get("in");
  const coinOut = q.get("out");
  const amount = q.get("amount");
  if (!coinIn?.includes("::") || !coinOut?.includes("::") || !amount || !/^\d+$/.test(amount)) {
    return Response.json(
      { error: "Query params `in`, `out` (coin types) and `amount` (native integer) are required" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }
  if (coinIn === coinOut) {
    return Response.json({ available: false, error: "same coin" }, { headers: corsHeaders(origin) });
  }

  // Fail-soft: unroutable / slow upstream → available:false, never a fabricated number.
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const { fetchAggregatorQuote } = require("@dewlock/sui/aggregator-quotes") as {
      fetchAggregatorQuote: (i: string, o: string, amt: bigint, slip: number) => Promise<{ estimatedAmountOut: bigint; minAmountOut: bigint; routeProviders?: string[] }>;
    };
    const quote = await fetchAggregatorQuote(coinIn, coinOut, BigInt(amount), 50);
    return Response.json(
      {
        available: true,
        estimatedAmountOut: quote.estimatedAmountOut.toString(),
        minAmountOut: quote.minAmountOut.toString(),
        routeProviders: quote.routeProviders ?? [],
      },
      {
        headers: {
          "cache-control": "public, max-age=10",
          "x-content-type-options": "nosniff",
          ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
          ...corsHeaders(origin),
        },
      },
    );
  } catch (err) {
    return Response.json(
      { available: false, error: err instanceof Error ? err.message.slice(0, 120) : "no route" },
      { headers: corsHeaders(origin) },
    );
  }
}
