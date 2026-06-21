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
import { buildAggregatorSwap } from "@dewlock/sui/build-aggregator-swap";
import { buildAftermathSwap } from "@dewlock/sui/build-aftermath-swap";
// build-limit-order imports DeepBook SDK — use subpath for the same isolation rationale
import { buildLimitOrder } from "@dewlock/sui/build-limit-order";
import { buildLend } from "@dewlock/sui/build-lend";
// DeepBook order-lifecycle builders + BM resolver (DeepBook SDK lazy-imported inside).
import {
  buildCreateBalanceManager,
  buildDepositIntoBalanceManager,
  getExistingBalanceManagers,
} from "@dewlock/sui/balance-manager";
import { buildCancelOrder, buildWithdrawSettled } from "@dewlock/sui/order-management";
import { deepbookCoinKeyForType } from "@dewlock/sui/account-orders";
import { InsufficientGasCoverageError } from "@dewlock/sui/sui-gas-payment";
import { guardianCheck, SWAP_SOURCES, LENDING_PROTOCOLS } from "../guardian";
import { COIN_TYPES, COIN_DECIMALS } from "../allowlist";
import type { TradeProposal, ActionType, SwapSource, LendingProtocol } from "../guardian";

// Actions this tool can accept. Type-checked subset of the canonical ActionType
// (a typo or unhandled action is a compile error) — single source. Borrow/withdraw
// are accepted but immediately returned guarded (no builder).
const TOOL_ACTION_TYPES = [
  "transfer",
  "swap",
  "limit_order",
  // DeepBook order lifecycle (onboarding + cancel + withdraw settled).
  "bm_create",
  "bm_deposit",
  "cancel_order",
  "withdraw_settled",
  "lend_deposit",
  "lend_repay",
  "lend_borrow",
  "lend_withdraw",
] as const satisfies readonly ActionType[];

/** Actions that operate on the wallet's BalanceManager (require server-side BM resolution). */
const BM_ACTION_TYPES = new Set<ActionType>(["limit_order", "bm_deposit", "cancel_order", "withdraw_settled"]);

/**
 * Pick the best swap source by independent quote (max output). Falls back to
 * whichever source quotes successfully; defaults to cetus if both fail (the
 * subsequent build then fail-closes if cetus also can't quote).
 */

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

    actionType: z.enum(TOOL_ACTION_TYPES),

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

    swapSource: z
      .enum(SWAP_SOURCES)
      .optional()
      .describe("Swap source: 'cetus' (direct pool) or 'aggregator' (best route). Omit for best-route auto-select."),

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

    // --- Order-lifecycle field (actionType==="cancel_order") ---
    orderId: z
      .string()
      .regex(/^0x[0-9a-fA-F]+$/, "Must be a 0x-prefixed hex order id")
      .optional()
      .describe("Resting DeepBook order id to cancel (for cancel_order)."),

    // --- Lending fields (actionType==="lend_*") ---
    lendingProtocol: z
      .enum(LENDING_PROTOCOLS)
      .optional()
      .describe("Lending protocol for lend_* actions: 'navi' or 'suilend'."),

    obligationId: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional()
      .describe("Suilend obligation object id (required for live Suilend repay)."),

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
        swapSource: z.enum(SWAP_SOURCES).optional(),
        routeProviders: z.array(z.string()).optional(),
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
        // Real decimals (curated map → on-chain CoinMetadata) for every coin type the
        // preview displays, so the client formats amounts with the correct scale.
        coinDecimals: z.record(z.string(), z.number()).optional(),
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
        lendingProtocol: z.enum(LENDING_PROTOCOLS).optional(),
        healthBefore: z.number().optional(),
        healthAfter: z.number().optional(),
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
      swapSource,
      poolKey,
      balanceManagerId,
      side,
      limitPrice,
      limitQuantity,
      expireTimestampMs,
      orderId,
      lendingProtocol,
      obligationId,
      actionLabel,
      argProvenance,
      verifiedContacts = [],
    } = inputData;

    const amountInNative = BigInt(amountStr);
    const suiClient = getSuiMainnetClient();

    // --- Server-authoritative BalanceManager resolution (ownership boundary) ---
    // For every action that touches a BM, the SERVER resolves the sender's BM and
    // validates any client-supplied id against it (never trusts the client value).
    // An RPC error is NOT "no BM" (that would mint a duplicate) → block + ask to retry.
    let resolvedBmId = balanceManagerId;
    if (BM_ACTION_TYPES.has(actionType)) {
      const resolution = await getExistingBalanceManagers(suiClient, walletAddress);
      if (resolution.status === "rpc_error") {
        return {
          ok: false as const,
          reasons: ["Couldn't verify your DeepBook trading account right now (network issue). Please retry."],
          gates: ["bm_resolve_error"],
        };
      }
      if (resolution.ids.length > 1) {
        return {
          ok: false as const,
          reasons: ["Multiple BalanceManagers found for this wallet — unexpected. Refusing for safety."],
          gates: ["bm_ambiguous"],
        };
      }
      const serverBmId = resolution.ids[0];
      if (!serverBmId) {
        // Not provisioned → the UI renders the onboarding card on this gate.
        return {
          ok: false as const,
          reasons: [
            "You don't have a DeepBook trading account (BalanceManager) yet. " +
              "Set one up (create + fund) to place and manage orders.",
          ],
          gates: ["onboarding_required"],
        };
      }
      if (balanceManagerId && balanceManagerId.toLowerCase() !== serverBmId.toLowerCase()) {
        return {
          ok: false as const,
          reasons: ["The provided BalanceManager id doesn't match your wallet's account. Refusing (fail-closed)."],
          gates: ["bm_ownership"],
        };
      }
      resolvedBmId = serverBmId;
    }

    // bm_create is idempotent: one BalanceManager per wallet. Refuse a second create
    // (a direct call when one already exists) — a duplicate wastes gas and splits funds
    // across two BMs. RPC error → block (can't verify), never silently create.
    if (actionType === "bm_create") {
      const resolution = await getExistingBalanceManagers(suiClient, walletAddress);
      if (resolution.status === "rpc_error") {
        return {
          ok: false as const,
          reasons: ["Couldn't verify your DeepBook trading account right now (network issue). Please retry."],
          gates: ["bm_resolve_error"],
        };
      }
      if (resolution.ids.length >= 1) {
        return {
          ok: false as const,
          reasons: ["You already have a DeepBook trading account — no need to create another. Fund it or place an order."],
          gates: ["bm_exists"],
        };
      }
    }

    // Build the unsigned PTB
    let txBytes: string;
    let recipientAddress: string | undefined;
    let minAmountOutNative: bigint | undefined;
    let chosenSwapSource: SwapSource | undefined;
    let swapRouteProviders: string[] | undefined;
    let lendHealthBefore: number | undefined;
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
        // resolvedBmId is server-authoritative (set above); a missing BM already returned
        // an "onboarding_required" block, so reaching here means it's present + owned.
        if (!resolvedBmId) {
          return { ok: false as const, reasons: ["No DeepBook trading account resolved for this wallet."], gates: ["onboarding_required"] };
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
          balanceManagerId: resolvedBmId,
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
      } else if (actionType === "bm_create") {
        // Onboarding step 1: create + share a BalanceManager (no value beyond gas).
        const createResult = await buildCreateBalanceManager(suiClient, walletAddress);
        txBytes = createResult.txBytes;
      } else if (actionType === "bm_deposit") {
        // Onboarding step 2: fund the resolved BM. resolvedBmId is server-authoritative.
        if (!resolvedBmId) {
          return { ok: false as const, reasons: ["No DeepBook trading account resolved for this wallet."], gates: ["onboarding_required"] };
        }
        const coinKey = deepbookCoinKeyForType(coinTypeIn);
        if (!coinKey) {
          return { ok: false as const, reasons: [`Coin ${coinTypeIn} is not a DeepBook-supported deposit coin.`], gates: ["input_validation"] };
        }
        const decimals = COIN_DECIMALS[coinTypeIn] ?? 9;
        const humanAmount = Number(amountInNative) / 10 ** decimals;
        if (!(humanAmount > 0)) {
          return { ok: false as const, reasons: ["Deposit amount must be positive."], gates: ["input_validation"] };
        }
        const depositResult = await buildDepositIntoBalanceManager(
          suiClient,
          walletAddress,
          resolvedBmId,
          coinKey,
          humanAmount,
        );
        txBytes = depositResult.txBytes;
      } else if (actionType === "cancel_order") {
        if (!poolKey) {
          return { ok: false as const, reasons: ["poolKey is required to cancel an order"], gates: ["input_validation"] };
        }
        if (!orderId) {
          return { ok: false as const, reasons: ["orderId is required to cancel an order"], gates: ["input_validation"] };
        }
        if (!resolvedBmId) {
          return { ok: false as const, reasons: ["No DeepBook trading account resolved for this wallet."], gates: ["onboarding_required"] };
        }
        const cancelResult = await buildCancelOrder(suiClient, {
          senderAddress: walletAddress,
          poolKey,
          balanceManagerId: resolvedBmId,
          orderId,
        });
        txBytes = cancelResult.txBytes;
      } else if (actionType === "withdraw_settled") {
        if (!resolvedBmId) {
          return { ok: false as const, reasons: ["No DeepBook trading account resolved for this wallet."], gates: ["onboarding_required"] };
        }
        const coinKey = deepbookCoinKeyForType(coinTypeIn);
        if (!coinKey) {
          return { ok: false as const, reasons: [`Coin ${coinTypeIn} is not a DeepBook-supported settled coin.`], gates: ["input_validation"] };
        }
        const decimals = COIN_DECIMALS[coinTypeIn] ?? 9;
        const humanAmount = Number(amountInNative) / 10 ** decimals;
        if (!(humanAmount > 0)) {
          return { ok: false as const, reasons: ["Withdraw amount must be positive."], gates: ["input_validation"] };
        }
        // Recipient is hard-pinned to the sender inside the builder — never a parameter.
        const withdrawResult = await buildWithdrawSettled(suiClient, {
          senderAddress: walletAddress,
          balanceManagerId: resolvedBmId,
          coinKey,
          humanAmount,
        });
        txBytes = withdrawResult.txBytes;
      } else if (actionType === "lend_borrow" || actionType === "lend_withdraw") {
        // Health-reducing verbs are gated off — surface immediately, build nothing.
        return {
          ok: false as const,
          reasons: [
            `Lending action "${actionType}" is guarded and not yet enabled — only deposit and repay are permitted.`,
          ],
          gates: ["lending"],
        };
      } else if (actionType === "lend_deposit" || actionType === "lend_repay") {
        if (!lendingProtocol) {
          return { ok: false as const, reasons: ["lendingProtocol is required for lending actions"], gates: ["input_validation"] };
        }
        const lendResult = await buildLend(suiClient, {
          senderAddress: walletAddress,
          protocol: lendingProtocol as LendingProtocol,
          action: actionType === "lend_deposit" ? "deposit" : "repay",
          coinType: coinTypeIn,
          amountNative: amountInNative,
          obligationId,
        });
        txBytes = lendResult.txBytes;
        lendHealthBefore = lendResult.healthBefore;
      } else {
        // swap
        if (!coinTypeOut) {
          return { ok: false as const, reasons: ["coinTypeOut is required for swaps"], gates: ["input_validation"] };
        }
        const spec = {
          senderAddress: walletAddress,
          coinTypeIn,
          coinTypeOut,
          amountInNative,
          slippageBps,
        };
        // Route to the chosen swap source. The legacy Cetus CLMM "direct" SDK is
        // @mysten/sui v1-era and fails to load under the repo's v2.18 pin
        // ("Class extends value undefined"), so "cetus" always falls through to
        // the aggregator. "aftermath" routes to the Aftermath Router builder.
        if (swapSource === "aftermath") {
          const swapResult = await buildAftermathSwap(suiClient, spec);
          txBytes = swapResult.txBytes;
          minAmountOutNative = swapResult.quote.minAmountOut;
          chosenSwapSource = "aftermath";
          swapRouteProviders = swapResult.quote.routeProviders;
        } else {
          // Default: Cetus Aggregator (best route across activated venues).
          const swapResult = await buildAggregatorSwap(suiClient, spec);
          txBytes = swapResult.txBytes;
          minAmountOutNative = swapResult.quote.minAmountOut;
          chosenSwapSource = "aggregator";
          swapRouteProviders = swapResult.quote.routeProviders;
        }
      }
    } catch (err) {
      // A native-SUI gas-coverage shortfall is already a clear, user-facing message — surface it
      // verbatim instead of burying it under a generic "PTB construction failed" prefix.
      if (err instanceof InsufficientGasCoverageError) {
        return { ok: false as const, reasons: [err.message], gates: ["insufficient_gas"] };
      }
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
      swapSource: chosenSwapSource,
      routeProviders: swapRouteProviders,
      poolId,
      recipientAddress,
      argProvenance,
      verifiedContacts,
      dailyUsdSpentSoFar: getDailySpend(walletAddress),
      // Max swap value-loss before the Guardian blocks. Server-injected (never an LLM arg):
      // a per-user override (MAX_PRICE_IMPACT_BPS) when set, else undefined → Guardian's 5% default.
      maxPriceImpactBps: process.env.MAX_PRICE_IMPACT_BPS
        ? Number(process.env.MAX_PRICE_IMPACT_BPS)
        : undefined,
      // Limit-order + order-lifecycle fields. balanceManagerId is the SERVER-RESOLVED
      // id (resolvedBmId), not the raw client value, so every BM gate re-validates
      // against the wallet's actual account.
      poolKey,
      balanceManagerId: resolvedBmId,
      side,
      limitPrice,
      limitQuantity,
      expireTimestampMs,
      orderId,
      bookParams: limitOrderBookParams,
      midPrice: limitOrderMidPrice,
      // Lending
      lendingProtocol: actionType.startsWith("lend_") ? (lendingProtocol as LendingProtocol) : undefined,
      healthBefore: lendHealthBefore,
    };

    const guardianResult = await guardianCheck(proposal, suiClient);

    if (!guardianResult.ok) {
      // Diagnostic: the reasons name the exact refused target — log them so a block
      // can be traced to a specific call/package without guessing.
      console.warn(
        `[guardian-block] action=${actionType} in=${effectiveCoinTypeIn} out=${effectiveCoinTypeOut ?? "-"} ` +
          `providers=${swapRouteProviders?.join("+") ?? "-"} gates=${guardianResult.gates.join(",")} ` +
          `reasons=${JSON.stringify(guardianResult.reasons)}`,
      );
      return { ok: false as const, reasons: guardianResult.reasons, gates: guardianResult.gates };
    }

    // Update daily spend tracker on pass (approximate — real spend happens at sign time).
    // Only genuine external-value-leaving actions count toward the daily cap. Onboarding
    // (bm_create), funding one's own trading account (bm_deposit), canceling an order, and
    // withdrawing one's own settled funds (an INFLOW) are not "spend" — counting them would
    // mis-bound the daily cap and let an unauthenticated prepare pollute it more easily.
    const SPEND_TRACKED_ACTIONS = new Set<ActionType>([
      "transfer",
      "swap",
      "limit_order",
      "lend_deposit",
      "lend_repay",
    ]);
    if (SPEND_TRACKED_ACTIONS.has(actionType)) {
      addDailySpend(walletAddress, guardianResult.preview.estimatedUsdValue);
    }

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
