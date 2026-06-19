/**
 * GET  /api/conversations?wallet=0x…  — list a wallet's saved conversations.
 * POST /api/conversations              — upsert a conversation (Walrus + memwal).
 *
 * POST requires a session write-auth signature ({message, signature} in body alongside
 * the record) — mirrors the contacts/memory write-gate pattern. The signature proves
 * wallet control without a per-write prompt (30-min session token).
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
import { verifyConversationAuth } from "@/lib/conversations/conversation-auth";
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

/** Accept a record with EITHER plaintext messages (legacy) OR encrypted ciphertext (enc). */
function isValidRecord(b: unknown): b is ConversationRecord & { message: string; signature: string } {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  const hasBase =
    typeof r.id === "string" &&
    typeof r.walletAddress === "string" &&
    WALLET_RE.test(r.walletAddress) &&
    typeof r.title === "string" &&
    typeof r.createdAt === "number" &&
    typeof r.updatedAt === "number";
  if (!hasBase) return false;
  // Content must be EITHER legacy plaintext messages OR sealed ciphertext
  const hasContent = Array.isArray(r.messages) || typeof r.enc === "string";
  if (!hasContent) return false;
  // Auth fields required
  return typeof r.message === "string" && typeof r.signature === "string";
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

  // Verify session write-auth before touching the store
  const authed = await verifyConversationAuth({
    wallet: body.walletAddress,
    message: body.message,
    signature: body.signature,
  });
  if (!authed) {
    return Response.json({ error: "Unauthorized" }, { status: 403, headers: corsHeaders(origin) });
  }

  // Strip auth fields before persisting (server stays agnostic of them)
  const { message: _msg, signature: _sig, ...record } = body;
  const result = await upsertConversation(record as ConversationRecord);
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
  // Clear-all has no body (matches existing client call); left ungated for now as per spec.
  const ok = await clearConversations(wallet);
  return Response.json({ ok }, { headers: { ...rateLimitHeaders(rl, RATE_LIMIT_MAX), ...corsHeaders(origin) } });
}
