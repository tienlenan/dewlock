/**
 * prepareTrade — Mastra tool that builds an unsigned PTB and runs it through
 * the Guardian before returning anything to the LLM or UI.
 *
 * WHY the Guardian runs INSIDE this tool: the LLM never sees the PTB until
 * Guardian has approved it. If Guardian blocks, the tool returns a structured
 * block result with reasons — no PTB is ever returned on a block.
 *
 * Zod schema enforces bounded inputs at the server boundary; the LLM cannot
 * pass unbounded strings for coinType or recipient (type-safety + injection surface reduction).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSuiMainnetClient, buildTransfer } from "@dewlock/sui";
// build-swap imports Cetus SDK — use subpath to keep it isolated from the root bundle
import { buildSwap } from "@dewlock/sui/build-swap";
// build-limit-order imports DeepBook SDK — use subpath for the same isolation rationale
import { buildLimitOrder } from "@dewlock/sui/build-limit-order";
import { guardianCheck } from "../guardian";
import { COIN_TYPES } from "../allowlist";
import type { TradeProposal } from "../guardian";

// ---------------------------------------------------------------------------
// Session spend tracker (server-side in-memory for the hackathon)
// In production: persisted in a KV store keyed by walletAddress + date
// ---------------------------------------------------------------------------

const dailySpendTracker = new Map<string, number>();

function getDailyKey(walletAddress: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${walletAddress}:${today}`;
}

function getDailySpend(walletAddress: string): number {
  return dailySpendTracker.get(getDailyKey(walletAddress)) ?? 0;
}

function addDailySpend(walletAddress: string, usdAmount: number): void {
  const key = getDailyKey(walletAddress);
  dailySpendTracker.set(key, (dailySpendTracker.get(key) ?? 0) + usdAmount);
}

// ---------------------------------------------------------------------------
// Supported coin type enum for zod (must be canonical, never a ticker)
// ---------------------------------------------------------------------------

const COIN_TYPE_VALUES = Object.values(COIN_TYPES) as [string, ...string[]];

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const prepareTrade = createTool({
  id: "prepareTrade",
  description:
    "Build an unsigned transaction and run Guardian security checks. " +
    "Returns a preview + approvedDigest on pass, or block reasons on refusal. " +
    "NEVER returns a PTB on a block. Always call this before presenting a confirm card.",

  inputSchema: z.object({
    walletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address"),

    actionType: z.enum(["transfer", "swap", "limit_order"]),

    // --- Transfer fields ---
    recipientInput: z
      .string()
      .optional()
      .describe("Raw 0x address or .sui name for transfers"),

    // --- Swap fields ---
    coinTypeOut: z
      .enum(COIN_TYPE_VALUES)
      .optional()
      .describe("Canonical output coin type for swaps"),

    poolId: z.string().optional().describe("Cetus pool ID (required for live swaps)"),

    slippageBps: z
      .number()
      .int()
      .min(0)
      .max(5000)
      .optional()
      .default(50)
      .describe("Slippage tolerance in basis points (default 50 = 0.5%)"),

    // --- Limit-order fields (actionType==="limit_order") ---
    poolKey: z
      .enum(["DEEP_USDC", "SUI_USDC", "DEEP_SUI"])
      .optional()
      .describe("DeepBook whitelisted pool key for limit orders"),

    balanceManagerId: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address")
      .optional()
      .describe("DeepBook BalanceManager shared object id (pre-provisioned off-stage)"),

    side: z
      .enum(["BUY", "SELL"])
      .optional()
      .describe("Limit order side"),

    limitPrice: z
      .number()
      .positive()
      .optional()
      .describe("Limit price in human-readable quote currency units (SDK scales internally)"),

    limitQuantity: z
      .number()
      .positive()
      .optional()
      .describe("Order quantity in human-readable base currency units (SDK scales internally)"),

    expireTimestampMs: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Order expiry as unix millisecond timestamp. Required for limit orders."),

    // --- Common fields ---
    coinTypeIn: z
      .enum(COIN_TYPE_VALUES)
      .describe("Canonical input coin type — never a display ticker"),

    amountInNative: z
      .string()
      .regex(/^\d+$/, "Must be a non-negative integer string representing native units")
      .describe("Amount in native units (e.g. MIST for SUI)"),

    actionLabel: z.string().max(100).describe("Human-readable label for audit trail"),

    /**
     * Arg provenance — must be filled by the agent based on where each value came from.
     * "user_turn" = literal user message this turn; "derived" = inferred/remembered.
     */
    argProvenance: z.object({
      recipient: z.enum(["user_turn", "derived"]).optional(),
      amount: z.enum(["user_turn", "derived"]).optional(),
      coinType: z.enum(["user_turn", "derived"]).optional(),
    }),

    verifiedContacts: z
      .array(z.string())
      .optional()
      .describe("Known contact names/addresses for lookalike detection"),
  }),

  outputSchema: z.union([
    // Pass: Guardian approved — includes txBytes so client can sign the exact approved bytes
    z.object({
      ok: z.literal(true),
      approvedDigest: z.string(),
      /** Base64 PTB bytes the Guardian approved — pass directly to wallet sign. Never on block. */
      txBytes: z.string(),
      preview: z.object({
        actionLabel: z.string(),
        coinTypeIn: z.string(),
        coinTypeOut: z.string().optional(),
        amountInNative: z.string(), // bigint serialized as string
        minAmountOutNative: z.string().optional(),
        slippageBps: z.number().optional(),
        recipientAddress: z.string().optional(),
        estimatedUsdValue: z.number(),
        gasCostMist: z.string(), // bigint serialized as string
        capsWarning: z.boolean(),
        requiresProvenanceConfirm: z.boolean(),
        demoFixture: z.boolean(),
        balanceDeltas: z.array(
          z.object({
            coinType: z.string(),
            amount: z.string(),
            owner: z.string(),
          }),
        ),
        // Limit-order preview fields (present when actionType==="limit_order")
        poolKey: z.string().optional(),
        side: z.enum(["BUY", "SELL"]).optional(),
        limitPrice: z.number().optional(),
        limitQuantity: z.number().optional(),
        expireTimestampMs: z.number().optional(),
        bookParams: z
          .object({ tickSize: z.number(), lotSize: z.number(), minSize: z.number() })
          .optional(),
        midPrice: z.number().optional(),
        orderType: z.literal("POST_ONLY").optional(),
        notionalQuote: z.number().optional(),
      }),
    }),
    // Block: Guardian refused
    z.object({
      ok: z.literal(false),
      reasons: z.array(z.string()),
      gates: z.array(z.string()),
    }),
  ]),

  execute: async (inputData) => {
    const {
      walletAddress,
      actionType,
      recipientInput,
      coinTypeIn,
      coinTypeOut,
      amountInNative: amountStr,
      slippageBps = 50,
      poolId,
      poolKey,
      balanceManagerId,
      side,
      limitPrice,
      limitQuantity,
      expireTimestampMs,
      actionLabel,
      argProvenance,
      verifiedContacts = [],
    } = inputData;

    const amountInNative = BigInt(amountStr);
    const suiClient = getSuiMainnetClient();

    // Build the unsigned PTB
    let txBytes: string;
    let recipientAddress: string | undefined;
    let minAmountOutNative: bigint | undefined;
    // Limit-order extra context for Guardian proposal
    let limitOrderBookParams: { tickSize: number; lotSize: number; minSize: number } | undefined;
    let limitOrderMidPrice: number | undefined;
    let limitOrderBaseCoinType: string | undefined;
    let limitOrderQuoteCoinType: string | undefined;
    let limitOrderNotionalQuote: number | undefined;

    try {
      if (actionType === "transfer") {
        if (!recipientInput) {
          return { ok: false as const, reasons: ["recipientInput is required for transfers"], gates: ["input_validation"] };
        }
        const transferResult = await buildTransfer(suiClient, {
          senderAddress: walletAddress,
          recipientInput,
          coinType: coinTypeIn,
          amountNative: amountInNative,
          verifiedContacts,
        });
        txBytes = transferResult.txBytes;
        recipientAddress = transferResult.resolvedRecipient;
      } else if (actionType === "limit_order") {
        if (!poolKey) {
          return { ok: false as const, reasons: ["poolKey is required for limit orders"], gates: ["input_validation"] };
        }
        if (!balanceManagerId) {
          return { ok: false as const, reasons: ["balanceManagerId is required for limit orders"], gates: ["input_validation"] };
        }
        if (!side) {
          return { ok: false as const, reasons: ["side (BUY|SELL) is required for limit orders"], gates: ["input_validation"] };
        }
        if (limitPrice === undefined) {
          return { ok: false as const, reasons: ["limitPrice is required for limit orders"], gates: ["input_validation"] };
        }
        if (limitQuantity === undefined) {
          return { ok: false as const, reasons: ["limitQuantity is required for limit orders"], gates: ["input_validation"] };
        }
        if (expireTimestampMs === undefined) {
          return { ok: false as const, reasons: ["expireTimestampMs is required for limit orders"], gates: ["input_validation"] };
        }
        const orderResult = await buildLimitOrder(suiClient, {
          senderAddress: walletAddress,
          poolKey: poolKey as "DEEP_USDC" | "SUI_USDC" | "DEEP_SUI",
          balanceManagerId,
          side,
          price: limitPrice,
          quantity: limitQuantity,
          expireTimestampMs,
        });
        txBytes = orderResult.txBytes;
        limitOrderBookParams = orderResult.bookParams;
        limitOrderMidPrice = orderResult.midPrice;
        limitOrderBaseCoinType = orderResult.baseCoinType;
        limitOrderQuoteCoinType = orderResult.quoteCoinType;
        limitOrderNotionalQuote = orderResult.notionalQuote;
      } else {
        // swap
        if (!coinTypeOut) {
          return { ok: false as const, reasons: ["coinTypeOut is required for swaps"], gates: ["input_validation"] };
        }
        const swapResult = await buildSwap(suiClient, {
          senderAddress: walletAddress,
          coinTypeIn,
          coinTypeOut,
          amountInNative,
          slippageBps,
        });
        txBytes = swapResult.txBytes;
        minAmountOutNative = swapResult.quote.minAmountOut;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, reasons: [`PTB construction failed: ${msg}`], gates: ["build"] };
    }

    // For limit orders, derive coinTypeIn from base coin and amountInNative from quantity
    // (in native units) so Guardian's existing coin-type and USD-cap gates still fire.
    const effectiveCoinTypeIn = actionType === "limit_order"
      ? (limitOrderBaseCoinType ?? coinTypeIn)
      : coinTypeIn;
    const effectiveCoinTypeOut = actionType === "limit_order"
      ? limitOrderQuoteCoinType
      : coinTypeOut;

    // Convert limitQuantity to native units for proposal.amountInNative
    // (Guardian Gate 2 uses amountInNative for non-limit_order cap math;
    // limit_order has its own notional path so this value is informational).
    const effectiveAmountInNative = actionType === "limit_order" && limitQuantity !== undefined
      ? BigInt(Math.round(limitQuantity * 1e6)) // DEEP/SUI both 6- or 9-decimal; Guardian uses notional path
      : amountInNative;

    // Compose the proposal for the Guardian
    const proposal: TradeProposal = {
      txBytes,
      walletAddress,
      actionLabel,
      actionType,
      coinTypeIn: effectiveCoinTypeIn,
      coinTypeOut: effectiveCoinTypeOut,
      amountInNative: effectiveAmountInNative,
      minAmountOutNative,
      slippageBps,
      poolId,
      recipientAddress,
      argProvenance,
      verifiedContacts,
      dailyUsdSpentSoFar: getDailySpend(walletAddress),
      // Limit-order fields
      poolKey,
      balanceManagerId,
      side,
      limitPrice,
      limitQuantity,
      expireTimestampMs,
      bookParams: limitOrderBookParams,
      midPrice: limitOrderMidPrice,
    };

    const guardianResult = await guardianCheck(proposal, suiClient);

    if (!guardianResult.ok) {
      return { ok: false as const, reasons: guardianResult.reasons, gates: guardianResult.gates };
    }

    // Update daily spend tracker on pass (approximate — real spend happens at sign time)
    addDailySpend(walletAddress, guardianResult.preview.estimatedUsdValue);

    // Serialize bigints to strings for JSON transport
    return {
      ok: true as const,
      approvedDigest: guardianResult.approvedDigest,
      // txBytes is the exact PTB the Guardian approved — client passes this to wallet sign.
      // Block path above returns before reaching here so txBytes is never present on block.
      txBytes: guardianResult.txBytes,
      preview: {
        ...guardianResult.preview,
        amountInNative: guardianResult.preview.amountInNative.toString(),
        minAmountOutNative: guardianResult.preview.minAmountOutNative?.toString(),
        gasCostMist: guardianResult.preview.gasCostMist.toString(),
        balanceDeltas: guardianResult.preview.balanceDeltas.map((d) => ({
          coinType: d.coinType,
          amount: d.amount.toString(),
          owner: d.owner,
        })),
      },
    };
  },
});
