/**
 * GET  /api/conversations?wallet=0x…  — list a wallet's saved conversations.
 * POST /api/conversations              — upsert a conversation (Walrus + memwal).
 *
 * Server-only Walrus/memwal access; per-wallet isolation. Fail-soft: when
 * persistence is unavailable, GET returns [] and POST returns ok:false (the
 * client keeps the in-memory conversation). No signable bytes are accepted —
 * the client serializer drops tx-preview cards before POSTing.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { listConversations, upsertConversation, clearConversations, type ConversationRecord } from "@/lib/conversations/conversation-store";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";

const WALLET_RE = /^0x[0-9a-fA-F]{1,64}$/;
const RATE_LIMIT_MAX = 30;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
  const ok = allowed.length === 0 || (origin != null && allowed.includes(origin));
  return {
    "access-control-allow-origin": ok && origin ? origin : "null",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: RATE_LIMIT_MAX, scope: "conversations" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } });
  }
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ error: "Missing or invalid wallet" }, { status: 400, headers: corsHeaders(origin) });
  }
  const conversations = await listConversations(wallet);
  return Response.json({ conversations }, { headers: { "cache-control": "no-store", ...rateLimitHeaders(rl, RATE_LIMIT_MAX), ...corsHeaders(origin) } });
}

function isValidRecord(b: unknown): b is ConversationRecord {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.walletAddress === "string" &&
    WALLET_RE.test(r.walletAddress) &&
    typeof r.title === "string" &&
    typeof r.createdAt === "number" &&
    typeof r.updatedAt === "number" &&
    Array.isArray(r.messages)
  );
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: RATE_LIMIT_MAX, scope: "conversations" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(origin) });
  }
  if (!isValidRecord(body)) {
    return Response.json({ error: "Invalid conversation record" }, { status: 400, headers: corsHeaders(origin) });
  }
  const result = await upsertConversation(body);
  return Response.json(result, { status: result.ok ? 200 : 202, headers: { ...rateLimitHeaders(rl, RATE_LIMIT_MAX), ...corsHeaders(origin) } });
}

/** DELETE /api/conversations?wallet=0x… — clear ALL saved conversations (one atomic write). */
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: RATE_LIMIT_MAX, scope: "conversations" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } });
  }
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ error: "Missing or invalid wallet" }, { status: 400, headers: corsHeaders(origin) });
  }
  const ok = await clearConversations(wallet);
  return Response.json({ ok }, { headers: { ...rateLimitHeaders(rl, RATE_LIMIT_MAX), ...corsHeaders(origin) } });
}
