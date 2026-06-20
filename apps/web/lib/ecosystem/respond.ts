import "server-only";

/**
 * Shared response plumbing for the /api/ecosystem/* routes — keeps the three
 * route files thin (mirrors api/protocols/route.ts: nodejs runtime, OPTIONS,
 * per-IP rate limit, CORS, cache headers). On `unavailable` we still return 200
 * with the envelope (the card renders an empty/unavailable state); 5xx is
 * reserved for unexpected throws.
 */

import { NextRequest } from "next/server";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import type { EcosystemEnvelope } from "./types";

const RATE_LIMIT_MAX = 30; // same budget as the other read-only endpoints
const MAX_LIMIT = 25;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
  const ok = allowed.length === 0 || (origin != null && allowed.includes(origin));
  return {
    "access-control-allow-origin": ok && origin ? origin : "null",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

/** Clamp the optional ?limit= query to a safe 1..25 (else undefined → default). */
function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(1, Math.floor(n)), MAX_LIMIT);
}

export function ecosystemOptions(req: NextRequest): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Run a dataset loader behind rate-limit + CORS + cache headers and return the
 * envelope. `load` receives the clamped limit (or undefined → its own default).
 */
export async function ecosystemResponse<T>(
  req: NextRequest,
  scope: string,
  load: (limit?: number) => Promise<EcosystemEnvelope<T>>,
): Promise<Response> {
  const origin = req.headers.get("origin");
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, scope });
  if (rl.limited) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const envelope = await load(limit);

  return Response.json(envelope, {
    headers: {
      "cache-control": "public, max-age=60",
      "x-content-type-options": "nosniff",
      ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
      ...corsHeaders(origin),
    },
  });
}
