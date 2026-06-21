/**
 * GET /api/defi-positions?wallet=<0x…64hex> — live DeepBook + lending positions.
 *
 * WHY this route exists: the positions card must NOT render a stale tool-result
 * snapshot. After a withdraw/cancel/claim the card refetches here so the displayed
 * balances reflect on-chain truth (never an already-withdrawn balance the user could
 * act on again). Runs the SAME getDefiPositions tool logic the agent uses.
 *
 * Read-only: walletAddress is a public address (never a key); no signing, no secrets.
 * getDefiPositions is fail-soft internally (degrades a failing source to []/null), so
 * a partial RPC outage still returns a well-formed payload rather than throwing.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
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
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, scope: "defi-positions" });
  if (rl.limited) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !/^0x[0-9a-fA-F]{64}$/.test(wallet)) {
    return Response.json(
      { error: "Query param `wallet` (a 0x-prefixed 64-hex-char address) is required" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  try {
    // require() so Turbopack keeps @dewlock/agent out of the static bundle; Node resolves
    // it at runtime (serverExternalPackages in next.config.ts). Same pattern as prepare-trade.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDefiPositions } = require("@dewlock/agent/tools/get-defi-positions") as {
      getDefiPositions: { execute: (input: unknown) => Promise<unknown> };
    };
    const positions = await getDefiPositions.execute({ walletAddress: wallet });
    return Response.json(positions, {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "getDefiPositions error";
    console.error("[api/defi-positions] error:", message);
    return Response.json({ error: message }, { status: 500, headers: corsHeaders(origin) });
  }
}
