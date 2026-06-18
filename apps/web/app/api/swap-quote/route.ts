/**
 * GET /api/swap-quote?in=<coinType>&out=<coinType>&amount=<native>
 *
 * Returns indicative quotes from BOTH available swap sources (Cetus Aggregator
 * and Aftermath Router) in parallel, plus the best source by highest output.
 * Fail-soft per source: an unroutable pair / slow upstream returns available:false
 * for that source (card shows "—"). Never fabricates numbers.
 *
 * The Guardian re-derives min-out at build time for whichever source is chosen,
 * so these are purely display estimates.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

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

type QuoteModule = {
  fetchAggregatorQuote?: (i: string, o: string, amt: bigint, slip: number) => Promise<{ estimatedAmountOut: bigint; minAmountOut: bigint; routeProviders?: string[] }>;
  fetchAftermathQuote?: (i: string, o: string, amt: bigint, slip: number) => Promise<{ estimatedAmountOut: bigint; minAmountOut: bigint; routeProviders?: string[] }>;
};

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
    return Response.json({ sources: [], best: null }, { headers: corsHeaders(origin) });
  }

  /* eslint-disable @typescript-eslint/no-require-imports */
  const aggMod = require("@dewlock/sui/aggregator-quotes") as QuoteModule;
  const afMod = require("@dewlock/sui/aftermath-quotes") as QuoteModule;
  /* eslint-enable @typescript-eslint/no-require-imports */

  const amountBig = BigInt(amount);

  const [aggResult, afResult] = await Promise.allSettled([
    aggMod.fetchAggregatorQuote!(coinIn, coinOut, amountBig, 50),
    afMod.fetchAftermathQuote!(coinIn, coinOut, amountBig, 50),
  ]);

  type SourceEntry = {
    source: string;
    available: boolean;
    estimatedAmountOut?: string;
    minAmountOut?: string;
    routeProviders?: string[];
    error?: string;
  };

  const sources: SourceEntry[] = [];
  let bestSource: string | null = null;
  let bestAmount = 0n;

  if (aggResult.status === "fulfilled") {
    const qt = aggResult.value;
    sources.push({ source: "aggregator", available: true, estimatedAmountOut: qt.estimatedAmountOut.toString(), minAmountOut: qt.minAmountOut.toString(), routeProviders: qt.routeProviders ?? [] });
    if (qt.estimatedAmountOut > bestAmount) { bestAmount = qt.estimatedAmountOut; bestSource = "aggregator"; }
  } else {
    sources.push({ source: "aggregator", available: false, error: aggResult.reason instanceof Error ? aggResult.reason.message.slice(0, 120) : "no route" });
  }

  if (afResult.status === "fulfilled") {
    const qt = afResult.value;
    sources.push({ source: "aftermath", available: true, estimatedAmountOut: qt.estimatedAmountOut.toString(), minAmountOut: qt.minAmountOut.toString(), routeProviders: qt.routeProviders ?? [] });
    if (qt.estimatedAmountOut > bestAmount) { bestAmount = qt.estimatedAmountOut; bestSource = "aftermath"; }
  } else {
    sources.push({ source: "aftermath", available: false, error: afResult.reason instanceof Error ? afResult.reason.message.slice(0, 120) : "no route" });
  }

  // Legacy compat: also expose the best source's estimatedAmountOut at top level
  // so old card code (single-source) still works without changes.
  const bestEntry = sources.find((s) => s.source === bestSource);

  return Response.json(
    {
      sources,
      best: bestSource,
      // legacy flat fields (used by older swap-form-card versions)
      available: bestEntry?.available ?? false,
      estimatedAmountOut: bestEntry?.estimatedAmountOut,
      minAmountOut: bestEntry?.minAmountOut,
      routeProviders: bestEntry?.routeProviders ?? [],
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
}
