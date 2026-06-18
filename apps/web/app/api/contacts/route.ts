/**
 * GET    /api/contacts?wallet=0x…   — list a wallet's friend address book.
 * POST   /api/contacts              — upsert a contact (wallet-signature gated, payload-bound).
 * DELETE /api/contacts?wallet=0x…   — delete one (body.name) or clear all (signature gated).
 *
 * Server-only Walrus/memwal access; per-wallet isolation. Every WRITE requires a fresh
 * personal-message signature bound to the payload (see contacts-signature.ts) — the
 * namespace is keyed only by the public wallet address, so without payload binding a
 * captured signature could be replayed with a swapped address (book poisoning).
 *
 * GET is intentionally UNAUTHENTICATED (parity with /api/conversations). Honest note: this
 * exposes the wallet's labeled name→address graph (a private social graph), not merely data
 * already public on-chain. Accepted tradeoff; the `note` free-text field was cut to limit it.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  listContacts,
  loadBook,
  upsertContact,
  deleteContact,
  clearContacts,
} from "@/lib/contacts/contacts-store";
import { verifyContactsSignature } from "@/lib/contacts/contacts-signature";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";

const WALLET_RE = /^0x[0-9a-fA-F]{1,64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;
const LIST_MAX = 30;
const WRITE_MAX = 10; // writes — tighter budget

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
  const rl = checkRateLimit(clientIp(req.headers), { max: LIST_MAX, scope: "contacts-list" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, LIST_MAX) } });
  }
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ error: "Missing or invalid wallet" }, { status: 400, headers: corsHeaders(origin) });
  }
  // readOk distinguishes a Walrus/memwal outage from a genuinely empty book.
  const { readOk } = await loadBook(wallet);
  const contacts = await listContacts(wallet);
  return Response.json(
    { memoryEnabled: true, readOk, contacts },
    { headers: { "cache-control": "no-store", ...rateLimitHeaders(rl, LIST_MAX), ...corsHeaders(origin) } },
  );
}

interface WriteBody {
  walletAddress?: string;
  name?: string;
  address?: string;
  message?: string;
  signature?: string;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: WRITE_MAX, scope: "contacts-write" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, WRITE_MAX) } });
  }
  const body = (await req.json().catch(() => ({}))) as WriteBody;
  const wallet = body.walletAddress;
  const name = (body.name ?? "").trim();
  const address = (body.address ?? "").trim().toLowerCase();
  if (!wallet || !WALLET_RE.test(wallet) || !name || name.length > 64 || !ADDRESS_RE.test(address)) {
    return Response.json({ error: "Invalid contact (wallet, name ≤64, 0x address required)" }, { status: 400, headers: corsHeaders(origin) });
  }
  if (!body.message || !body.signature || !(await verifyContactsSignature({ op: "upsert", wallet, message: body.message, signature: body.signature, name, address }))) {
    return Response.json({ error: "A valid wallet signature is required." }, { status: 403, headers: corsHeaders(origin) });
  }
  const result = await upsertContact(wallet, { name, address });
  return Response.json(result, { status: result.ok ? 200 : 202, headers: { ...rateLimitHeaders(rl, WRITE_MAX), ...corsHeaders(origin) } });
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: WRITE_MAX, scope: "contacts-write" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, WRITE_MAX) } });
  }
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ error: "Missing or invalid wallet" }, { status: 400, headers: corsHeaders(origin) });
  }
  const body = (await req.json().catch(() => ({}))) as WriteBody;
  const name = (body.name ?? "").trim();
  const op = name ? "delete" : "clear";
  if (!body.message || !body.signature || !(await verifyContactsSignature({ op, wallet, message: body.message, signature: body.signature, name }))) {
    return Response.json({ error: "A valid wallet signature is required." }, { status: 403, headers: corsHeaders(origin) });
  }
  const ok = name ? await deleteContact(wallet, name) : await clearContacts(wallet);
  return Response.json({ ok }, { status: 200, headers: { ...rateLimitHeaders(rl, WRITE_MAX), ...corsHeaders(origin) } });
}
