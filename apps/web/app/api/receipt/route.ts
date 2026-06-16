/**
 * POST /api/receipt — async Walrus blob receipt + Sui anchor writer.
 * GET  /api/receipt?txDigest=… — poll readiness of a previously submitted receipt.
 *
 * Called AFTER the user has signed (or after a BLOCK verdict).
 * NEVER blocks the sign UX — client fires-and-forgets, then polls via GET.
 *
 * Security invariants:
 *  - No user-fund keys server-side. The blob signer is WALRUS_SDK_WALLET_KEY
 *    (operational key only). The anchor signer is the SAME key.
 *  - walletAddress is a public on-chain address, never a private key.
 *  - Input validated at boundary with Zod.
 *
 * Idempotency: keyed by txDigest (or "block:{contentHash}" for BLOCKs).
 * Re-POST on the same txDigest returns the cached result — publishJsonBlob is
 * content-addressed, so a duplicate PUT returns already_certified.
 *
 * Runtime: nodejs (blob.ts uses node:child_process / node:fs for CLI fallback).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { z } from "zod";
import { buildAndPublishReceipt, contentHash, memNamespace, remember, isMemoryEnabled } from "@dewlock/walrus";
import { anchorReceiptHead } from "@dewlock/sui";

// ---------------------------------------------------------------------------
// In-process receipt cache (keyed by txDigest)
// Hackathon-safe: per-lambda-instance cache; sufficient for demo.
// ---------------------------------------------------------------------------

interface ReceiptCacheEntry {
  status: "pending" | "blob_ready" | "anchored" | "blob_only";
  blobId: string | null;
  anchorObjectId: string | null;
  anchorTxDigest: string | null;
  contentHashHex: string | null;
  error?: string;
}

const receiptCache = new Map<string, ReceiptCacheEntry>();

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const postSchema = z.object({
  /** On-chain tx digest for approved actions; null for BLOCK receipts. */
  txDigest: z.string().nullable(),
  /** Guardian-approved PTB digest (WYSIWYS hash); null for BLOCKs. */
  approvedDigest: z.string().nullable(),
  /** Action type string (e.g. "transfer", "swap", "limit_order", "near_miss"). */
  action: z.string().min(1).max(64),
  /**
   * Structured action arguments — public data only (no secrets).
   * walletAddress is the signer's public address, never a key.
   */
  args: z.record(z.unknown()).default({}),
  /** Dry-run balance deltas for approved; block reasons for BLOCK. */
  dryRunEffects: z.unknown().optional(),
  /** "approved" or "blocked" verdict from the Guardian. */
  verdict: z.enum(["approved", "blocked"]),
  /** Block reasons (empty for approved actions). */
  blockReasons: z.array(z.string()).default([]),
  /** Gate identifiers that fired (empty for approved). */
  blockGates: z.array(z.string()).default([]),
  /**
   * The signer's public wallet address — used to key the Sui anchor HEAD object.
   * Public on-chain data only — never a private key.
   */
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{1,64}$/, "Must be a 0x-prefixed hex Sui address"),
});

type PostBody = z.infer<typeof postSchema>;

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
  const ok = allowed.length === 0 || (origin != null && allowed.includes(origin));
  return {
    "access-control-allow-origin": ok && origin ? origin : "null",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

// ---------------------------------------------------------------------------
// Cache key derivation — txDigest for approved; content hash for BLOCKs
// ---------------------------------------------------------------------------

function cacheKey(body: PostBody): string {
  if (body.txDigest) return body.txDigest;
  // BLOCK receipts have no tx digest — use content hash of the receipt payload.
  const hash = contentHash({
    action: body.action,
    verdict: body.verdict,
    blockReasons: body.blockReasons,
    walletAddress: body.walletAddress,
  });
  return `block:${hash}`;
}

// ---------------------------------------------------------------------------
// Receipt publish + anchor (called once per unique txDigest)
// ---------------------------------------------------------------------------

async function processReceipt(body: PostBody, key: string): Promise<void> {
  // Mark as pending immediately so GET polls return a consistent state.
  receiptCache.set(key, {
    status: "pending",
    blobId: null,
    anchorObjectId: null,
    anchorTxDigest: null,
    contentHashHex: null,
  });

  try {
    // Step 1: Publish the blob receipt (cascade: HTTP → SDK → CLI).
    const { blob, receipt } = await buildAndPublishReceipt({
      txDigest: body.txDigest,
      approvedDigest: body.approvedDigest,
      action: body.action,
      args: body.args,
      dryRunEffects: body.dryRunEffects,
      verdict: body.verdict,
      blockReasons: body.blockReasons,
      blockGates: body.blockGates,
    });

    const blobId = blob.blobId;

    // Async decision log alongside the blob receipt — fire-and-forget, never blocking.
    // [needs live-env] memwal relayer must be reachable for this write to persist.
    if (body.txDigest && body.verdict === "approved" && isMemoryEnabled()) {
      const ts = new Date().toISOString();
      const blobPart = blobId ? `blob:${blobId}` : "blob:pending";
      const logText =
        `action log: ${ts} | ${body.action} | tx:${body.txDigest} | usd:$0.00 | ${blobPart}`;
      void remember(memNamespace(body.walletAddress), logText).catch(() => undefined);
    }

    if (!blobId || blob.status === "not_configured" || blob.status === "failed") {
      // Blob write failed or not configured — update cache with error state.
      receiptCache.set(key, {
        status: "blob_only",
        blobId: null,
        anchorObjectId: null,
        anchorTxDigest: null,
        contentHashHex: blob.hash,
        error: blob.error ?? "blob not configured",
      });
      return;
    }

    // Step 2: Anchor HEAD on-chain (operational key; degrade on failure).
    const anchor = await anchorReceiptHead({
      walletAddress: body.walletAddress,
      action: body.action,
      blobId,
      contentHash: receipt.approvedDigest ?? blob.hash,
    });

    receiptCache.set(key, {
      status: anchor.status === "anchored" ? "anchored" : "blob_only",
      blobId,
      anchorObjectId: anchor.anchorObjectId,
      anchorTxDigest: anchor.txDigest,
      contentHashHex: blob.hash,
      error: anchor.error,
    });
  } catch (err) {
    receiptCache.set(key, {
      status: "blob_only",
      blobId: null,
      anchorObjectId: null,
      anchorTxDigest: null,
      contentHashHex: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const body = parsed.data;
  const key = cacheKey(body);

  // Idempotency: if already in cache, return current state immediately.
  const cached = receiptCache.get(key);
  if (cached) {
    return Response.json(
      { key, ...cached },
      { status: 200, headers: corsHeaders(origin) },
    );
  }

  // Start the async receipt pipeline (do NOT await — return immediately).
  // The client polls GET /api/receipt?txDigest=… for the result.
  void processReceipt(body, key);

  return Response.json(
    { key, status: "pending", blobId: null, anchorObjectId: null, anchorTxDigest: null },
    { status: 202, headers: corsHeaders(origin) },
  );
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { searchParams } = new URL(req.url);

  const txDigest = searchParams.get("txDigest");
  const key = txDigest ?? searchParams.get("key");

  if (!key) {
    return Response.json(
      { error: "Missing txDigest or key query parameter" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const cached = receiptCache.get(key);
  if (!cached) {
    return Response.json(
      { status: "not_found" },
      { status: 404, headers: corsHeaders(origin) },
    );
  }

  return Response.json(
    { key, ...cached },
    { status: 200, headers: corsHeaders(origin) },
  );
}
