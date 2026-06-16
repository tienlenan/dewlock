/**
 * POST /api/prepare-trade — deterministic trade preparation (no LLM).
 *
 * WHY this route exists: stage-demo reliability. The LLM path (/api/agent) can
 * time out or give ambiguous responses under live conditions. This endpoint runs
 * the exact same prepareTrade tool logic directly, returning a structured result
 * the UI can render immediately. Used by demo quick-action buttons.
 *
 * Security invariants (same as agent route):
 *  - Server-only: no signing key, no private data.
 *  - walletAddress is a public on-chain address — never a key.
 *  - Guardian runs inside prepareTrade — PTB never returned on block.
 *  - Input validated at boundary with Zod before any tool execution.
 *  - CORS locked to app origin.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getDemoMode, getFixtureNearMissBlock } from "@/lib/demo/fixtures";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";

// 30 req/min per IP — deterministic endpoint, tighter than the streaming agent.
const RATE_LIMIT_MAX = 30;
import { recall, isMemoryEnabled } from "@dewlock/walrus";
import {
  recallCommittedCap,
  formatCapBlockWithRecall,
  type MemwalIO,
} from "@dewlock/agent/memory/conviction-streak";

// ---------------------------------------------------------------------------
// Input schema — mirrors prepareTrade inputSchema exactly (subset surface)
// ---------------------------------------------------------------------------

const SUPPORTED_COIN_TYPES = [
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
  "0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH",
  "0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN",
] as const;

type SupportedCoinType = (typeof SUPPORTED_COIN_TYPES)[number];

const requestSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address"),

  actionType: z.enum(["transfer", "swap", "near_miss_fixture"]),

  coinTypeIn: z.enum(SUPPORTED_COIN_TYPES as readonly [SupportedCoinType, ...SupportedCoinType[]]).optional(),

  coinTypeOut: z
    .enum(SUPPORTED_COIN_TYPES as readonly [SupportedCoinType, ...SupportedCoinType[]])
    .optional(),

  recipientInput: z
    .string()
    .optional()
    .describe("Raw 0x address or .sui name for transfers"),

  amountInNative: z
    .string()
    .regex(/^\d+$/, "Must be a non-negative integer string (native units)")
    .optional(),

  slippageBps: z.number().int().min(0).max(5000).optional(),

  argProvenance: z
    .object({
      recipient: z.enum(["user_turn", "derived"]).optional(),
      amount: z.enum(["user_turn", "derived"]).optional(),
      coinType: z.enum(["user_turn", "derived"]).optional(),
    })
    .default({}),

  verifiedContacts: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
  const isAllowed =
    allowedOrigins.length === 0 || (origin != null && allowedOrigins.includes(origin));
  return {
    "access-control-allow-origin": isAllowed && origin ? origin : "null",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

// ---------------------------------------------------------------------------
// Cap-block enrichment — surface recalled day-1 cap in block reason text
// ---------------------------------------------------------------------------

/**
 * When the Guardian blocks on tx_cap or daily_cap, recall the user's committed
 * cap from memwal and replace the generic reason with a legible recall-based message.
 * Best-effort: returns original result unchanged on any error or when memwal not configured.
 */
async function enrichCapBlockWithRecall(
  result: unknown,
  walletAddress: string,
): Promise<unknown> {
  const r = result as { ok?: boolean; gates?: string[]; reasons?: string[] };
  if (r.ok !== false || !r.gates || !r.reasons) return result;

  const capGateIdx = r.gates.findIndex((g) => g === "tx_cap" || g === "daily_cap");
  if (capGateIdx === -1 || !isMemoryEnabled()) return result;

  try {
    const io: MemwalIO = { remember: async () => undefined, recall };
    const ns = `dewlock:${walletAddress}`;
    const recalled = await recallCommittedCap(io, ns);
    if (!recalled) return result;

    const capGate = r.gates[capGateIdx] as "tx_cap" | "daily_cap";
    const enrichedReasons = r.reasons.map((reason, i) =>
      r.gates![i] === capGate
        ? formatCapBlockWithRecall(0, recalled, capGate)
        : reason,
    );
    return { ...r, reasons: enrichedReasons };
  } catch {
    return result;
  }
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Rate-limit: fail before body parsing.
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX });
  if (rl.limited) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const input = parsed.data;

  // Short-circuit: near-miss fixture BLOCK — returns deterministic fixture data
  // without calling prepareTrade. Only served when demoMode === "fixture".
  // Never executes on mainnet: source:"fixture" is checked by the UI.
  if (input.actionType === "near_miss_fixture") {
    if (getDemoMode() !== "fixture") {
      return Response.json(
        { error: "near_miss_fixture is only available in NEXT_PUBLIC_DEMO_MODE=fixture" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }
    return Response.json(getFixtureNearMissBlock(), {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
        ...corsHeaders(origin),
      },
    });
  }

  try {
    // coinTypeIn is required for transfer/swap paths (optional only for near_miss_fixture).
    if (!input.coinTypeIn || !input.amountInNative) {
      return Response.json(
        { error: "coinTypeIn and amountInNative are required for transfer/swap actions" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // Use require() so Turbopack excludes @dewlock/agent from the static bundle.
    // serverExternalPackages in next.config.ts ensures Node resolves at runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prepareTrade } = require("@dewlock/agent/tools/prepare-trade") as {
      prepareTrade: {
        execute: (input: unknown) => Promise<unknown>;
      };
    };

    const result = await prepareTrade.execute({
      walletAddress: input.walletAddress,
      actionType: input.actionType,
      coinTypeIn: input.coinTypeIn,
      coinTypeOut: input.coinTypeOut,
      recipientInput: input.recipientInput,
      amountInNative: input.amountInNative,
      slippageBps: input.slippageBps ?? 50,
      actionLabel:
        input.actionType === "transfer"
          ? `Transfer ${input.amountInNative} native units`
          : `Swap ${input.amountInNative} native units`,
      argProvenance: input.argProvenance,
      verifiedContacts: input.verifiedContacts ?? [],
    });

    // Enrich cap-block reason with recalled day-1 cap when memwal is configured.
    // The Guardian cap gate is still authoritative; this only makes the block legible.
    const enrichedResult = await enrichCapBlockWithRecall(result, input.walletAddress);

    return Response.json(enrichedResult, {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "prepareTrade error";
    console.error("[api/prepare-trade] error:", message);
    return Response.json(
      { error: message },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export async function GET() {
  return Response.json(
    { error: "Method not allowed. Use POST /api/prepare-trade" },
    { status: 405, headers: { allow: "POST, OPTIONS" } },
  );
}
