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

import { NextRequest } from "next/server";
import { memNamespace, recall, isMemoryEnabled } from "@dewlock/walrus";

const WALLET_RE = /^0x[0-9a-fA-F]{1,64}$/;

export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");

  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json(
      { error: "Missing or invalid wallet query parameter" },
      { status: 400 },
    );
  }

  // When memwal is not configured, return empty gracefully — not a failure.
  if (!isMemoryEnabled()) {
    return Response.json({});
  }

  const ns = memNamespace(wallet);

  try {
    // Run both recalls in parallel — cap query and contact query.
    const [capResults, contactResults] = await Promise.all([
      recall(ns, "risk cap", 1),
      recall(ns, "contact:", 5),
    ]);

    const capEntry = capResults[0] ?? undefined;
    // Filter contact results to only include lines that look like contact entries.
    const contactEntries = contactResults.filter((r) =>
      /^contact:\s*.+\s*=\s*0x[0-9a-fA-F]{64}$/i.test(r.trim()),
    );

    return Response.json({
      capEntry,
      contactEntries: contactEntries.length > 0 ? contactEntries : undefined,
    });
  } catch {
    // Recall failure is non-fatal — return empty so UI falls back to sample chips.
    return Response.json({});
  }
}
