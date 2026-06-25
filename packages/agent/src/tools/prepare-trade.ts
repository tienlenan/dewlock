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
import { buildStake, buildUnstake } from "@dewlock/sui/build-stake";
// DeepBook order-lifecycle builders + BM resolver (DeepBook SDK lazy-imported inside).
import {
  buildCreateBalanceManager,
  buildDepositIntoBalanceManager,
  getExistingBalanceManagers,
} from "@dewlock/sui/balance-manager";
import { buildCancelOrder, buildWithdrawSettled, buildClaimSettled } from "@dewlock/sui/order-management";
import { deepbookCoinKeyForType, getPoolsWithSettledBalances } from "@dewlock/sui/account-orders";
import { resolveBalanceManagerForAction } from "./resolve-balance-manager";
import { InsufficientGasCoverageError } from "@dewlock/sui/sui-gas-payment";
import { guardianCheck, checkCoinTypeOnChain, SWAP_SOURCES, LENDING_PROTOCOLS } from "../guardian";
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
  "claim_settled",
  "lend_deposit",
  "lend_repay",
  "lend_borrow",
  "lend_withdraw",
  // Liquid staking via Aftermath Finance (afSUI).
  "stake",
  "unstake",
] as const satisfies readonly ActionType[];

/** Actions that operate on the wallet's BalanceManager (require server-side BM resolution). */
const BM_ACTION_TYPES = new Set<ActionType>([
  "limit_order",
  "bm_deposit",
  "cancel_order",
  "withdraw_settled",
  "claim_settled",
]);

/**
 * Pick the best swap source by independent quote (max output). Falls back to
 * whichever source quotes successfully; defaults to cetus if both fail (the
 * subsequent build then fail-closes if cetus also can't quote).
 */

// ---------------------------------------------------------------------------
// Session spend tracker (server-side in-memory for the hackathon)
// In production: persisted in a KV store keyed by walletAddress + date
//
// IMPORTANT: spend is recorded at confirmed-sign time (idempotent by txDigest),
// NOT at Guardian-PASS time. This prevents:
//  (a) double-counting when a Guardian pass is abandoned (no sign follows),
//  (b) chain double-counting — a swap→lend chain that recycles the swap output
//      should count $20 net external value once, not $20+$20.
//
// recordSpendAtSignTime() is the ONLY public write path. prepareTrade no
// longer calls addDailySpend on PASS — it only reads the current total for
// the Guardian's daily-cap input.
// ---------------------------------------------------------------------------

const dailySpendTracker = new Map<string, number>();
/** txDigests for which spend has already been recorded — prevents double-count on retry. */
const recordedDigests = new Set<string>();

function getDailyKey(walletAddress: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${walletAddress}:${today}`;
}

function getDailySpend(walletAddress: string): number {
  return dailySpendTracker.get(getDailyKey(walletAddress)) ?? 0;
}

/**
 * Record spend at confirmed-sign time (idempotent by txDigest).
 * Call this from the receipt pipeline after a transaction is confirmed on-chain,
 * NOT from the Guardian PASS path. Pass isRecycled=true when this step's input
 * is the output of a prior chain step (net external value already counted).
 */
export function recordSpendAtSignTime(
  walletAddress: string,
  txDigest: string,
  usdAmount: number,
  isRecycled = false,
): void {
  if (recordedDigests.has(txDigest)) return; // idempotent
  recordedDigests.add(txDigest);
  if (!isRecycled && usdAmount > 0) {
    const key = getDailyKey(walletAddress);
    dailySpendTracker.set(key, (dailySpendTracker.get(key) ?? 0) + usdAmount);
  }
}

// ---------------------------------------------------------------------------
// Supported coin type enum for zod (must be canonical, never a ticker)
// ---------------------------------------------------------------------------

const COIN_TYPE_VALUES = Object.values(COIN_TYPES) as [string, ...string[]];

/** Verified, allowlisted coin types — authoritative set for the unverified-token guard. */
const ALLOWLISTED_COIN_TYPES = new Set<string>(COIN_TYPE_VALUES);

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

    // --- Unverified-token probe (swap output) ---
    coinTypeOutRaw: z
      .string()
      .optional()
      .describe(
        "Raw output coin type for an UNVERIFIED token the user named (e.g. a pasted 0x::module::TYPE " +
          "contract not in the verified set). Set this INSTEAD of coinTypeOut when the target is not a " +
          "recognised allowlisted asset — the Guardian verifies it and blocks (coin_allowlist) before any " +
          "build/route. Never use for known tokens (use coinTypeOut for those).",
      ),

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
        // Contracts the PTB invokes (permissions UI). MUST be declared here — the
        // tool outputSchema strips undeclared keys, so the runtime spread alone
        // would never reach the client.
        contractsCalled: z.array(
          z.object({
            target: z.string(),
            protocolName: z.string(),
            category: z.string(),
            status: z.string(),
            allowlistKind: z.enum(["pinned", "signature-matched", "none"]),
          }),
        ),
        // Objects the PTB creates/mutates/transfers (permissions UI). Capped server-side;
        // objectsTouchedTotal is the true count for the "+K more" affordance.
        objectsTouched: z.array(
          z.object({
            objectId: z.string(),
            changeType: z.enum(["created", "mutated", "transferred", "deleted", "wrapped"]),
            objectType: z.string().optional(),
            ownerKind: z.enum(["you", "recipient", "shared", "object", "third-party"]),
          }),
        ),
        objectsTouchedTotal: z.number(),
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
      coinTypeOutRaw,
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

    // --- Unverified-token guard (pre-build, swaps only) ---
    // A raw output coin type the user named that is NOT on the verified allowlist is blocked
    // before any build/route. A scam token can still carry on-chain CoinMetadata, so allowlist
    // membership — not metadata existence — is the authoritative control. We probe on-chain
    // identity only to enrich the message, then block fail-closed (RPC error never unblocks).
    if (actionType === "swap" && coinTypeOutRaw && !ALLOWLISTED_COIN_TYPES.has(coinTypeOutRaw)) {
      let identityNote = "no verified on-chain identity";
      try {
        const probe = await checkCoinTypeOnChain(coinTypeOutRaw, suiClient);
        identityNote = probe.ok
          ? "has on-chain metadata but is NOT on the verified allowlist"
          : "no verified on-chain identity";
      } catch {
        /* fail-closed: block regardless of probe outcome */
      }
      return {
        ok: false as const,
        reasons: [
          `Token "${coinTypeOutRaw}" is not on Dewlock's verified token allowlist (${identityNote}) — ` +
            "refusing to route a swap into an unverified asset. Dewlock trades verified tokens only.",
        ],
        gates: ["coin_allowlist"],
      };
    }

    // --- BalanceManager resolution (server cross-check + client-carried id) ---
    // The server resolves the sender's BM via getExistingBalanceManagers. BUT a freshly
    // created BM is NOT yet indexed by the fullnode (shared-object lag of several seconds),
    // so getBalanceManagerIds returns [] right after onboarding. The onboarding flow
    // therefore CARRIES the new BM id client-side (create→deposit→first order). We honor a
    // client-supplied id when the server hasn't indexed it yet, and block only on a clear
    // mismatch (server sees a DIFFERENT single BM). The authoritative ownership guarantee
    // is on-chain: cancel/withdraw/place require the BM owner-proof, so a foreign id fails
    // the dry-run; deposit only ADDS funds and is WYSIWYS-signed. RPC error ≠ "no BM".
    let resolvedBmId = balanceManagerId;
    if (BM_ACTION_TYPES.has(actionType)) {
      const resolution = await getExistingBalanceManagers(suiClient, walletAddress);
      const outcome = resolveBalanceManagerForAction(resolution, balanceManagerId);
      if (!outcome.ok) {
        return { ok: false as const, reasons: outcome.reasons, gates: outcome.gates };
      }
      resolvedBmId = outcome.bmId;
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
      } else if (actionType === "claim_settled") {
        if (!resolvedBmId) {
          return { ok: false as const, reasons: ["No DeepBook trading account resolved for this wallet."], gates: ["onboarding_required"] };
        }
        // Settle only the pools that actually owe this BM something — never settle an empty
        // pool (a wasted call). A total read failure THROWS (indeterminate, not "empty"), so
        // we surface a retry block rather than falsely claiming nothing is owed.
        let poolsWithSettled: string[];
        try {
          poolsWithSettled = await getPoolsWithSettledBalances(suiClient, walletAddress, resolvedBmId);
        } catch {
          return {
            ok: false as const,
            reasons: ["Couldn't verify your settled balances right now (network issue). Please retry."],
            gates: ["claim_read_error"],
          };
        }
        if (poolsWithSettled.length === 0) {
          return {
            ok: false as const,
            reasons: ["No settled balances to claim — nothing is owed to this trading account right now."],
            gates: ["nothing_to_claim"],
          };
        }
        const claimResult = await buildClaimSettled(suiClient, {
          senderAddress: walletAddress,
          balanceManagerId: resolvedBmId,
          poolKeys: poolsWithSettled,
        });
        txBytes = claimResult.txBytes;
      } else if (actionType === "stake") {
        // Liquid staking: SUI → afSUI via Aftermath Finance.
        const stakeResult = await buildStake(suiClient, {
          senderAddress: walletAddress,
          amountNative: amountInNative,
        });
        txBytes = stakeResult.txBytes;
      } else if (actionType === "unstake") {
        // Liquid unstaking: afSUI → SUI via Aftermath Finance (atomic, same tx).
        const unstakeResult = await buildUnstake(suiClient, {
          senderAddress: walletAddress,
          afSuiAmountNative: amountInNative,
        });
        txBytes = unstakeResult.txBytes;
      } else if (
        actionType === "lend_borrow" ||
        actionType === "lend_withdraw" ||
        actionType === "lend_deposit" ||
        actionType === "lend_repay"
      ) {
        if (!lendingProtocol) {
          return { ok: false as const, reasons: ["lendingProtocol is required for lending actions"], gates: ["input_validation"] };
        }
        const lendAction =
          actionType === "lend_deposit" ? "deposit" :
          actionType === "lend_repay" ? "repay" :
          actionType === "lend_borrow" ? "borrow" : "withdraw";
        const lendResult = await buildLend(suiClient, {
          senderAddress: walletAddress,
          protocol: lendingProtocol as LendingProtocol,
          action: lendAction,
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

    // Daily spend is now recorded at confirmed-sign time (via recordSpendAtSignTime),
    // not here at Guardian-PASS. Recording at PASS time was wrong because:
    //  (a) the user may abandon after preview (no sign → no spend),
    //  (b) a swap→lend chain would double-count if both steps hit this path.
    // The Guardian still reads the current daily total (getDailySpend) at check time
    // to enforce the cap — that read happens above in the proposal construction.

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
