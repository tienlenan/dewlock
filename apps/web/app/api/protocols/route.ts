/**
 * GET /api/protocols — the Sui DeFi protocols Dewlock knows about + their posture.
 *
 * Returns { active, excluded } from the protocol registry. Active protocols are
 * the ones whose Move targets feed the enforced allowlist (when an adapter is
 * built); excluded ones (hacked / off-model) stay listed with their incident so
 * the posture is explicit — but they contribute no targets and are refused
 * before any PTB is built.
 *
 * Security: registry data is static, public posture — no secrets, no keys, no
 * wallet input. Read-only.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  getActiveProtocols,
  getExcludedProtocols,
  type ProtocolEntry,
} from "@dewlock/sui/protocol-registry";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";

// 30 req/min per IP — same budget as the other read-only endpoints.
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

/** Public DTO — every field is non-sensitive posture data. */
function toDto(p: ProtocolEntry) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    status: p.status,
    buildState: p.buildState,
    sdkPackage: p.sdkPackage,
    lastIncident: p.lastIncident,
    guardianNotes: p.guardianNotes,
    /** Number of enforced Move targets (0 until an adapter is built). */
    targetCount: p.allowlistedTargets.length,
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
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

  const body = {
    active: getActiveProtocols().map(toDto),
    excluded: getExcludedProtocols().map(toDto),
  };

  return Response.json(body, {
    headers: {
      "cache-control": "public, max-age=60",
      "x-content-type-options": "nosniff",
      ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
      ...corsHeaders(origin),
    },
  });
}
