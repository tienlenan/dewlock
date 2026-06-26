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

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Input schema — mirrors prepareTrade inputSchema exactly (subset surface)
// ---------------------------------------------------------------------------

const SUPPORTED_COIN_TYPES = [
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
  "0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH",
  "0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN",
  // DeepBook native token — needed for DeepBook deposit/withdraw of DEEP balances.
  "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
] as const;

type SupportedCoinType = (typeof SUPPORTED_COIN_TYPES)[number];

// Deterministic actions servable without the LLM. The DeepBook order-lifecycle verbs
// are driven straight from the positions UI (no natural-language round).
// "composite" is driven from the chain-plan card atomic toggle (no NL round needed).
const DETERMINISTIC_ACTIONS = [
  "transfer",
  "swap",
  "near_miss_fixture",
  "bm_create",
  "bm_deposit",
  "cancel_order",
  "withdraw_settled",
  "claim_settled",
  "composite",
] as const;

const requestSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address"),

  actionType: z.enum(DETERMINISTIC_ACTIONS),

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

  // --- DeepBook order-lifecycle fields (cancel_order / withdraw_settled / bm_deposit) ---
  poolKey: z.enum(["DEEP_USDC", "SUI_USDC", "DEEP_SUI"]).optional(),
  balanceManagerId: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address")
    .optional(),
  orderId: z
    .string()
    .regex(/^0x[0-9a-fA-F]+$/, "Must be a 0x-prefixed hex order id")
    .optional(),

  // --- Composite fields (actionType === "composite") ---
  compositeRecipeId: z
    .string()
    .optional()
    .describe("Declared recipe id (e.g. 'swap_lend_v1'). Required when actionType==='composite'."),

  compositeLegs: z
    .array(
      z.object({
        actionType: z.enum(["swap", "lend_deposit"]),
        coinTypeIn: z.enum(SUPPORTED_COIN_TYPES as readonly [SupportedCoinType, ...SupportedCoinType[]]),
        coinTypeOut: z.enum(SUPPORTED_COIN_TYPES as readonly [SupportedCoinType, ...SupportedCoinType[]]).optional(),
        amountInNative: z.string().regex(/^\d+$/).describe("Amount in native units"),
        lendingProtocol: z.enum(["navi", "suilend"]).optional(),
        slippageBps: z.number().int().min(0).max(5000).optional(),
      }),
    )
    .optional()
    .describe("Per-leg specs for a composite proposal (actionType==='composite')."),

  argProvenance: z
    .object({
      recipient: z.enum(["user_turn", "derived"]).optional(),
      amount: z.enum(["user_turn", "derived"]).optional(),
      coinType: z.enum(["user_turn", "derived"]).optional(),
    })
    .default({}),

  verifiedContacts: z.array(z.string()).optional(),
});

/** Actions that bypass the transfer/swap coin+amount precondition (handled internally). */
const DEEPBOOK_ACTIONS = new Set(["bm_create", "bm_deposit", "cancel_order", "withdraw_settled", "claim_settled", "composite"]);

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

/** Human-readable audit label per deterministic action. */
function buildActionLabel(actionType: string, amountInNative: string): string {
  switch (actionType) {
    case "transfer":
      return `Transfer ${amountInNative} native units`;
    case "swap":
      return `Swap ${amountInNative} native units`;
    case "bm_create":
      return "Create DeepBook trading account";
    case "bm_deposit":
      return `Fund DeepBook account (${amountInNative} native units)`;
    case "cancel_order":
      return "Cancel DeepBook order";
    case "claim_settled":
      return "Claim settled DeepBook balances";
    case "withdraw_settled":
      return `Withdraw settled balance (${amountInNative} native units)`;
    case "composite":
      return "Atomic swap + lend (1 signature)";
    default:
      return `Action ${amountInNative} native units`;
  }
}

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
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, scope: "prepare-trade" });
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
    const isDeepbook = DEEPBOOK_ACTIONS.has(input.actionType);
    // transfer/swap require coin+amount; DeepBook order-lifecycle verbs do not (cancel
    // carries neither; create carries neither). The tool schema still wants a coinTypeIn,
    // so default SUI + "0" for the value-less verbs while real values pass through.
    if (!isDeepbook && (!input.coinTypeIn || !input.amountInNative)) {
      return Response.json(
        { error: "coinTypeIn and amountInNative are required for transfer/swap actions" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }
    const SUI_TYPE = SUPPORTED_COIN_TYPES[0];
    const effectiveCoinTypeIn = input.coinTypeIn ?? SUI_TYPE;
    const effectiveAmountInNative = input.amountInNative ?? "0";

    // A button click IS the user's action: a UI-entered withdraw/deposit amount is a
    // user_turn value (not memory/injection). cancel/create carry no value args.
    const argProvenance =
      input.actionType === "withdraw_settled" || input.actionType === "bm_deposit"
        ? { ...input.argProvenance, amount: "user_turn" as const }
        : input.argProvenance;

    const actionLabel = buildActionLabel(input.actionType, effectiveAmountInNative);

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
      coinTypeIn: effectiveCoinTypeIn,
      coinTypeOut: input.coinTypeOut,
      recipientInput: input.recipientInput,
      amountInNative: effectiveAmountInNative,
      slippageBps: input.slippageBps ?? 50,
      // DeepBook order-lifecycle identifiers — forwarded so execute can route + gate them.
      poolKey: input.poolKey,
      balanceManagerId: input.balanceManagerId,
      orderId: input.orderId,
      // Composite fields — forwarded when actionType === "composite".
      compositeRecipeId: input.compositeRecipeId,
      compositeLegs: input.compositeLegs?.map((leg) => ({
        coinTypeIn: leg.coinTypeIn,
        coinTypeOut: leg.coinTypeOut,
        amountInNative: leg.amountInNative,
        lendingProtocol: leg.lendingProtocol,
        slippageBps: leg.slippageBps,
      })),
      actionLabel,
      argProvenance,
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
