/**
 * GET    /api/conversations/[id]?wallet=0x…  — read a full conversation.
 * DELETE /api/conversations/[id]?wallet=0x…&message=…&signature=…  — drop it from the index.
 *
 * DELETE requires a session write-auth (message + signature as query params) so the
 * unauthenticated-delete hole is closed without a request body on DELETE (which is
 * non-standard and stripped by some edge runtimes).
 *
 * GET is agnostic — returns the record verbatim (enc or messages, whichever is stored).
 * The client detects the presence of `enc` and decrypts client-side.
 *
 * Server-only; per-wallet isolation; fail-soft (404 when missing/unavailable).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { getConversation, getConversationByBlob, removeConversation } from "@/lib/conversations/conversation-store";
import { verifyConversationAuth } from "@/lib/conversations/conversation-auth";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";

const WALLET_RE = /^0x[0-9a-fA-F]{1,64}$/;
const RATE_LIMIT_MAX = 30;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
  const ok = allowed.length === 0 || (origin != null && allowed.includes(origin));
  return {
    "access-control-allow-origin": ok && origin ? origin : "null",
    "access-control-allow-methods": "GET, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

function walletParam(req: NextRequest): string | null {
  const w = new URL(req.url).searchParams.get("wallet");
  return w && WALLET_RE.test(w) ? w : null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: RATE_LIMIT_MAX, scope: "conversations" });
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429, headers: corsHeaders(origin) });
  const w = walletParam(req);
  if (!w) return Response.json({ error: "Missing or invalid wallet" }, { status: 400, headers: corsHeaders(origin) });
  const { id } = await ctx.params;
  // Fast path: the client passes the blobId it already has from the list, so we read
  // the blob directly and skip the index recall (1-2 fewer Walrus round-trips). Falls
  // back to the index lookup when absent or the blob doesn't resolve to this wallet.
  const blobId = new URL(req.url).searchParams.get("blobId");
  const record =
    (blobId && /^[A-Za-z0-9_-]{8,128}$/.test(blobId) ? await getConversationByBlob(w, blobId) : null) ??
    (await getConversation(w, id));
  if (!record) return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders(origin) });
  // Return verbatim — client detects enc vs messages and handles accordingly.
  return Response.json(record, { headers: { "cache-control": "no-store", ...rateLimitHeaders(rl, RATE_LIMIT_MAX), ...corsHeaders(origin) } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: RATE_LIMIT_MAX, scope: "conversations" });
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429, headers: corsHeaders(origin) });
  const w = walletParam(req);
  if (!w) return Response.json({ error: "Missing or invalid wallet" }, { status: 400, headers: corsHeaders(origin) });

  // Auth gate: message + signature as URL-encoded query params (DELETE has no standard body).
  const sp = new URL(req.url).searchParams;
  const message = sp.get("message") ?? "";
  const signature = sp.get("signature") ?? "";
  const authed = await verifyConversationAuth({ wallet: w, message, signature });
  if (!authed) {
    return Response.json({ error: "Unauthorized" }, { status: 403, headers: corsHeaders(origin) });
  }

  const { id } = await ctx.params;
  const ok = await removeConversation(w, id);
  return Response.json({ ok }, { headers: { ...rateLimitHeaders(rl, RATE_LIMIT_MAX), ...corsHeaders(origin) } });
}
