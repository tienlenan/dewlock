/**
 * POST /api/receipt/stream — Server-Sent Events stream of the post-action receipt
 * pipeline (Walrus blob publish → memwal XP write → profile/badges → Sui anchor).
 *
 * Emits, in order:
 *   event: steps  data: { steps: [{id,label}, …] }   (the full step list up front)
 *   event: step   data: { id, label, status, detail } (running, then done/skipped/failed)
 *   event: done   data: PostActionResult              (blobId, suiObjectId, …)
 *
 * Lets the client render a live progress dialog for the ~20s the writes take instead
 * of a frozen spinner. Same security posture as /api/receipt: no user-fund keys, the
 * blob/anchor signer is the operational WALRUS_SDK_WALLET_KEY, walletAddress is public.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { z } from "zod";
import { runPostActionEffectsStreaming, POST_ACTION_STEPS } from "@/lib/workflows/post-action-effects";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const RATE_LIMIT_MAX = 20;

const postSchema = z.object({
  txDigest: z.string().nullable(),
  approvedDigest: z.string().nullable(),
  action: z.string().min(1).max(64),
  args: z.record(z.unknown()).default({}),
  dryRunEffects: z.unknown().optional(),
  verdict: z.enum(["approved", "blocked"]),
  blockReasons: z.array(z.string()).default([]),
  blockGates: z.array(z.string()).default([]),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{1,64}$/, "Must be a 0x-prefixed hex Sui address"),
  estimatedUsdValue: z.number().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, scope: "receipt-stream" });
  if (rl.limited) {
    return Response.json({ error: "Too many requests — please slow down." }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        send("steps", { steps: POST_ACTION_STEPS });
        const result = await runPostActionEffectsStreaming(body, (p) => send("step", p));
        send("done", result);
      } catch (err) {
        send("error", { error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-content-type-options": "nosniff",
    },
  });
}
