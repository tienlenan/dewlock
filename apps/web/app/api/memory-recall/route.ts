/**
 * GET /api/memory-recall?wallet=0x… — recall committed cap + contacts for a wallet.
 *
 * Called by useRecalledMemory() in memory-chip.tsx to populate real memory chips.
 * Returns 200 with { capEntry, contactEntries } when memwal is configured and has data.
 * Returns 200 with {} (empty) when memwal is not configured or memory is empty.
 * Never returns a non-2xx for missing memory — absence is not an error.
 *
 * Security: walletAddress is a public on-chain address. No private keys here.
 * memwal recall is read-only; returned text is structured data, not executable.
 *
 * [needs live-env] real results require reachable memwal relayer + provisioned account.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { memNamespace, recall, isMemoryEnabled } from "@dewlock/walrus";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { envCommittedCap } from "@/lib/committed-cap";

const WALLET_RE = /^0x[0-9a-fA-F]{1,64}$/;
// 30 req/min per IP — read-only recall, same budget as prepare-trade.
const RATE_LIMIT_MAX = 30;

// CORS is same-origin only for this endpoint (no cross-origin reads of memwal data).
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
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");

  const ip = clientIp(req.headers);
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, scope: "memory-recall" });
  if (rl.limited) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  const wallet = new URL(req.url).searchParams.get("wallet");

  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json(
      { error: "Missing or invalid wallet query parameter" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  // Shared success headers for all 200 responses from this endpoint.
  const okHeaders = {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
    ...corsHeaders(origin),
  };

  // When memwal is not configured, still surface the committed cap from the server
  // env (it's the real, authoritative cap the wallet operates under) — only the
  // cross-session persistence is unavailable.
  if (!isMemoryEnabled()) {
    return Response.json({ capEntry: envCommittedCap()?.entry }, { headers: okHeaders });
  }

  const ns = memNamespace(wallet);

  try {
    // Run both recalls in parallel — cap query and contact query. memwal recall is
    // SEMANTIC (fuzzy), so it can return unrelated lines (e.g. a "token map:" entry)
    // when no real cap exists yet — must validate the shape, not just truthiness.
    const [capResults, contactResults] = await Promise.all([
      recall(ns, "risk cap", 5),
      recall(ns, "contact:", 5),
    ]);

    // Prefer a real persisted "risk cap:" line; otherwise fall back to the env cap so
    // the chip shows the real cap immediately (the background seed catches up in memwal).
    const capLine = capResults.find((r) => /^risk cap:/i.test(r.trim()));
    const capEntry = capLine ?? envCommittedCap()?.entry;
    // Filter contact results to only include lines that look like contact entries.
    const contactEntries = contactResults.filter((r) =>
      /^contact:\s*.+\s*=\s*0x[0-9a-fA-F]{64}$/i.test(r.trim()),
    );

    return Response.json(
      { capEntry, contactEntries: contactEntries.length > 0 ? contactEntries : undefined },
      { headers: okHeaders },
    );
  } catch {
    // Recall failure is non-fatal — still surface the env-derived cap.
    return Response.json({ capEntry: envCommittedCap()?.entry }, { headers: okHeaders });
  }
}
