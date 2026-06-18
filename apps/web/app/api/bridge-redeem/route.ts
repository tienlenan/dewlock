/**
 * POST /api/bridge-redeem — the Sui-side Wormhole redeem guardian flow.
 *
 * Runs prepareBridgeRedeem (parse VAA → 9 bridge gates → build redeem PTB →
 * allowlist + shape → dry-run + WYSIWYS digest). The current guardian-set index
 * is fetched SERVER-SIDE from chain (never trusted from the client) so Gate 8
 * stays fail-closed. A per-wallet daily tracker backs the abuse-rate ceiling.
 *
 * Security: server-only; walletAddress is a public address; the VAA is verified
 * (recipient==self + priced-asset allowlist + on-chain complete_transfer). The
 * redeem PTB is returned for the user's wallet to sign — never signed here.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { fetchCurrentGuardianSetIndex } from "@/lib/wormhole/guardian-set";

const RATE_LIMIT_MAX = 20;

const requestSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address"),
  vaaBase64: z.string().min(1, "vaaBase64 is required").max(20_000),
});

// Per-wallet rolling daily bridged USD (abuse-rate guard; in-memory for the hackathon).
const dailyBridged = new Map<string, number>();
const dayKey = (w: string) => `${w}:${new Date().toISOString().slice(0, 10)}`;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
  const ok = allowed.length === 0 || (origin != null && allowed.includes(origin));
  return {
    "access-control-allow-origin": ok && origin ? origin : "null",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  const rl = checkRateLimit(clientIp(req.headers), { max: RATE_LIMIT_MAX, scope: "bridge-redeem" });
  if (rl.limited) {
    return Response.json(
      { ok: false, reasons: ["Too many requests — please slow down."], gates: ["rate_limit"] },
      { status: 429, headers: { ...cors, ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reasons: ["Invalid JSON body."], gates: ["input_validation"] }, { status: 400, headers: cors });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, reasons: ["Invalid request.", parsed.error.issues[0]?.message ?? ""], gates: ["input_validation"] },
      { status: 400, headers: cors },
    );
  }
  const { walletAddress, vaaBase64 } = parsed.data;

  // Gate 8 input: current guardian-set index, fetched from chain (fail-closed).
  const currentGuardianSetIndex = await fetchCurrentGuardianSetIndex();

  // serverExternalPackages in next.config.ts ensures Node resolves the agent at runtime.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prepareBridgeRedeem } = require("@dewlock/agent/tools/prepare-bridge-redeem") as {
    prepareBridgeRedeem: (input: {
      walletAddress: string;
      vaaBase64: string;
      currentGuardianSetIndex?: number;
      nowMs: number;
      dailyUsdSoFar?: number;
    }) => Promise<{ ok: boolean; preview?: { usdValue: number } } & Record<string, unknown>>;
  };

  const result = await prepareBridgeRedeem({
    walletAddress,
    vaaBase64,
    currentGuardianSetIndex,
    nowMs: Date.now(),
    dailyUsdSoFar: dailyBridged.get(dayKey(walletAddress)) ?? 0,
  });

  if (result.ok && result.preview) {
    const k = dayKey(walletAddress);
    dailyBridged.set(k, (dailyBridged.get(k) ?? 0) + result.preview.usdValue);
  }

  return Response.json(result, {
    status: result.ok ? 200 : 422,
    headers: { "cache-control": "no-store", ...rateLimitHeaders(rl, RATE_LIMIT_MAX), ...cors },
  });
}
