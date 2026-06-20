/**
 * GET  /api/memory?wallet=0x…           — list memwal categories (approximate counts + samples).
 * DELETE /api/memory?wallet=0x…&category=… — clear a clearable category (wallet-signature gated).
 *
 * Security: memwal is keyed only by public wallet address with NO session auth, so a
 * destructive DELETE MUST prove wallet control — the body carries a personal-message
 * signature ("clear-memory:<wallet>:<ts>") verified server-side. Without a valid sig → 403.
 * Only POINTER-BACKED categories are clearable (overwrite); append-only ones (action log,
 * contacts) have no delete API and are reported {cleared:false} honestly — never faked.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { memNamespace, recallByPrefix, isMemoryEnabled } from "@dewlock/walrus";
import { MEMORY_CATEGORIES, getCategory } from "@/lib/memory/memory-inventory";
import { clearConversations, listConversations } from "@/lib/conversations/conversation-store";
import { listContacts, clearContacts } from "@/lib/contacts/contacts-store";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";

const WALLET_RE = /^0x[0-9a-fA-F]{1,64}$/;
const LIST_MAX = 30;
const CLEAR_MAX = 10; // destructive — tighter budget
const SIG_MAX_AGE_MS = 5 * 60_000; // signed clear request valid for 5 min

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

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: LIST_MAX, scope: "memory-list" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, LIST_MAX) } });
  }
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ error: "Missing or invalid wallet" }, { status: 400, headers: corsHeaders(origin) });
  }
  const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", ...rateLimitHeaders(rl, LIST_MAX), ...corsHeaders(origin) };

  if (!isMemoryEnabled()) {
    return Response.json({ memoryEnabled: false, categories: [] }, { headers });
  }
  const ns = memNamespace(wallet);
  // Approximate (memwal has no enumerate API — recall is semantic + prefix-filtered).
  const categories = await Promise.all(
    MEMORY_CATEGORIES.map(async (c) => {
      // The friend address book is blob-backed (not per-line recall) — count + sample
      // it from the book so deleted contacts don't linger in stale `contact:` lines.
      if (c.key === "contact") {
        const contacts = await listContacts(wallet).catch(() => []);
        return {
          key: c.key, label: c.label, description: c.description, scope: c.scope,
          clearable: c.clearable, permanentReason: c.permanentReason,
          approxCount: contacts.length,
          samples: contacts.slice(0, 3).map((ct) => `${ct.name} = ${ct.address}`),
        };
      }
      // Conversations now live in Redis (exact count), not memwal. Titles are
      // client-encrypted, so we report the count only — no plaintext samples.
      if (c.key === "conversation-index") {
        const convos = await listConversations(wallet).catch(() => []);
        return {
          key: c.key, label: c.label, description: c.description, scope: c.scope,
          clearable: c.clearable, permanentReason: c.permanentReason,
          approxCount: convos.length,
          samples: convos.slice(0, 3).map(() => "🔒 (encrypted title)"),
        };
      }
      const lines = await recallByPrefix(ns, c.prefix, 50).catch(() => []);
      return {
        key: c.key, label: c.label, description: c.description, scope: c.scope,
        clearable: c.clearable, permanentReason: c.permanentReason,
        approxCount: lines.length,
        samples: lines.slice(0, 3).map((l) => (l.length > 120 ? `${l.slice(0, 117)}…` : l)),
      };
    }),
  );
  return Response.json({ memoryEnabled: true, approximate: true, categories }, { headers });
}

/** Verify the personal-message signature proves control of `wallet`. */
async function verifyClearSignature(wallet: string, message: string, signature: string): Promise<boolean> {
  // Expected: "clear-memory:<wallet>:<timestamp>", recent.
  const m = /^clear-memory:(0x[0-9a-fA-F]{1,64}):(\d+)$/.exec(message);
  if (!m || m[1].toLowerCase() !== wallet.toLowerCase()) return false;
  const ts = Number(m[2]);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > SIG_MAX_AGE_MS) return false;
  try {
    const pubkey = await verifyPersonalMessageSignature(new TextEncoder().encode(message), signature);
    return pubkey.toSuiAddress().toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const rl = checkRateLimit(clientIp(req.headers), { max: CLEAR_MAX, scope: "memory-clear" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, CLEAR_MAX) } });
  }
  const wallet = new URL(req.url).searchParams.get("wallet");
  const category = new URL(req.url).searchParams.get("category") ?? "all";
  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ error: "Missing or invalid wallet" }, { status: 400, headers: corsHeaders(origin) });
  }

  // Wallet-signature gate — proves the caller controls this wallet (no session auth exists).
  const body = (await req.json().catch(() => ({}))) as { message?: string; signature?: string };
  if (!body.message || !body.signature || !(await verifyClearSignature(wallet, body.message, body.signature))) {
    return Response.json(
      { error: "A valid wallet signature is required to clear memory." },
      { status: 403, headers: corsHeaders(origin) },
    );
  }

  const targets = category === "all" ? MEMORY_CATEGORIES : MEMORY_CATEGORIES.filter((c) => c.key === category);
  if (category !== "all" && !getCategory(category)) {
    return Response.json({ error: "Unknown category" }, { status: 400, headers: corsHeaders(origin) });
  }

  const results: Array<{ key: string; cleared: boolean; reason?: string }> = [];
  for (const c of targets) {
    if (!c.clearable) {
      results.push({ key: c.key, cleared: false, reason: c.permanentReason ?? "not clearable" });
      continue;
    }
    try {
      if (c.key === "conversation-index") {
        const ok = await clearConversations(wallet);
        results.push({ key: c.key, cleared: ok, reason: ok ? undefined : "clear failed" });
      } else if (c.key === "contact") {
        const ok = await clearContacts(wallet);
        results.push({ key: c.key, cleared: ok, reason: ok ? undefined : "clear failed" });
      } else {
        results.push({ key: c.key, cleared: false, reason: "no clear handler" });
      }
    } catch {
      results.push({ key: c.key, cleared: false, reason: "clear error" });
    }
  }
  return Response.json({ ok: true, results }, { status: 200, headers: corsHeaders(origin) });
}
