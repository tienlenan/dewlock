/**
 * Guardian — deterministic, fail-closed pre-sign security gate.
 *
 * This is the security headline: guardianCheck() runs BEFORE any PTB reaches
 * the user's wallet. All decisions are deterministic code — zero LLM dependency.
 * An LLM cannot override, bypass, or influence any gate here.
 *
 * Nine hardening points (from Red-Team spec):
 *  1. Server-authoritative caps (TX_USD_CAP / DAILY_USD_CAP from server env only)
 *  2. Trusted USD price per coin type (curated stable refs, NOT the swapped pool)
 *  3. WYSIWYS digest: compute over exact PTB bytes; sign hook asserts equality
 *  4. Independent min-out cross-check: on-chain CoinMetadata decimals vs curated map
 *  5. Fail-closed on EVERY external dep (dryRun, SuiNS, quote, indexer)
 *  6. Injection provenance gate: args must trace to the current user turn
 *  7. {package::module::function} allowlist enforced before PTB is used
 *  8. SuiNS lookalike gate: homoglyph-normalized edit-distance ≤ 2
 *  9. Coin-type provenance: on-chain CoinMetadata; unknown type → block
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import {
  extractMoveTargets,
  classifyTarget,
  buildContractsCalled,
  type ContractCall,
} from "./tx-introspection";
// SuiJsonRpcClient is the v2.x successor to SuiClient; same interface for our purposes.
type SuiClient = SuiJsonRpcClient;
import {
  ALLOWED_MOVE_TARGETS,
  COIN_DECIMALS,
  COIN_TYPES,
  DEEPBOOK_POOLS,
  SUINS_PACKAGE,
  NATIVE_PACKAGE,
  CETUS_CLMM_PACKAGE,
  CETUS_CLMM_PACKAGE_V2,
  CETUS_AGGREGATOR_PACKAGE,
  CETUS_AGGREGATOR_CETUS_PACKAGE,
  isAggregatorSwapCall,
  isAftermathSwapCall,
  AFTERMATH_ROUTER_UTILS_PACKAGE,
  AFTERMATH_LSD_PACKAGE,
  NAVI_PACKAGE,
  SUILEND_PACKAGE,
  WORMHOLE_WTT_PACKAGE,
  DEEPBOOK_PACKAGE,
  HAEDAL_PACKAGE,
  getTrustedUsdPrice,
  normalizeCoinType,
  getProtocolByTarget,
  assertProtocolActive,
  normalizeHomoglyphs,
  editDistance,
  LOOKALIKE_EDIT_DISTANCE_THRESHOLD,
} from "./allowlist";
// checkProvenance is a pure, SDK-free gate — its single source of truth lives in
// guardian-gates.ts (so tests can import it without the SDK chain). guardianCheck uses
// this binding; it is re-exported below for the public API (index.ts).
import { checkProvenance } from "./guardian-gates";
import { getRecipe, buildDynamicRecipe } from "./chaining/composite-recipes";
import type { CompositeRecipe } from "./chaining/composite-recipes";

// ---------------------------------------------------------------------------
// ActionType — SINGLE source of truth.
//
// Imported by the TradeProposal union, the prepareTrade zod schema, and the
// tool router so a new action type is declared exactly once. Later phases extend
// this list (lend_*, bridge_redeem); the tool's accepted set is a type-checked
// subset of this canonical list (see prepare-trade.ts).
// ---------------------------------------------------------------------------

export const ACTION_TYPES = [
  "transfer",
  "swap",
  "add_liquidity",
  "limit_order",
  // DeepBook order lifecycle. BalanceManager onboarding (create + fund) and the
  // order-management verbs (cancel a resting order, withdraw a settled balance).
  // Each is gated by its OWN action-shape set — never the limit_order set, which
  // bundles place_limit_order and would let a deposit/withdraw smuggle an order in.
  "bm_create",
  "bm_deposit",
  "cancel_order",
  "withdraw_settled",
  // Claim filled/owed settled balances from pools back into the BM (no wallet outflow).
  "claim_settled",
  // Lending. deposit/repay are health-IMPROVING (enabled); borrow/withdraw are
  // health-REDUCING and stay gated OFF until a guarded post-tx health follow-up.
  "lend_deposit",
  "lend_repay",
  "lend_borrow",
  "lend_withdraw",
  // Cross-chain inflow — the Sui-side Wormhole redeem (source leg is wallet-driven).
  "bridge_redeem",
  // Liquid staking via Aftermath LST. stake = SUI → afSUI (mint); unstake = afSUI → SUI
  // (atomic redeem, instant). Each has its own minimal-exact action-shape so a swap or
  // lending call cannot ride a stake shape.
  "stake",
  "unstake",
  // Atomic composite: a declared closed-set recipe (e.g. swap→lend) compiled into ONE PTB,
  // ONE signature. The composite gate verifies target-multiset + delta/owner anti-leak.
  // NEVER used for ad-hoc multi-call composition — only declared recipes are admitted.
  "composite",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Lending protocols Dewlock has a built adapter for. */
export const LENDING_PROTOCOLS = ["navi", "suilend"] as const;
export type LendingProtocol = (typeof LENDING_PROTOCOLS)[number];

/** Swap execution source. "cetus" = direct CLMM pool; "aggregator" = Cetus best route; "aftermath" = Aftermath AMM router. */
export const SWAP_SOURCES = ["cetus", "aggregator", "aftermath"] as const;
export type SwapSource = (typeof SWAP_SOURCES)[number];

/** LST providers Dewlock has a built adapter for. */
export const LST_PROVIDERS = ["afsui", "hasui"] as const;
export type LstProvider = (typeof LST_PROVIDERS)[number];
import { dryRunTransaction, DryRunFailedError, capObjectsForPreview, type DryRunResult } from "@dewlock/sui";
import { simulateNaviHealthFactor } from "@dewlock/sui/navi-hf-simulation";
// PoolOperator discriminant values mirrored from the NAVI bundle (stable numeric constants).
// Defined here (not imported from navi-hf-simulation) so guardian.ts functions that use them
// remain testable even when navi-hf-simulation is vi.mock'd (the mock replaces the whole module).
const NAVI_OP_BORROW = 3;  // PoolOperator.Borrow
const NAVI_OP_WITHDRAW = 2; // PoolOperator.Withdraw
// Settled-balance reader for the withdraw_settled amount ceiling (lazy DeepBook SDK
// inside — importing the module evaluates no SDK). Subpath keeps it off non-order paths.
import { readSettledBalance } from "@dewlock/sui/account-orders";
// quotes-source imports Cetus SDK — use subpath to keep it isolated from the root bundle
import { fetchSwapQuote } from "@dewlock/sui/quotes-source";
import type { SwapQuote } from "@dewlock/sui/quotes-source";
// aggregator quote source — independent re-derive for swapSource="aggregator"
import { fetchAggregatorQuote, fetchSuiUsdPrice } from "@dewlock/sui/aggregator-quotes";
// aftermath quote source — independent re-derive for swapSource="aftermath"
import { fetchAftermathQuote } from "@dewlock/sui/aftermath-quotes";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Proposal submitted by the prepareTrade tool to the Guardian.
 * All value-moving fields must be present; provenance tracking is mandatory.
 */
export interface TradeProposal {
  /** Base64 serialized unsigned PTB built by the tool. */
  txBytes: string;
  /** The wallet address that will sign. */
  walletAddress: string;
  /** Human-readable label for audit trail. */
  actionLabel: string;
  /** Action type for gate routing. */
  actionType: ActionType;

  // --- Value fields ---
  /** Canonical coin type (outgoing). NEVER a ticker symbol. */
  coinTypeIn: string;
  /** Canonical coin type (incoming, for swaps). */
  coinTypeOut?: string;
  /** Amount in native units (MIST for SUI, micro-USDC, etc.). */
  amountInNative: bigint;
  /** For swaps: min amount out in native units as embedded in PTB. */
  minAmountOutNative?: bigint;
  /** For swaps: slippage in basis points. */
  slippageBps?: number;
  /**
   * Which swap source built this PTB. The Guardian re-derives min-out from the
   * SAME source (never crossing a Cetus quote with an aggregator PTB).
   * Defaults to "cetus" when absent (backward compatible).
   */
  swapSource?: SwapSource;
  /** For aggregator swaps: venues the chosen route hops through (preview only). */
  routeProviders?: string[];
  /** Cetus pool ID (for swaps). */
  poolId?: string;
  /** Resolved 0x recipient address (for transfers). */
  recipientAddress?: string;

  // --- Limit-order fields (actionType === "limit_order") ---
  /** DeepBook pool key (e.g. "DEEP_USDC"). Must be in DEEPBOOK_POOLS allowlist. */
  poolKey?: string;
  /** BalanceManager shared object id. */
  balanceManagerId?: string;
  /** Order side. */
  side?: "BUY" | "SELL";

  // --- Order-lifecycle fields (cancel_order / withdraw_settled / bm_deposit) ---
  /** Resting order id to cancel (0x-hex), for cancel_order. */
  orderId?: string;
  /**
   * Settled balance available to withdraw, RE-DERIVED on-chain by the Guardian
   * (NOT supplied by the caller) and used as the withdraw_settled amount ceiling.
   * Human-readable units. Undefined until the gate reads it.
   */
  settledBalanceHuman?: number;
  /** Human-readable limit price in quote currency. */
  limitPrice?: number;
  /** Human-readable quantity in base currency. */
  limitQuantity?: number;
  /** Expiry timestamp in milliseconds. */
  expireTimestampMs?: number;
  /** Pool book parameters fetched at build time (for independent re-validation). */
  bookParams?: { tickSize: number; lotSize: number; minSize: number };
  /** Mid-price at build time (for fat-finger sanity band). */
  midPrice?: number;

  // --- Staking fields (actionType === "stake" | "unstake") ---
  /**
   * LST provider for stake/unstake. "afsui" → Aftermath LSD SDK; "hasui" → Haedal direct-PTB.
   * Defaults to "afsui" when absent (backward compatible with Phase 2 proposals).
   * The Guardian uses this to key the single-target allowlist for the shape gate, ensuring
   * a PTB built for one provider cannot pass a shape check declared for the other.
   */
  lstProvider?: LstProvider;

  // --- Composite fields (actionType === "composite") ---
  /**
   * Declared recipe id from the closed recipe registry (e.g. "swap_lend_v1").
   * Required when actionType === "composite". The Guardian's checkCompositeRecipe
   * verifies the PTB's MoveCall multiset matches this recipe's declared set.
   * Absent = reject (fail-closed: no ad-hoc composition).
   */
  compositeRecipeId?: string;
  /**
   * Per-leg coin types for the composite — ordered by leg index.
   * Used for provenance: the Guardian checks that the declared coin types
   * match the recipe's linkage (leg-0 output coin == leg-1 input coin).
   *
   * For "send" legs, `recipient` carries the resolved 0x address captured at
   * WYSIWYS proposal time. The anti-leak gate compares dry-run inflows against
   * this address — the Guardian NEVER re-resolves a SuiNS name here (TOCTOU).
   * `actionType: "send"` marks the leg for the anti-leak extractor.
   */
  compositeLegs?: Array<{
    coinTypeIn: string;
    coinTypeOut?: string;
    amountInNative: bigint;
    lendingProtocol?: string;
    /** Resolved 0x recipient — only set for send legs. */
    recipient?: string;
    /** Marks a send leg so the anti-leak gate can extract it. */
    actionType?: "send" | "swap" | "lend_deposit" | "stake";
  }>;
  /**
   * Net SUI delta cap for composite transactions (in MIST). Bounds tx.gas-split exfiltration
   * independently of the USD cap — a composite that drains more SUI than declared is blocked
   * even when the USD value is within cap. Server-injected; never LLM-controlled.
   * Defaults to NET_SUI_DELTA_CAP_MIST when absent.
   */
  netSuiDeltaCapMist?: bigint;

  // --- Lending fields (actionType === "lend_*") ---
  /** Lending protocol routed to. Must be active+built in the registry. */
  lendingProtocol?: LendingProtocol;
  /** Health factor before the action (read on-chain at build time; preview only). */
  healthBefore?: number;
  /** Projected health factor after the action (preview only). */
  healthAfter?: number;

  /**
   * Provenance of each arg: "user_turn" = came from the literal current
   * user message; "derived" = came from memory, pool data, or inference.
   * The Guardian forces extra confirm for any "derived" arg on value-moving ops.
   */
  argProvenance: {
    recipient?: "user_turn" | "derived";
    amount?: "user_turn" | "derived";
    coinType?: "user_turn" | "derived";
  };

  /** Verified contacts for SuiNS lookalike detection. */
  verifiedContacts?: string[];

  /**
   * Daily spend tracker (server-managed rolling total in USD).
   * Injected by the prepareTrade tool from session state.
   */
  dailyUsdSpentSoFar: number;

  /**
   * Max acceptable swap value-loss (price impact) in basis points before the Guardian blocks.
   * Server-injected (NOT LLM-controlled). Undefined → DEFAULT_MAX_PRICE_IMPACT_BPS (5%).
   */
  maxPriceImpactBps?: number;
}

/** Default price-impact ceiling (5%) when the proposal doesn't carry a user-configured value. */
export const DEFAULT_MAX_PRICE_IMPACT_BPS = 500;

/**
 * Default slippage-tolerance ceiling (10%). A swap whose requested slippage tolerance exceeds
 * this is blocked: an over-wide tolerance drives min-out near zero and invites sandwich/MEV
 * value loss. Server-overridable via MAX_SLIPPAGE_BPS (never an LLM-controlled value).
 */
export const DEFAULT_MAX_SLIPPAGE_BPS = 1000;

/** Guardian pass result — includes the WYSIWYS digest and dry-run effects. */
export interface GuardianPass {
  ok: true;
  /** The PTB bytes exactly as inspected (base64). Pass these to the wallet. */
  txBytes: string;
  /**
   * SHA-256 hex digest of the exact PTB bytes.
   * The sign hook MUST assert digest(signedBytes) === approvedDigest before mutateAsync.
   */
  approvedDigest: string;
  /** Dry-run balance deltas for the preview card. */
  dryRunResult: DryRunResult;
  /** Preview data for the UI card. */
  preview: TxPreview;
}

/** Guardian block result — no PTB is returned. */
export interface GuardianBlock {
  ok: false;
  /** Human-readable block reasons (may be multiple gates). */
  reasons: string[];
  /** Which gate(s) triggered the block. */
  gates: string[];
}

export type GuardianResult = GuardianPass | GuardianBlock;

/** Data needed to render the TxPreviewCard. */
export interface TxPreview {
  actionLabel: string;
  /** The action type that was approved — used by the preview card for conditional rendering. */
  actionType: ActionType;
  coinTypeIn: string;
  coinTypeOut?: string;
  amountInNative: bigint;
  minAmountOutNative?: bigint;
  slippageBps?: number;
  swapSource?: SwapSource;
  routeProviders?: string[];
  recipientAddress?: string;
  estimatedUsdValue: number;
  gasCostMist: bigint;
  balanceDeltas: DryRunResult["balanceDeltas"];
  /** Contracts (Move targets) the PTB invokes, with allowlist provenance for the permissions UI. */
  contractsCalled: ContractCall[];
  /** Objects the PTB creates/mutates/transfers (permissions UI). Capped for display. */
  objectsTouched: NonNullable<DryRunResult["objectChanges"]>;
  /** Total object-change count before the display cap (FE renders "+K more"). */
  objectsTouchedTotal: number;
  /** Real decimals per coin type the preview displays (curated map → on-chain
   * CoinMetadata → 9). The client formats native amounts with these, so a non-9-decimal
   * swap output renders at the correct scale instead of a hardcoded default. */
  coinDecimals: Record<string, number>;
  capsWarning: boolean;
  /** True when any arg has provenance="derived" — surfaces provenance confirm. */
  requiresProvenanceConfirm: boolean;
  demoFixture: boolean;
  // --- Limit-order preview fields ---
  poolKey?: string;
  side?: "BUY" | "SELL";
  limitPrice?: number;
  limitQuantity?: number;
  expireTimestampMs?: number;
  bookParams?: { tickSize: number; lotSize: number; minSize: number };
  midPrice?: number;
  orderType?: "POST_ONLY";
  notionalQuote?: number;
  // --- Lending preview fields ---
  lendingProtocol?: LendingProtocol;
  healthBefore?: number;
  healthAfter?: number;
  // --- Staking preview fields ---
  lstProvider?: LstProvider;
}

// ---------------------------------------------------------------------------
// Cap constants (server-authoritative — read from env, NEVER from client)
// ---------------------------------------------------------------------------

/**
 * USD price per native unit for value-bounding. Prefers a LIVE SUI/USD price
 * (passed in, fetched once per guardian run) over the static $3 floor, which badly
 * overvalues SUI at current prices. Stablecoins/others fall back to the trusted map.
 */
function resolveUsdPrice(coinType: string, liveSuiUsd: number | undefined): number | undefined {
  if (liveSuiUsd !== undefined && normalizeCoinType(coinType) === COIN_TYPES.SUI) {
    return liveSuiUsd;
  }
  return getTrustedUsdPrice(coinType);
}

function getServerCaps(): { txUsdCap: number; dailyUsdCap: number } {
  // Hardening point #1: caps come from server-only env vars.
  // NEXT_PUBLIC_TX_USD_CAP is display-only; a tampered client value CANNOT reach here.
  // Defaults align with the displayed cap (NEXT_PUBLIC_TX_USD_CAP=5000) so a normal
  // swap isn't blocked out-of-box; set TX_USD_CAP / DAILY_USD_CAP in server env to tighten.
  const txUsdCap = parseFloat(process.env.TX_USD_CAP ?? "5000");
  const dailyUsdCap = parseFloat(process.env.DAILY_USD_CAP ?? "20000");
  if (isNaN(txUsdCap) || txUsdCap <= 0) {
    throw new Error("TX_USD_CAP env var is invalid — refusing all transactions.");
  }
  if (isNaN(dailyUsdCap) || dailyUsdCap <= 0) {
    throw new Error("DAILY_USD_CAP env var is invalid — refusing all transactions.");
  }
  return { txUsdCap, dailyUsdCap };
}

/**
 * Server-authoritative max swap slippage tolerance in bps. An LLM-supplied slippageBps above
 * this is blocked. Read from MAX_SLIPPAGE_BPS env; falls back to the 10% default on absent/invalid.
 */
function getMaxSlippageBps(): number {
  const raw = parseFloat(process.env.MAX_SLIPPAGE_BPS ?? String(DEFAULT_MAX_SLIPPAGE_BPS));
  return isNaN(raw) || raw <= 0 ? DEFAULT_MAX_SLIPPAGE_BPS : raw;
}

// ---------------------------------------------------------------------------
// SHA-256 digest helper (Node.js crypto — server-side only)
// ---------------------------------------------------------------------------

async function sha256HexNode(data: Uint8Array): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(data).digest("hex");
}

// ---------------------------------------------------------------------------
// Main guardianCheck entry point
// ---------------------------------------------------------------------------

/**
 * Run all security gates on a proposed transaction.
 * Returns GuardianPass with approvedDigest on success, GuardianBlock with reasons on any failure.
 * Every external call is wrapped in try/catch; any throw → block (fail-closed).
 *
 * @param proposal - The trade proposal from prepareTrade.
 * @param suiClient - Server-side mainnet SuiClient.
 */
export async function guardianCheck(
  proposal: TradeProposal,
  suiClient: SuiClient,
): Promise<GuardianResult> {
  const reasons: string[] = [];
  const gates: string[] = [];

  const block = (gate: string, reason: string) => {
    gates.push(gate);
    reasons.push(reason);
  };

  // --- Gate 7: Allowlist ({package::module::function}) ---
  // Run first so we never process PTBs with unknown targets.
  const allowlistResult = await checkAllowlist(proposal.txBytes);
  if (!allowlistResult.ok) {
    block("allowlist", allowlistResult.reason);
  }

  // --- Structural shape gate ---
  // Even when every individual call is allowlisted, the PTB's MoveCall set must
  // match the declared action's template — closes the "swap + smuggled
  // add_liquidity value-mover" composition bypass the per-target gate misses.
  const shapeResult = await checkActionShape(proposal);
  if (!shapeResult.ok) {
    block("action_shape", shapeResult.reason);
  }

  // --- Gate 9: Coin-type provenance (on-chain CoinMetadata) ---
  const coinTypeResult = await checkCoinTypeOnChain(proposal.coinTypeIn, suiClient);
  if (!coinTypeResult.ok) {
    block("coin_type", coinTypeResult.reason);
  }
  if (proposal.coinTypeOut) {
    const coinTypeOutResult = await checkCoinTypeOnChain(proposal.coinTypeOut, suiClient);
    if (!coinTypeOutResult.ok) {
      block("coin_type_out", coinTypeOutResult.reason);
    }
  }

  // --- Gate 6: Injection provenance ---
  const provenanceResult = checkProvenance(proposal);
  const requiresProvenanceConfirm = provenanceResult.requiresConfirm;
  if (provenanceResult.blocked) {
    block("injection_provenance", provenanceResult.reason!);
  }

  // Live SUI/USD (real oracle via aggregator, USDC=$1), fetched once per run and
  // reused across Gate 2 + the dry-run net-outflow gate. Falls back to the floor.
  const liveSuiUsd = await fetchSuiUsdPrice();

  // --- Gate 2: Trusted USD price + native-units cap fallback ---
  let estimatedUsdValue = 0;
  if (proposal.actionType === "limit_order" && proposal.limitPrice !== undefined && proposal.limitQuantity !== undefined) {
    // For limit orders: notional = price * quantity in quote currency.
    // DEEP_USDC and SUI_USDC use USDC as quote ($1). DEEP_SUI uses SUI as quote.
    const notionalQuote = proposal.limitPrice * proposal.limitQuantity;
    // Use quote-side USD price to convert notional to USD.
    // If no quoteCoinType is available, fall back to coinTypeIn trusted price.
    const quoteCoinType = proposal.coinTypeOut ?? proposal.coinTypeIn;
    const quotePrice = resolveUsdPrice(quoteCoinType, liveSuiUsd);
    if (quotePrice === undefined) {
      // For DEEP_SUI, quoteCoinType is SUI — resolveUsdPrice(SUI) returns a value.
      // If quote price is still unknown, fall through to coinTypeIn price as last resort.
      const basePrice = resolveUsdPrice(proposal.coinTypeIn, liveSuiUsd);
      if (basePrice === undefined) {
        block(
          "trusted_price",
          `No trusted USD price available for coin types ${proposal.coinTypeIn} / ${quoteCoinType}. ` +
            "Cannot verify limit-order notional value — blocking for safety.",
        );
      } else {
        estimatedUsdValue = notionalQuote * basePrice;
      }
    } else {
      estimatedUsdValue = notionalQuote * quotePrice;
    }
  } else {
    const usdPrice = resolveUsdPrice(proposal.coinTypeIn, liveSuiUsd);
    if (usdPrice === undefined) {
      block(
        "trusted_price",
        `No trusted USD price available for coin type ${proposal.coinTypeIn}. ` +
          "Cannot verify transaction value — blocking for safety.",
      );
    } else {
      const decimals = COIN_DECIMALS[proposal.coinTypeIn] ?? 9;
      estimatedUsdValue = (Number(proposal.amountInNative) / 10 ** decimals) * usdPrice;
    }
  }

  // --- Gate 1: Server-authoritative caps ---
  let capsWarning = false;
  try {
    const { txUsdCap, dailyUsdCap } = getServerCaps();
    if (estimatedUsdValue > txUsdCap) {
      block(
        "tx_cap",
        `Transaction value ~$${estimatedUsdValue.toFixed(2)} exceeds per-tx cap of $${txUsdCap}. ` +
          "Require explicit extra confirmation.",
      );
      capsWarning = true;
    }
    if (proposal.dailyUsdSpentSoFar + estimatedUsdValue > dailyUsdCap) {
      block(
        "daily_cap",
        `Daily spend would reach ~$${(proposal.dailyUsdSpentSoFar + estimatedUsdValue).toFixed(2)}, ` +
          `exceeding daily cap of $${dailyUsdCap}.`,
      );
      capsWarning = true;
    }
  } catch (err) {
    // Invalid cap config → block everything (fail-closed)
    block("cap_config", err instanceof Error ? err.message : String(err));
  }

  // --- Gate 8: SuiNS lookalike ---
  if (proposal.recipientAddress && proposal.verifiedContacts?.length) {
    const lookalike = checkSuiNSLookalike(
      proposal.recipientAddress,
      proposal.verifiedContacts,
    );
    if (lookalike.suspect) {
      block(
        "suins_lookalike",
        `Recipient "${proposal.recipientAddress}" is suspiciously similar to ` +
          `verified contact "${lookalike.similarTo}" (edit distance ≤${LOOKALIKE_EDIT_DISTANCE_THRESHOLD} after homoglyph normalization).`,
      );
    }
  }

  // --- Slippage-tolerance gate (swaps): refuse an over-wide tolerance ---
  // A very high slippageBps makes the on-chain min-out near zero, opening the fill to
  // sandwich/MEV value loss even on a deep pool. The ceiling is server-authoritative;
  // the LLM-supplied slippageBps can never widen past it.
  if (proposal.actionType === "swap" && proposal.slippageBps !== undefined) {
    const maxSlippageBps = getMaxSlippageBps();
    if (proposal.slippageBps > maxSlippageBps) {
      block(
        "slippage_tolerance",
        `Slippage tolerance ${(proposal.slippageBps / 100).toFixed(2)}% exceeds the ` +
          `${(maxSlippageBps / 100).toFixed(0)}% ceiling — an over-wide tolerance drives min-out near zero ` +
          "and invites sandwich/MEV loss. Refusing. Lower the slippage and retry.",
      );
    }
  }

  // --- Gate 4: Independent min-out cross-check (for swaps) ---
  // Runs for ANY swap with an output coin — not gated on poolId (the aggregator
  // has no single pool), so a swap can never skip the min-out re-derive.
  if (proposal.actionType === "swap" && proposal.coinTypeOut) {
    const minOutResult = await checkMinOut(proposal, suiClient);
    if (!minOutResult.ok) {
      block("min_out", minOutResult.reason);
    }
  }

  // --- Orderbook gates (for limit_order only) ---
  if (proposal.actionType === "limit_order") {
    const orderbookResult = await checkOrderbookConstraints(proposal);
    for (const err of orderbookResult.errors) {
      block(err.gate, err.reason);
    }
  }

  // --- Lending gates (for lend_* actions) ---
  if (proposal.actionType.startsWith("lend_")) {
    const lendResult = checkLendingConstraints(proposal);
    if (!lendResult.ok) {
      block("lending", lendResult.reason);
    }
  }

  // --- Staking gates (for stake/unstake actions) ---
  if (proposal.actionType === "stake" || proposal.actionType === "unstake") {
    const stakingResult = checkStakingConstraints(proposal);
    if (!stakingResult.ok) {
      block("staking", stakingResult.reason);
    }
  }

  // --- Composite recipe gate (for composite actions) ---
  // The composite gate replaces the single-action shape gate for composite proposals.
  // It enforces: (a) declared recipe exists in the closed registry, (b) PTB MoveCall
  // multiset == recipe's declared set, (c) delta/owner anti-leak (no third-party owner,
  // every positive delta accrues to sender), (d) net-SUI delta within cap.
  // Any deviation → BLOCK. Non-recipe intents must not reach this path (fail-closed).
  if (proposal.actionType === "composite") {
    const compositeResult = await checkCompositeRecipe(proposal, suiClient, liveSuiUsd);
    if (!compositeResult.ok) {
      block("composite_recipe", compositeResult.reason);
    }
  }

  // --- Post-tx health-factor gate (fail-closed, NAVI borrow/withdraw only) ---
  // Runs AFTER coin-type provenance + trusted-price, BEFORE dry-run. Uses NAVI's own
  // contracts via devInspect — contract-authoritative, not a hand-rolled formula.
  // undefined/NaN/Infinity from the simulation → BLOCK (never a silent pass).
  if (
    (proposal.actionType === "lend_borrow" || proposal.actionType === "lend_withdraw") &&
    proposal.lendingProtocol === "navi"
  ) {
    const hfResult = await checkPostTxHealthFactor(proposal, suiClient);
    if (!hfResult.ok) {
      block("hf_gate", hfResult.reason);
    }
  }

  // --- Borrow-inflow value cap (lend_borrow only) ---
  // A borrow is a positive balance delta (inflow) so computeNetOutflowUsd structurally
  // cannot cap it — it sums only negative deltas. This dedicated cap is the sole USD
  // backstop for borrow value. Runs only when HF gate has not already blocked.
  if (proposal.actionType === "lend_borrow" && !gates.includes("hf_gate")) {
    const borrowCapResult = checkBorrowInflowCap(proposal, liveSuiUsd);
    if (!borrowCapResult.ok) {
      block("borrow_cap", borrowCapResult.reason);
    }
  }

  // --- Order-lifecycle gates (cancel_order / withdraw_settled) ---
  // cancel_order: a resting order id must be present + well-formed (the on-chain
  // owner-proof + the upstream server-authoritative BM resolution bound ownership;
  // a cancel of a foreign/gone order aborts in the dry-run gate below).
  // withdraw_settled: recipient is hard-pinned to the sender, and the amount is
  // ceilinged by an independently re-derived settled balance (fail-closed).
  if (
    proposal.actionType === "cancel_order" ||
    proposal.actionType === "withdraw_settled" ||
    proposal.actionType === "claim_settled"
  ) {
    const olResult = await checkOrderLifecycleConstraints(proposal, suiClient);
    for (const err of olResult.errors) {
      block(err.gate, err.reason);
    }
  }

  // --- Gate 5 + Gate 3: Dry-run (fail-closed) + WYSIWYS digest ---
  // Even if earlier gates failed, we still need the digest for WYSIWYS.
  // But if other gates already blocked, we skip the RPC call (saves latency).
  let dryRunResult: DryRunResult | null = null;
  let approvedDigest = "";
  // Gas-less TransactionKind the client signs (wallet fills gas fresh). Falls back to the
  // full bytes only if dry-run is skipped (it never is on the pass path).
  let signableBytes = proposal.txBytes;

  if (reasons.length === 0) {
    // Only attempt dry-run if all prior gates passed (avoid leaking RPC calls on blocked tx)
    const dryRunCheck = await runDryRunGate(proposal.txBytes, suiClient, proposal.walletAddress, proposal.recipientAddress);
    if (!dryRunCheck.ok) {
      block("dry_run", dryRunCheck.reason);
    } else {
      dryRunResult = dryRunCheck.result;
      approvedDigest = dryRunCheck.digest;
      signableBytes = dryRunCheck.signableBytes;

      // --- Authoritative value gate: cap from ACTUAL net outflow ---
      // Value the transaction from the dry-run's net balance deltas (what really
      // leaves the user's wallet), not the self-declared amount. A composed PTB
      // that moves more than declared is caught here. Limit orders rest on the
      // book (deltas ~0), so they keep the notional-based value computed earlier.
      if (proposal.actionType !== "limit_order") {
        const outflow = computeNetOutflowUsd(dryRunResult, proposal.walletAddress, liveSuiUsd);
        if (!outflow.ok) {
          block("trusted_price", outflow.reason);
        } else {
          try {
            const { txUsdCap, dailyUsdCap } = getServerCaps();
            if (outflow.usd > txUsdCap) {
              block(
                "tx_cap",
                `Actual net outflow ~$${outflow.usd.toFixed(2)} (valued from dry-run balance deltas) ` +
                  `exceeds per-tx cap of $${txUsdCap}.`,
              );
              capsWarning = true;
            }
            if (proposal.dailyUsdSpentSoFar + outflow.usd > dailyUsdCap) {
              block(
                "daily_cap",
                `Daily spend would reach ~$${(proposal.dailyUsdSpentSoFar + outflow.usd).toFixed(2)} ` +
                  `(actual outflow), exceeding daily cap of $${dailyUsdCap}.`,
              );
              capsWarning = true;
            }
          } catch (err) {
            block("cap_config", err instanceof Error ? err.message : String(err));
          }
          // Cross-check: actual outflow must not materially exceed the declared
          // value (catches a within-cap drain hiding behind a small declared amount).
          const SANITY_RATIO = 1.5;
          if (
            outflow.usd > estimatedUsdValue * SANITY_RATIO &&
            outflow.usd - estimatedUsdValue > 0.5
          ) {
            block(
              "outflow_mismatch",
              `Transaction outflows ~$${outflow.usd.toFixed(2)} but the declared action value is ` +
                `~$${estimatedUsdValue.toFixed(2)} — moves more than declared. Refusing.`,
            );
          }
          // Surface the actual outflow as the previewed value when it is larger.
          if (outflow.usd > estimatedUsdValue) estimatedUsdValue = outflow.usd;
        }
      }

      // Low-liquidity / price-impact gate — refuse a swap whose output is worth materially less
      // than its input (thin-pool / bad-rate protection), valued from the dry-run's actual deltas.
      if (dryRunResult) {
        const impact = checkSwapPriceImpact(dryRunResult, proposal, liveSuiUsd);
        if (!impact.ok) block("low_liquidity", impact.reason);
      }
    }
  }

  // --- Final verdict ---
  if (reasons.length > 0) {
    return { ok: false, reasons, gates };
  }

  // All gates passed — return pass with approvedDigest and preview.
  // Resolve real decimals for EVERY coin type the preview displays (in/out + each dry-run
  // balance delta) so the client never falls back to a hardcoded default (a non-9-decimal
  // swap output otherwise renders ~1000× off, e.g. 44 → 0.04).
  const coinDecimals: Record<string, number> = {};
  const previewCoinTypes = new Set<string>([
    proposal.coinTypeIn,
    ...(proposal.coinTypeOut ? [proposal.coinTypeOut] : []),
    ...dryRunResult!.balanceDeltas.map((d) => d.coinType),
  ]);
  for (const ct of previewCoinTypes) {
    coinDecimals[ct] = await resolveCoinDecimals(ct, suiClient);
  }

  // Contracts the PTB calls — display-only, derived from the same bytes the gates
  // already parsed, so it cannot fail here (defensive empty on any parse miss).
  let contractsCalled: ContractCall[] = [];
  try {
    contractsCalled = buildContractsCalled(extractMoveTargets(proposal.txBytes));
  } catch {
    contractsCalled = [];
  }

  // Objects the PTB touches, shaped for the capped preview. capObjectsForPreview keeps
  // third-party transfers + unclassified owners always visible (never hidden by the cap)
  // and reports the true total for the "+K more" affordance.
  const { shown: objectsTouched, total: objectsTouchedTotal } = capObjectsForPreview(
    dryRunResult!.objectChanges ?? [],
    6,
  );

  const preview: TxPreview = {
    actionLabel: proposal.actionLabel,
    actionType: proposal.actionType,
    coinTypeIn: proposal.coinTypeIn,
    coinTypeOut: proposal.coinTypeOut,
    amountInNative: proposal.amountInNative,
    minAmountOutNative: proposal.minAmountOutNative,
    slippageBps: proposal.slippageBps,
    swapSource: proposal.actionType === "swap" ? (proposal.swapSource ?? "cetus") : undefined,
    routeProviders: proposal.routeProviders,
    recipientAddress: proposal.recipientAddress,
    estimatedUsdValue,
    gasCostMist: dryRunResult!.gasCostMist,
    balanceDeltas: dryRunResult!.balanceDeltas,
    contractsCalled,
    objectsTouched,
    objectsTouchedTotal,
    coinDecimals,
    capsWarning,
    requiresProvenanceConfirm,
    demoFixture: process.env.NEXT_PUBLIC_DEMO_MODE === "fixture",
    // Limit-order preview fields (populated when actionType === "limit_order")
    poolKey: proposal.poolKey,
    side: proposal.side,
    limitPrice: proposal.limitPrice,
    limitQuantity: proposal.limitQuantity,
    expireTimestampMs: proposal.expireTimestampMs,
    bookParams: proposal.bookParams,
    midPrice: proposal.midPrice,
    orderType: proposal.actionType === "limit_order" ? "POST_ONLY" : undefined,
    notionalQuote:
      proposal.limitPrice !== undefined && proposal.limitQuantity !== undefined
        ? proposal.limitPrice * proposal.limitQuantity
        : undefined,
    lendingProtocol: proposal.lendingProtocol,
    healthBefore: proposal.healthBefore,
    healthAfter: proposal.healthAfter,
    lstProvider: proposal.lstProvider,
  };

  return {
    ok: true,
    // The client signs the gas-less TransactionKind; the wallet adds gas at sign time.
    txBytes: signableBytes,
    approvedDigest,
    dryRunResult: dryRunResult!,
    preview,
  };
}

// ---------------------------------------------------------------------------
// Gate implementations (pure where possible, testable in isolation)
// ---------------------------------------------------------------------------

// Gate 7: Allowlist
interface GateResult { ok: boolean; reason: string }

export async function checkAllowlist(txBytesB64: string): Promise<GateResult> {
  let calls;
  try {
    calls = extractMoveTargets(txBytesB64);
  } catch (err) {
    // Parsing failure → unknown content → block
    return {
      ok: false,
      reason: `Failed to parse PTB for allowlist check: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  for (const call of calls) {
    // classifyTarget is the SINGLE predicate shared with the preview labeller:
    // pass iff the call is exact-package pinned OR an aggregator/aftermath route call
    // matched by module::function signature (their per-route integration package is
    // upgradeable and cannot be statically pinned; the action-shape + value gates
    // bound those swaps). Enforcing the carve-out here — not via an upstream skip —
    // keeps the gate decision and the displayed allowlist provenance from drifting.
    if (classifyTarget(call.target, call.module, call.function) === "none") {
      // Status-aware reason: if the target maps to a known-but-excluded
      // protocol, name it; otherwise the generic refusal.
      const owner = getProtocolByTarget(call.target);
      const statusNote = owner
        ? ` Target belongs to "${owner.name}", which is ${owner.status}` +
          `${owner.lastIncident ? ` (security incident ${owner.lastIncident.date})` : ""} — refused.`
        : "";
      return {
        ok: false,
        reason:
          `Move call "${call.target}" is not on the protocol allowlist (refused before build).` +
          statusNote,
      };
    }
  }
  return { ok: true, reason: "" };
}

// ---------------------------------------------------------------------------
// Structural PTB-shape gate (closes the compose-two-allowlisted-calls bypass)
// ---------------------------------------------------------------------------

/**
 * Move-call targets each action type may legitimately contain. Commands
 * (splitCoins/mergeCoins/transferObjects) are NOT MoveCalls and are not
 * constrained here — value movement is bounded by the dry-run net-outflow cap.
 *
 * For stake/unstake the allowed set is SINGLE-TARGET and provider-keyed: an
 * afSUI-declared stake only accepts the Aftermath request_stake_and_keep target;
 * a haSUI-declared stake only accepts the Haedal interface::request_stake target.
 * A PTB built for provider A cannot pass the shape gate for provider B.
 */
function allowedTargetsForAction(actionType: ActionType, proposal?: TradeProposal): Set<string> {
  switch (actionType) {
    case "swap":
      return new Set([
        // Direct Cetus CLMM swap.
        `${CETUS_CLMM_PACKAGE}::pool::swap`,
        `${CETUS_CLMM_PACKAGE_V2}::pool::swap`,
        // Aggregator router_v3 swap calls (router scaffolding + per-hop <dex>::swap)
        // are additionally accepted by module::function signature in checkActionShape
        // (isAggregatorSwapCall), because the live router emits a per-route,
        // upgradeable integration package that cannot be statically pinned. The
        // venue set is bounded upstream by the provider constraint (CETUS+DEEPBOOK)
        // at quote time, and the value gates bound the swap. These exact-package
        // entries stay for the known-current packages / defense-in-depth.
        `${CETUS_AGGREGATOR_PACKAGE}::router::new_swap_context`,
        `${CETUS_AGGREGATOR_PACKAGE}::router::confirm_swap`,
        `${CETUS_AGGREGATOR_PACKAGE}::router::transfer_or_destroy_coin`,
        `${CETUS_AGGREGATOR_CETUS_PACKAGE}::cetus::swap`,
        `${CETUS_AGGREGATOR_PACKAGE}::cetus::swap`,
        `${CETUS_AGGREGATOR_PACKAGE}::deepbookv3::swap`,
        // Aftermath Router static scaffolding (utils package — exact-package allowlist).
        // Per-DEX calls (router::swap_a_b, swap_b_a, add_swap_exact_in_to_route) are
        // caught by isAftermathSwapCall in checkActionShape (package-agnostic).
        `${AFTERMATH_ROUTER_UTILS_PACKAGE}::swap_cap::obtain_router_cap`,
        `${AFTERMATH_ROUTER_UTILS_PACKAGE}::swap_cap::initiate_path`,
        `${AFTERMATH_ROUTER_UTILS_PACKAGE}::swap_cap::return_router_cap_already_payed_fee`,
      ]);
    case "add_liquidity":
      return new Set([
        `${CETUS_CLMM_PACKAGE}::pool::add_liquidity_fix_coin`,
        `${CETUS_CLMM_PACKAGE_V2}::pool::add_liquidity_fix_coin`,
      ]);
    case "limit_order":
      return new Set([
        `${DEEPBOOK_PACKAGE}::pool::place_limit_order`,
        `${DEEPBOOK_PACKAGE}::pool::cancel_order`,
        `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_owner`,
        `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_trader`,
        `${DEEPBOOK_PACKAGE}::balance_manager::new`,
        `${DEEPBOOK_PACKAGE}::balance_manager::deposit`,
      ]);
    case "bm_create":
      // Onboarding step 1: create + share a BalanceManager. ONLY these two calls —
      // no deposit/order may ride along (those are separate gated actions).
      return new Set([
        `${DEEPBOOK_PACKAGE}::balance_manager::new`,
        `${NATIVE_PACKAGE}::transfer::public_share_object`,
      ]);
    case "bm_deposit":
      // Onboarding step 2: fund the BM. ONLY deposit — never the limit_order set,
      // which bundles place_limit_order (a deposit must not smuggle an order in).
      return new Set([`${DEEPBOOK_PACKAGE}::balance_manager::deposit`]);
    case "cancel_order":
      // Cancel one resting order. The SDK emits an owner trade-proof immediately
      // before the cancel, so the proof calls are part of the legitimate shape — but
      // NOT place_limit_order/deposit/withdraw (no order or value-mover may ride along).
      return new Set([
        `${DEEPBOOK_PACKAGE}::pool::cancel_order`,
        `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_owner`,
        `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_trader`,
      ]);
    case "withdraw_settled":
      // Withdraw a settled balance to the SENDER. The SDK emits balance_manager::withdraw
      // (partial) or balance_manager::withdraw_all (full); the recipient transfer is a
      // TransferObjects command (not a MoveCall) pinned to the sender in the builder.
      return new Set([
        `${DEEPBOOK_PACKAGE}::balance_manager::withdraw`,
        `${DEEPBOOK_PACKAGE}::balance_manager::withdraw_all`,
      ]);
    case "claim_settled":
      // Claim settled balances pool→BM. Each pool emits an owner trade-proof immediately
      // before `pool::withdraw_settled_amounts`. No place_limit_order/deposit/withdraw may
      // ride along (no order or wallet-bound value-mover smuggled in).
      return new Set([
        `${DEEPBOOK_PACKAGE}::pool::withdraw_settled_amounts`,
        `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_owner`,
        `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_trader`,
      ]);
    case "lend_deposit":
      // Health-improving deposits only — NAVI entry_deposit / Suilend mint+deposit.
      // NAVI's SDK also emits pool::refresh_stake (refreshes reward accounting before
      // the deposit; moves no value), so it is part of the legitimate deposit shape.
      return new Set([
        `${NAVI_PACKAGE}::incentive_v3::entry_deposit`,
        `${NAVI_PACKAGE}::pool::refresh_stake`,
        // Suilend first-deposit: create the obligation, then deposit into it. A SUI deposit
        // also appends rebalance_staker (value-neutral liquid-staking accounting on the reserve).
        `${SUILEND_PACKAGE}::lending_market::create_obligation`,
        `${SUILEND_PACKAGE}::lending_market::deposit_liquidity_and_mint_ctokens`,
        `${SUILEND_PACKAGE}::lending_market::deposit_ctokens_into_obligation`,
        `${SUILEND_PACKAGE}::lending_market::rebalance_staker`,
      ]);
    case "lend_repay":
      return new Set([
        `${NAVI_PACKAGE}::incentive_v3::entry_repay`,
        `${SUILEND_PACKAGE}::lending_market::repay`,
      ]);
    case "lend_borrow":
      // Minimal-exact allowlist for NAVI borrow (no accountCap path, v1 + v2 protocol).
      // borrowCoinPTB emits exactly one of these targets depending on the pool's protocol
      // version. No deposit/repay/withdraw targets are included — a smuggled deposit call
      // inside a borrow shape is refused. The SDK also emits 0x2::coin::from_balance to
      // wrap the returned Balance<T>; that target is in noValueFrameworkCalls (globally
      // allowed inside any shape) and is therefore NOT listed here.
      return new Set([
        `${NAVI_PACKAGE}::incentive_v3::borrow`,    // v1 protocol, no accountCap
        `${NAVI_PACKAGE}::incentive_v3::borrow_v2`, // v2 protocol, no accountCap
      ]);
    case "lend_withdraw":
      // Minimal-exact allowlist for NAVI withdraw (no accountCap path, v1 + v2 protocol).
      // withdrawCoinPTB emits exactly one of these targets depending on pool protocol version.
      // 0x2::coin::from_balance (Balance→Coin wrap) is in noValueFrameworkCalls — not here.
      return new Set([
        `${NAVI_PACKAGE}::incentive_v3::withdraw`,    // v1 protocol, no accountCap
        `${NAVI_PACKAGE}::incentive_v3::withdraw_v2`, // v2 protocol, no accountCap
      ]);
    case "bridge_redeem":
      // Only the Sui-side Wormhole Token-Bridge redeem.
      return new Set([`${WORMHOLE_WTT_PACKAGE}::complete_transfer::complete_transfer`]);
    case "stake": {
      // Provider-keyed single-target: only the declared provider's stake entry is allowed.
      // A PTB built for afSUI cannot pass a haSUI-declared stake shape and vice versa.
      const lstProvider = proposal?.lstProvider ?? "afsui";
      if (lstProvider === "hasui") {
        // Haedal direct-PTB: interface::request_stake sends haSUI to recipient in same call.
        return new Set([`${HAEDAL_PACKAGE}::interface::request_stake`]);
      }
      // Default: afSUI (Aftermath). Minimal-exact: only request_stake_and_keep.
      // The "and_keep" variant transfers afSUI to the wallet in the same call —
      // no extra TransferObjects needed. Non-atomic request_unstake absent (not a stake verb).
      return new Set([`${AFTERMATH_LSD_PACKAGE}::staked_sui_vault::request_stake_and_keep`]);
    }
    case "unstake": {
      // Provider-keyed single-target: only the declared provider's unstake entry is allowed.
      const lstProvider = proposal?.lstProvider ?? "afsui";
      if (lstProvider === "hasui") {
        // Haedal direct-PTB: request_unstake_instant sends SUI to sender instantly.
        return new Set([`${HAEDAL_PACKAGE}::interface::request_unstake_instant`]);
      }
      // Default: afSUI (Aftermath). Only the atomic variant — instant SUI return, no epoch wait.
      return new Set([`${AFTERMATH_LSD_PACKAGE}::staked_sui_vault::request_unstake_atomic_and_keep`]);
    }
    case "transfer":
      // Supported transfers (SUI) use splitCoins+transferObjects — no MoveCall —
      // so the legitimate shape has an empty MoveCall set. Any MoveCall in a
      // transfer PTB is unexpected and refused here. (Non-SUI transfers are not
      // currently a supported build path; were they wired, their target would
      // need an explicit allowlist + shape entry.)
      return new Set<string>();
    case "composite":
      // Composite proposals are verified by checkCompositeRecipe (target-multiset +
      // delta/owner anti-leak), NOT by the single-action shape gate. Returning an
      // empty set here would BLOCK all composite calls via checkActionShape. Instead
      // we skip single-action shape checking for composite proposals by returning a
      // sentinel "allow-all-for-composite" set — the composite gate is authoritative.
      // The skipping logic lives in checkActionShape (see the composite early-return below).
      return new Set<string>();
    default:
      return new Set();
  }
}

/**
 * Assert the PTB's MoveCall set matches the declared action's template. Any call
 * outside that set — even an allowlisted one belonging to a different action —
 * is refused. This closes the bypass where a declared swap also smuggles a
 * second allowlisted value-mover (e.g. add_liquidity) past the per-target gate.
 */
export async function checkActionShape(proposal: TradeProposal): Promise<GateResult> {
  // Composite proposals are verified by checkCompositeRecipe — not the single-action
  // shape gate. Skip this gate for composite actions; the composite gate is authoritative.
  if (proposal.actionType === "composite") {
    return { ok: true, reason: "" };
  }

  try {
    const bytes = Buffer.from(proposal.txBytes, "base64");
    const tx = Transaction.from(bytes);
    const commands = tx.getData().commands ?? [];
    const allowed = allowedTargetsForAction(proposal.actionType, proposal);
    // Zero-value framework calls permitted inside ANY action's shape: the SuiNS forward
    // resolve (read-only), coin::destroy_zero (aborts unless the coin balance is 0 — drops
    // the emptied input coin), coin::from_balance (wraps a swap-output Balance into a Coin),
    // and the Balance/Coin plumbing a multi-hop aggregator route uses to merge/split/unwrap
    // intermediate balances WITHIN the PTB (balance::join/split, coin::into_balance). None
    // move value out of the wallet — the dry-run net-outflow cap is the value bound.
    const noValueFrameworkCalls = new Set([
      `${SUINS_PACKAGE}::registry::lookup`,
      `${NATIVE_PACKAGE}::coin::destroy_zero`,
      `${NATIVE_PACKAGE}::coin::from_balance`,
      `${NATIVE_PACKAGE}::balance::join`,
      `${NATIVE_PACKAGE}::balance::split`,
      `${NATIVE_PACKAGE}::coin::into_balance`,
    ]);

    for (const cmd of commands) {
      if (!("MoveCall" in cmd) || !cmd.MoveCall) continue;
      const mc = cmd.MoveCall;
      const target = `${mc.package}::${mc.module}::${mc.function}`;
      if (noValueFrameworkCalls.has(target)) continue;
      // A swap's aggregator-route calls (router scaffolding + per-hop <dex>::swap)
      // carry a per-route, upgradeable package, so they are matched by
      // module::function signature rather than an exact package target. This keeps
      // multi-venue routes (e.g. a DeepBook leg) from being falsely refused while
      // the value gates (cap, min-out, provider constraint) bound the swap.
      if (proposal.actionType === "swap" && isAggregatorSwapCall(mc.module, mc.function)) continue;
      // Aftermath per-DEX router calls carry an upgradeable integration package
      // per pool — matched by module::function (same rationale as aggregator above).
      if (proposal.actionType === "swap" && isAftermathSwapCall(mc.module, mc.function)) continue;
      if (!allowed.has(target)) {
        return {
          ok: false,
          reason:
            `PTB shape mismatch: a "${proposal.actionType}" action must not contain the call "${target}". ` +
            "An unexpected value-moving command was found — refusing the composed transaction.",
        };
      }
    }
    return { ok: true, reason: "" };
  } catch (err) {
    return {
      ok: false,
      reason: `Failed to parse PTB for action-shape check: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Lending gate — verb safety + protocol-active routing
// ---------------------------------------------------------------------------

/**
 * Lending constraints (allowlist-before-build):
 *  - deposit/repay are health-IMPROVING → permitted when the protocol is active+built.
 *    The USD value moved is bounded by the dry-run net-outflow cap, and the coin must
 *    be priced (the trusted-price gate blocks unpriced collateral).
 *  - borrow/withdraw are health-REDUCING → permitted here after the HF gate unlocked
 *    them; the post-tx health-factor simulation (checkPostTxHealthFactor) and the
 *    borrow-inflow value cap run in guardianCheck AFTER this function returns ok.
 *    This function only validates the protocol field — not the HF itself.
 */
export function checkLendingConstraints(proposal: TradeProposal): GateResult {
  const { lendingProtocol, actionType } = proposal;

  if (!lendingProtocol) {
    return {
      ok: false,
      reason: "Lending action requires a lendingProtocol — none provided. Blocking (fail-closed).",
    };
  }
  // Borrow/withdraw are NAVI-only: the post-tx health-factor gate (checkPostTxHealthFactor)
  // is NAVI-specific, and the Suilend builder has no borrow/withdraw path. Allowing a
  // non-NAVI borrow/withdraw would skip the HF check and mis-build the PTB. Suilend stays
  // deposit/repay (deep-link for the rest). Fail-closed.
  if (
    (actionType === "lend_borrow" || actionType === "lend_withdraw") &&
    lendingProtocol !== "navi"
  ) {
    return {
      ok: false,
      reason: `"${actionType}" is only supported on NAVI (health-factor gated); "${lendingProtocol}" is not. Blocking (fail-closed).`,
    };
  }
  const gate = assertProtocolActive(lendingProtocol);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason ?? `Lending protocol "${lendingProtocol}" is not active.` };
  }
  return { ok: true, reason: "" };
}

// ---------------------------------------------------------------------------
// Staking constraints gate — Aftermath LST stake / unstake + Haedal haSUI
// ---------------------------------------------------------------------------

/**
 * Staking constraints:
 *  - Provider must be a known LST provider (afsui|hasui). Unknown → BLOCK.
 *  - Protocol must be active+built in the registry (aftermath-staking for afSUI, haedal for haSUI).
 *  - The LST coin type must be the canonical type from COIN_DECIMALS (curated map).
 *    A scam-clone haSUI/afSUI with a different package address is blocked by the coin_type
 *    gate upstream (not in COIN_DECIMALS) — this gate adds a belt-and-suspenders check
 *    on coinTypeOut for stake and coinTypeIn for unstake.
 *
 * Fail-closed: any unknown coin type, unknown provider, or inactive protocol → BLOCK.
 */
export function checkStakingConstraints(proposal: TradeProposal): GateResult {
  const { actionType, lstProvider = "afsui" } = proposal;

  // Unknown provider → fail-closed.
  if (lstProvider !== "afsui" && lstProvider !== "hasui") {
    return {
      ok: false,
      reason: `Unknown lstProvider "${lstProvider}". Must be "afsui" or "hasui". Blocking (fail-closed).`,
    };
  }

  // Verify the staking protocol entry is active+built in the registry.
  const registryId = lstProvider === "hasui" ? "haedal" : "aftermath-staking";
  const gate = assertProtocolActive(registryId);
  if (!gate.ok) {
    return {
      ok: false,
      reason: gate.reason ?? `Staking protocol "${registryId}" is not active. Blocking (fail-closed).`,
    };
  }

  // For stake: coinTypeOut should be the canonical LST for this provider (not a clone).
  // The coin_type gate already checks on-chain CoinMetadata; this adds a registry
  // check that the outgoing LST is in our curated COIN_DECIMALS map.
  if (actionType === "stake") {
    const outType = proposal.coinTypeOut;
    if (!outType || !COIN_DECIMALS[outType]) {
      return {
        ok: false,
        reason:
          `stake action output coin type "${outType ?? "(missing)"}" is not in the curated coin map — ` +
          "cannot verify LST provenance. Blocking (fail-closed): use the canonical LST type.",
      };
    }
  }

  // For unstake: coinTypeIn should be a curated LST type (afSUI or haSUI).
  // An unpriced LST as input means the outflow cap cannot be computed → fail-closed.
  if (actionType === "unstake") {
    const inType = proposal.coinTypeIn;
    if (!COIN_DECIMALS[inType]) {
      return {
        ok: false,
        reason:
          `unstake action input coin type "${inType}" is not in the curated coin map — ` +
          "cannot verify LST provenance or price the outflow. Blocking (fail-closed).",
      };
    }
  }

  return { ok: true, reason: "" };
}

// ---------------------------------------------------------------------------
// Post-tx Health-Factor gate — NAVI borrow / withdraw (fail-closed)
// ---------------------------------------------------------------------------

/**
 * Server-authoritative minimum post-tx health factor for NAVI borrow/withdraw.
 * Never serialized to the client. The threshold is 1.6 (NAVI liquidates at ~1.0;
 * 1.6 provides a meaningful safety buffer above the liquidation boundary).
 */
function getNaviHfThreshold(): number {
  const raw = parseFloat(process.env.NAVI_HF_THRESHOLD ?? "1.6");
  return isNaN(raw) || raw <= 0 ? 1.6 : raw;
}

/**
 * Server-authoritative borrow cap in USD (borrow-specific, not net-outflow).
 * A borrow is an inflow to the wallet — computeNetOutflowUsd sums only negative
 * balance deltas and structurally cannot see it. This cap is the sole USD backstop
 * for borrow value; it mirrors the per-tx cap style.
 */
function getNaviBorrowCap(): number {
  const raw = parseFloat(process.env.NAVI_BORROW_USD_CAP ?? "5000");
  return isNaN(raw) || raw <= 0 ? 5000 : raw;
}

interface HfGateResult {
  ok: boolean;
  reason: string;
}

/**
 * Simulate the post-tx health factor via NAVI's own contracts and block when it
 * would fall below the threshold. Fail-closed: any unreadable/missing/invalid
 * simulation result is treated as BLOCK, never a pass.
 *
 * Called for lend_borrow and lend_withdraw AFTER coin-type provenance + trusted-price,
 * BEFORE the dry-run/WYSIWYS gate.
 */
export async function checkPostTxHealthFactor(
  proposal: TradeProposal,
  suiClient: SuiClient,
): Promise<HfGateResult> {
  const { walletAddress, coinTypeIn, amountInNative, actionType } = proposal;
  const isBorrow = actionType === "lend_borrow";
  const opType = isBorrow ? NAVI_OP_BORROW : NAVI_OP_WITHDRAW;
  const threshold = getNaviHfThreshold();

  let hf: number;
  try {
    hf = await simulateNaviHealthFactor(
      walletAddress,
      coinTypeIn,
      { type: opType, amount: Number(amountInNative) },
      suiClient,
    );
  } catch (err) {
    // simulateNaviHealthFactor always throws on failure (fail-closed design).
    return {
      ok: false,
      reason:
        `Post-tx health factor check failed — blocking (fail-closed): ` +
        `${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Second-level validation: the simulation result must be a finite positive number.
  // undefined/null/NaN/Infinity are all unverified states — treat as BLOCK (fail-closed).
  // navi-hf-simulation.ts already throws on these, but this guard defends against a caller
  // swapping out simulateNaviHealthFactor for a mock that returns invalid values directly.
  if (hf === undefined || hf === null || !isFinite(hf) || isNaN(hf)) {
    return {
      ok: false,
      reason:
        `Post-tx health factor simulation returned an unverifiable value (${hf}) — ` +
        `cannot confirm post-tx safety. Blocking (fail-closed).`,
    };
  }

  if (hf < threshold) {
    return {
      ok: false,
      reason:
        `Post-tx health factor ${hf.toFixed(4)} would be below the safety threshold of ${threshold}. ` +
        `${isBorrow ? "Borrow" : "Withdraw"} refused to protect your collateral from liquidation.`,
    };
  }

  return { ok: true, reason: "" };
}

/**
 * Borrow-inflow value gate: a borrow is a positive balance delta (inflow) so
 * computeNetOutflowUsd structurally cannot cap it. This gate independently
 * values the borrow amount and enforces a server-authoritative borrow cap.
 *
 * Runs only for lend_borrow. Fail-closed: unpriced coin → BLOCK.
 */
function checkBorrowInflowCap(
  proposal: TradeProposal,
  liveSuiUsd: number | undefined,
): HfGateResult {
  const { coinTypeIn, amountInNative } = proposal;
  const price = resolveUsdPrice(coinTypeIn, liveSuiUsd);
  if (price === undefined) {
    return {
      ok: false,
      reason:
        `Cannot value the borrow amount in "${coinTypeIn}" — no trusted USD price available. ` +
        `Blocking (fail-closed): unpriced borrow is unbounded.`,
    };
  }
  const decimals = COIN_DECIMALS[coinTypeIn] ?? 9;
  const usd = (Number(amountInNative) / 10 ** decimals) * price;
  const cap = getNaviBorrowCap();
  if (usd > cap) {
    return {
      ok: false,
      reason:
        `Borrow value ~$${usd.toFixed(2)} exceeds the per-tx borrow cap of $${cap}. ` +
        `A borrow is an inflow so it is not visible to the standard outflow cap — ` +
        `this dedicated borrow cap is the value backstop.`,
    };
  }
  return { ok: true, reason: "" };
}

// ---------------------------------------------------------------------------
// Order-lifecycle gate — cancel a resting order / withdraw a settled balance
// ---------------------------------------------------------------------------

/**
 * Gate the two DeepBook order-management verbs. All checks are fail-closed.
 *
 * cancel_order: a well-formed resting order id + a whitelisted pool must be present.
 *   The cancel touches no value (settled funds return to the BM); BM ownership is
 *   enforced at the server boundary (prepareTrade re-resolves the sender's BMs) and
 *   again by the on-chain owner-proof — a cancel of a foreign/already-gone order
 *   aborts in the dry-run gate.
 *
 * withdraw_settled: the recipient is hard-pinned to the sender (no third-party
 *   outflow), and the requested amount is ceilinged by an INDEPENDENTLY re-derived
 *   settled balance (read on-chain here, never cached, never caller-supplied). A
 *   read failure BLOCKS — an unverifiable ceiling is not a pass.
 */
export async function checkOrderLifecycleConstraints(
  proposal: TradeProposal,
  suiClient: SuiClient,
): Promise<OrderbookConstraintsResult> {
  const errors: OrderbookGateError[] = [];

  // Both verbs operate on a specific BalanceManager (server-resolved upstream).
  if (!proposal.balanceManagerId || !/^0x[0-9a-fA-F]{64}$/.test(proposal.balanceManagerId)) {
    errors.push({
      gate: "ol_balance_manager",
      reason: "A valid BalanceManager id is required for this action — none resolved. Blocking (fail-closed).",
    });
    return { errors };
  }

  // claim_settled moves owed funds pool→BM (no order id, no recipient, no wallet outflow).
  // A valid BM (checked above) is the only precondition; the on-chain owner-proof + dry-run
  // enforce ownership and that there is something to settle.
  if (proposal.actionType === "claim_settled") {
    return { errors };
  }

  if (proposal.actionType === "cancel_order") {
    if (!proposal.orderId || !/^0x[0-9a-fA-F]+$/.test(proposal.orderId)) {
      errors.push({
        gate: "ol_order_id",
        reason: `cancel_order requires a 0x-hex orderId — got "${proposal.orderId ?? "(missing)"}". Blocking.`,
      });
    }
    if (!proposal.poolKey || !(proposal.poolKey in DEEPBOOK_POOLS)) {
      errors.push({
        gate: "ol_pool_whitelist",
        reason:
          `cancel_order poolKey "${proposal.poolKey ?? "(missing)"}" is not whitelisted. ` +
          `Allowed pools: ${Object.keys(DEEPBOOK_POOLS).join(", ")}.`,
      });
    }
    return { errors };
  }

  // --- withdraw_settled ---
  // 1. Recipient pinned to sender (the builder hard-pins it; reject any drift here too).
  if (
    proposal.recipientAddress &&
    proposal.recipientAddress.toLowerCase() !== proposal.walletAddress.toLowerCase()
  ) {
    errors.push({
      gate: "ol_recipient",
      reason:
        `withdraw_settled may only return funds to the sender. Recipient "${proposal.recipientAddress}" ` +
        "differs from the wallet — refusing third-party outflow.",
    });
  }

  // 2. Re-derive the settled balance on-chain (fail-closed: any read error BLOCKS).
  let settled: number;
  try {
    settled = await readSettledBalance(
      suiClient,
      proposal.walletAddress,
      proposal.balanceManagerId,
      proposal.coinTypeIn,
    );
  } catch (err) {
    errors.push({
      gate: "ol_settled_read",
      reason:
        "Could not verify the settled balance available to withdraw (on-chain read failed). " +
        `Blocking (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
    });
    return { errors };
  }

  // 3. Requested amount must not exceed the settled balance.
  const decimals =
    COIN_DECIMALS[normalizeCoinType(proposal.coinTypeIn)] ?? COIN_DECIMALS[proposal.coinTypeIn] ?? 9;
  const requestedHuman = Number(proposal.amountInNative) / 10 ** decimals;
  // Epsilon guards float representation of the SDK's human-scaled balance.
  const EPSILON = 1e-9;
  if (requestedHuman > settled + EPSILON) {
    errors.push({
      gate: "ol_withdraw_ceiling",
      reason:
        `Withdraw of ${requestedHuman} exceeds the settled balance ${settled} available in the ` +
        "BalanceManager for this coin. Reduce the amount.",
    });
  }

  return { errors };
}

// ---------------------------------------------------------------------------
// Net-outflow valuation — the authoritative cap basis (from dry-run deltas)
// ---------------------------------------------------------------------------

type OutflowResult = { ok: true; usd: number } | { ok: false; reason: string };

/**
 * Sum the USD value of everything that actually LEAVES the user's wallet in the
 * dry-run (negative balance deltas owned by the sender), priced via the trusted
 * USD map. Gas is subtracted from the SUI outflow so gas alone never trips the
 * cap. An outflow in an unpriced coin → fail-closed block (value unbounded).
 */
export function computeNetOutflowUsd(
  dryRun: DryRunResult,
  sender: string,
  liveSuiUsd?: number,
): OutflowResult {
  let usd = 0;
  const senderNorm = sender.toLowerCase();
  for (const d of dryRun.balanceDeltas) {
    if (d.amount >= 0n) continue; // inflow — not an outflow
    if ((d.owner ?? "").toLowerCase() !== senderNorm) continue; // only the user's own funds
    // On-chain balance changes use short addresses (e.g. "0x2::sui::SUI"); canonicalize
    // so SUI-gas subtraction, the price lookup, and the decimals lookup all match the
    // full-length curated keys. Without this, SUI outflows read as an unpriced coin → block.
    const coinType = normalizeCoinType(d.coinType);
    let outNative = -d.amount;
    if (coinType === COIN_TYPES.SUI) {
      outNative = outNative > dryRun.gasCostMist ? outNative - dryRun.gasCostMist : 0n;
    }
    if (outNative <= 0n) continue;
    const price = resolveUsdPrice(coinType, liveSuiUsd);
    if (price === undefined) {
      return {
        ok: false,
        reason:
          `Dry-run shows an outflow in "${coinType}", which has no trusted USD price — ` +
          "cannot bound the transaction value. Blocking (fail-closed).",
      };
    }
    const decimals = COIN_DECIMALS[coinType] ?? 9;
    usd += (Number(outNative) / 10 ** decimals) * price;
  }
  return { ok: true, usd };
}

interface PriceImpactResult {
  ok: boolean;
  reason: string;
}

/**
 * Swap price-impact gate: block when the output is worth materially less than the input, valued
 * from the dry-run's ACTUAL balance deltas via the trusted oracle. Catches thin-liquidity / bad-rate
 * routes (e.g. ~0.7 USDC out for 1 SUI in) that the min-out consistency check can't — both the PTB
 * and the fresh quote agree on a bad rate, so only an absolute USD-value comparison catches it.
 *
 * Enforced only when BOTH coins have a trusted USD price; a long-tail coin with no oracle price
 * falls back to the min-out cross-check. `maxBps` is server-injected (proposal.maxPriceImpactBps),
 * defaulting to 5%.
 */
function checkSwapPriceImpact(
  dryRun: DryRunResult,
  proposal: TradeProposal,
  liveSuiUsd: number | undefined,
): PriceImpactResult {
  if (proposal.actionType !== "swap" || !proposal.coinTypeOut) return { ok: true, reason: "" };
  const inType = normalizeCoinType(proposal.coinTypeIn);
  const outType = normalizeCoinType(proposal.coinTypeOut);
  const sender = proposal.walletAddress.toLowerCase();

  let inUsd = 0;
  let outUsd = 0;
  let inPriced = false;
  let outPriced = false;
  for (const d of dryRun.balanceDeltas) {
    if ((d.owner ?? "").toLowerCase() !== sender) continue;
    const coinType = normalizeCoinType(d.coinType);
    const price = resolveUsdPrice(coinType, liveSuiUsd);
    if (price === undefined) continue;
    const decimals = COIN_DECIMALS[coinType] ?? 9;
    if (coinType === inType && d.amount < 0n) {
      let spent = -d.amount;
      // SUI input shares the gas coin — exclude gas so it isn't counted as swap value.
      if (coinType === COIN_TYPES.SUI) {
        spent = spent > dryRun.gasCostMist ? spent - dryRun.gasCostMist : spent;
      }
      inUsd += (Number(spent) / 10 ** decimals) * price;
      inPriced = true;
    } else if (coinType === outType && d.amount > 0n) {
      outUsd += (Number(d.amount) / 10 ** decimals) * price;
      outPriced = true;
    }
  }

  if (!inPriced || !outPriced || inUsd <= 0) return { ok: true, reason: "" };

  const maxBps = proposal.maxPriceImpactBps ?? DEFAULT_MAX_PRICE_IMPACT_BPS;
  if (outUsd < inUsd * (1 - maxBps / 10_000)) {
    const lossPct = ((inUsd - outUsd) / inUsd) * 100;
    const limitPct = maxBps / 100;
    return {
      ok: false,
      reason:
        `Low liquidity — price impact too high: you pay ~$${inUsd.toFixed(2)} but receive only ~$${outUsd.toFixed(2)} ` +
        `— a ${lossPct.toFixed(1)}% value loss, above the ${limitPct % 1 === 0 ? limitPct.toFixed(0) : limitPct.toFixed(1)}% limit. ` +
        "Refusing — the pool is too thin for this size. Try a smaller amount, a different token, or another route.",
    };
  }
  return { ok: true, reason: "" };
}

// Gate 9: Coin-type on-chain verification
/**
 * Resolve a coin type's decimals for the preview display: curated map first (fast path
 * for known coins), then on-chain CoinMetadata, then a 9-decimal default. Display-only —
 * the signed PTB uses native units regardless of this.
 */
export async function resolveCoinDecimals(coinType: string, suiClient: SuiClient): Promise<number> {
  const curated = COIN_DECIMALS[coinType];
  if (curated !== undefined) return curated;
  try {
    const meta = await suiClient.getCoinMetadata({ coinType });
    if (meta && typeof meta.decimals === "number") return meta.decimals;
  } catch {
    /* fall through to default */
  }
  return 9;
}

export async function checkCoinTypeOnChain(
  coinType: string,
  suiClient: SuiClient,
): Promise<GateResult> {
  // Check local curated map first (fast path for known types)
  if (COIN_DECIMALS[coinType] !== undefined) {
    return { ok: true, reason: "" };
  }
  // Unknown type: try to fetch CoinMetadata from chain
  try {
    const meta = await suiClient.getCoinMetadata({ coinType });
    if (!meta) {
      return {
        ok: false,
        reason: `Coin type "${coinType}" has no on-chain CoinMetadata — cannot verify identity. Blocking.`,
      };
    }
    return { ok: true, reason: "" };
  } catch (err) {
    return {
      ok: false,
      reason: `CoinMetadata lookup failed for "${coinType}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Gate 6: Injection provenance — implementation is the single source of truth in
// guardian-gates.ts (pure, SDK-free; imported above for guardianCheck). Re-exported
// here so the public API surfaced via index.ts is unchanged.
export { checkProvenance };
export type { ProvenanceResult } from "./guardian-gates";

// Gate 8: SuiNS lookalike
interface LookalikeResult { suspect: boolean; similarTo: string | null }

export function checkSuiNSLookalike(
  inputName: string,
  verifiedContacts: string[],
): LookalikeResult {
  const normalizedInput = normalizeHomoglyphs(
    inputName.toLowerCase().replace(/\.sui$/, ""),
  );

  for (const contact of verifiedContacts) {
    const normalizedContact = normalizeHomoglyphs(
      contact.toLowerCase().replace(/\.sui$/, ""),
    );
    // Skip exact match — same name is not a lookalike
    if (normalizedInput === normalizedContact) continue;
    const dist = editDistance(normalizedInput, normalizedContact);
    if (dist <= LOOKALIKE_EDIT_DISTANCE_THRESHOLD) {
      return { suspect: true, similarTo: contact };
    }
  }
  return { suspect: false, similarTo: null };
}

// Gate 4: Independent min-out cross-check
interface MinOutResult { ok: boolean; reason: string }

async function checkMinOut(
  proposal: TradeProposal,
  suiClient: SuiClient,
): Promise<MinOutResult> {
  // Guard on `=== undefined`, NOT falsiness: slippageBps=0 is a real value and
  // must NOT skip the min-out re-derive (a 0-bps swap with a tampered zero
  // min-out would otherwise slip through both this gate and the decimals check).
  if (!proposal.coinTypeOut || proposal.slippageBps === undefined) {
    return { ok: true, reason: "" };
  }

  // Re-derive min-out from a FRESH independent quote of the SAME source the PTB
  // was built with. Never cross sources (e.g. Cetus quote with an Aftermath PTB).
  const source = proposal.swapSource ?? "cetus";
  let freshQuote: SwapQuote;
  try {
    if (source === "aggregator") {
      freshQuote = await fetchAggregatorQuote(
        proposal.coinTypeIn,
        proposal.coinTypeOut,
        proposal.amountInNative,
        proposal.slippageBps,
      );
    } else if (source === "aftermath") {
      freshQuote = await fetchAftermathQuote(
        proposal.coinTypeIn,
        proposal.coinTypeOut,
        proposal.amountInNative,
        proposal.slippageBps,
      );
    } else {
      freshQuote = await fetchSwapQuote(
        proposal.coinTypeIn,
        proposal.coinTypeOut,
        proposal.amountInNative,
        proposal.slippageBps,
      );
    }
  } catch (err) {
    // Quote fetch failure → fail-closed (hardening #5)
    return {
      ok: false,
      reason: `Fresh quote fetch failed during min-out verification: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Cross-check on-chain CoinMetadata decimals vs curated map (hardening #4)
  const curatedDecimalsIn = COIN_DECIMALS[proposal.coinTypeIn];
  const curatedDecimalsOut = COIN_DECIMALS[proposal.coinTypeOut];

  let onChainDecimalsIn: number | undefined;
  let onChainDecimalsOut: number | undefined;
  try {
    const metaIn = await suiClient.getCoinMetadata({ coinType: proposal.coinTypeIn });
    const metaOut = await suiClient.getCoinMetadata({ coinType: proposal.coinTypeOut });
    onChainDecimalsIn = metaIn?.decimals;
    onChainDecimalsOut = metaOut?.decimals;
  } catch (err) {
    return {
      ok: false,
      reason: `CoinMetadata fetch failed during decimals cross-check: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Decimals mismatch between curated map and on-chain source → block (hardening #4)
  if (
    onChainDecimalsIn !== undefined &&
    curatedDecimalsIn !== undefined &&
    onChainDecimalsIn !== curatedDecimalsIn
  ) {
    return {
      ok: false,
      reason:
        `Decimals mismatch for ${proposal.coinTypeIn}: ` +
        `curated map says ${curatedDecimalsIn}, on-chain CoinMetadata says ${onChainDecimalsIn}. ` +
        "Sources disagree — blocking to prevent min-out calculation error.",
    };
  }
  if (
    onChainDecimalsOut !== undefined &&
    curatedDecimalsOut !== undefined &&
    onChainDecimalsOut !== curatedDecimalsOut
  ) {
    return {
      ok: false,
      reason:
        `Decimals mismatch for ${proposal.coinTypeOut}: ` +
        `curated map says ${curatedDecimalsOut}, on-chain CoinMetadata says ${onChainDecimalsOut}. ` +
        "Sources disagree — blocking to prevent min-out calculation error.",
    };
  }

  // A swap PTB must embed a min-out for the Guardian to compare against. A swap
  // that reaches here with no embedded min-out cannot be verified ⇒ block
  // (fail-closed for any caller, not just prepareTrade which always supplies it).
  if (proposal.minAmountOutNative === undefined) {
    return {
      ok: false,
      reason:
        "Swap PTB has no embedded min-out for the Guardian to verify against the " +
        "independent quote — cannot bound slippage. Blocking (fail-closed).",
    };
  }

  // Compare PTB-embedded min-out vs freshly-derived min-out (10% tolerance band)
  {
    const embeddedMinOut = proposal.minAmountOutNative;
    const freshMinOut = freshQuote.minAmountOut;
    // Tolerance: fresh min-out must be within 10% of embedded value
    // Wider divergence → market moved or stale PTB → block
    const TOLERANCE = 10n; // 10%
    const diff =
      embeddedMinOut > freshMinOut
        ? embeddedMinOut - freshMinOut
        : freshMinOut - embeddedMinOut;
    const threshold = (freshMinOut * TOLERANCE) / 100n;

    if (diff > threshold) {
      return {
        ok: false,
        reason:
          `Min-out cross-check failed: PTB embeds ${embeddedMinOut} but fresh quote gives ${freshMinOut}. ` +
          `Difference ${diff} exceeds 10% tolerance band. ` +
          "Market may have moved or PTB was built from stale data. Blocking.",
      };
    }
  }

  return { ok: true, reason: "" };
}

// Gate 5 + Gate 3: Dry-run (fail-closed) + WYSIWYS digest
interface DryRunGateResult {
  ok: boolean;
  reason: string;
  result?: DryRunResult;
  digest?: string;
}

async function runDryRunGate(
  txBytesB64: string,
  suiClient: SuiClient,
  senderAddress?: string,
  recipientAddress?: string,
): Promise<DryRunGateResult & { result: DryRunResult; digest: string; signableBytes: string }> {
  let result: DryRunResult;
  try {
    // sender/recipient only LABEL object-change ownership in the preview (you / recipient /
    // third-party); they never affect the gate decision (bytes + balance-delta driven).
    result = await dryRunTransaction(suiClient, txBytesB64, senderAddress, recipientAddress);
  } catch (err) {
    // DryRunFailedError or any other error → fail-closed (hardening #5)
    const isDryRunError = err instanceof DryRunFailedError;
    return {
      ok: false,
      reason: isDryRunError
        ? err.message
        : `Unexpected error during dry-run: ${err instanceof Error ? err.message : String(err)}`,
      result: undefined as unknown as DryRunResult,
      digest: "",
      signableBytes: "",
    };
  }

  // WYSIWYS digest over the TransactionKind ONLY (gas-agnostic signing). The dry-run
  // above ran the FULL bytes (server-resolved gas) for effects/value, but the user signs
  // a gas-less kind: the wallet fills the gas coin at sign time, so a single/​churning gas
  // coin can never go stale between build and sign ("unavailable for consumption"). We
  // approve + hash exactly the programmable content (inputs + commands) the user consents
  // to; gas selection is the wallet's concern and is excluded from WYSIWYS.
  const kindBytes = await Transaction.from(txBytesB64).build({ onlyTransactionKind: true });
  const signableBytes = Buffer.from(kindBytes).toString("base64");
  const digest = await sha256HexNode(kindBytes);

  return { ok: true, reason: "", result, digest, signableBytes };
}

// ---------------------------------------------------------------------------
// Orderbook gates — DeepBook-specific, fail-closed
// ---------------------------------------------------------------------------

interface OrderbookGateError { gate: string; reason: string }
interface OrderbookConstraintsResult { errors: OrderbookGateError[] }

/**
 * Run DeepBook-specific orderbook gates on a limit-order proposal.
 * All four gates are independent; all failures are collected (not short-circuited)
 * so the block result surfaces every problem at once.
 *
 * Gates:
 *   1. Pool whitelist — poolKey must be in DEEPBOOK_POOLS
 *   2. Tick/lot/min-size alignment — price, quantity must be aligned to bookParams
 *   3. POST_ONLY assertion — the PTB's place_limit_order must encode orderType=3
 *   4. Price-vs-mid fat-finger band — blocks obviously wrong prices (sanity rail)
 */
export async function checkOrderbookConstraints(
  proposal: TradeProposal,
): Promise<OrderbookConstraintsResult> {
  const errors: OrderbookGateError[] = [];

  // Gate OB-1: Pool whitelist
  if (!proposal.poolKey || !(proposal.poolKey in DEEPBOOK_POOLS)) {
    errors.push({
      gate: "ob_pool_whitelist",
      reason:
        `Limit-order poolKey "${proposal.poolKey ?? "(missing)"}" is not on the whitelisted pool list. ` +
        `Allowed pools: ${Object.keys(DEEPBOOK_POOLS).join(", ")}.`,
    });
    // Cannot validate further without a valid pool key
    return { errors };
  }

  // Gate OB-2: Tick/lot/min-size alignment (independent re-derivation from bookParams)
  if (proposal.bookParams && proposal.limitPrice !== undefined && proposal.limitQuantity !== undefined) {
    const { tickSize, lotSize, minSize } = proposal.bookParams;
    const tickErrors = validateOrderAlignment(
      proposal.limitPrice,
      proposal.limitQuantity,
      tickSize,
      lotSize,
      minSize,
    );
    for (const msg of tickErrors) {
      errors.push({ gate: "ob_tick_lot_alignment", reason: msg });
    }
  }

  // Gate OB-3: POST_ONLY enforcement — parse PTB and assert orderType arg = 3
  const postOnlyResult = checkPostOnlyInPtb(proposal.txBytes);
  if (!postOnlyResult.ok) {
    errors.push({ gate: "ob_post_only", reason: postOnlyResult.reason });
  }

  // Gate OB-4: Price-vs-mid fat-finger band
  // BUY price must not exceed mid × 1.5; SELL price must not be below mid × 0.5.
  // This is a sanity rail against obviously wrong inputs, not a slippage gate.
  if (
    proposal.midPrice !== undefined &&
    proposal.limitPrice !== undefined &&
    proposal.side !== undefined
  ) {
    const mid = proposal.midPrice;
    const price = proposal.limitPrice;
    const FAT_FINGER_HIGH = 1.5; // BUY cap: 50% above mid
    const FAT_FINGER_LOW = 0.5;  // SELL floor: 50% below mid
    if (proposal.side === "BUY" && price > mid * FAT_FINGER_HIGH) {
      errors.push({
        gate: "ob_fat_finger",
        reason:
          `BUY limit price ${price} is more than 50% above mid-price ${mid} ` +
          `(> ${(mid * FAT_FINGER_HIGH).toFixed(8)}). Possible fat-finger — blocking for safety.`,
      });
    }
    if (proposal.side === "SELL" && price < mid * FAT_FINGER_LOW) {
      errors.push({
        gate: "ob_fat_finger",
        reason:
          `SELL limit price ${price} is more than 50% below mid-price ${mid} ` +
          `(< ${(mid * FAT_FINGER_LOW).toFixed(8)}). Possible fat-finger — blocking for safety.`,
      });
    }
  }

  // Gate OB-5: Expiry required
  if (proposal.expireTimestampMs === undefined || proposal.expireTimestampMs <= 0) {
    errors.push({
      gate: "ob_expiry_required",
      reason:
        "Limit orders must have an expiry timestamp set. " +
        "An order without an expiry could rest at a stale price indefinitely.",
    });
  }

  return { errors };
}

/**
 * Pure alignment validation — mirrors validateTickLotAlignment in build-limit-order.ts.
 * Re-implemented here so the Guardian never imports from the builder (independence principle).
 */
function validateOrderAlignment(
  price: number,
  quantity: number,
  tickSize: number,
  lotSize: number,
  minSize: number,
): string[] {
  const errors: string[] = [];

  const tickDecimals = countDecimals(tickSize);
  const lotDecimals = countDecimals(lotSize);

  const priceScaled = Math.round(price * 10 ** tickDecimals);
  const tickScaled = Math.round(tickSize * 10 ** tickDecimals);
  if (tickScaled > 0 && priceScaled % tickScaled !== 0) {
    errors.push(
      `Price ${price} is not aligned to tick size ${tickSize}. ` +
        `Price must be a multiple of ${tickSize}.`,
    );
  }

  const qtyScaled = Math.round(quantity * 10 ** lotDecimals);
  const lotScaled = Math.round(lotSize * 10 ** lotDecimals);
  if (lotScaled > 0 && qtyScaled % lotScaled !== 0) {
    errors.push(
      `Quantity ${quantity} is not aligned to lot size ${lotSize}. ` +
        `Quantity must be a multiple of ${lotSize}.`,
    );
  }

  if (quantity < minSize) {
    errors.push(`Quantity ${quantity} is below minimum order size ${minSize}.`);
  }

  return errors;
}

function countDecimals(n: number): number {
  const s = n.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Parse the PTB and assert that any place_limit_order MoveCall encodes
 * orderType = 3 (POST_ONLY). Rejects market (0), limit (1), and IOC (2).
 *
 * The SDK serializes orderType as a Pure u8 argument. We locate the
 * place_limit_order call and inspect its pure args.
 *
 * If parsing fails → block (fail-closed: unknown content is always blocked).
 */
export function checkPostOnlyInPtb(txBytesB64: string): { ok: boolean; reason: string } {
  const PLACE_LIMIT_ORDER_FN = "place_limit_order";
  const POST_ONLY_VALUE = 3;

  // DeepBook `pool::place_limit_order` argument layout (verified against
  // @mysten/deepbook-v3 DeepBookContract.placeLimitOrder source):
  //   [0] pool (object)        [6] price (u64)
  //   [1] balanceManager (obj) [7] quantity (u64)
  //   [2] tradeProof (result)  [8] isBid (bool)
  //   [3] clientOrderId (u64)  [9] payWithDeep (bool)
  //   [4] orderType (u8)  ◄    [10] expiration (u64)
  //   [5] selfMatchingOption   [11] clock (object)
  // We bind to index 4 and assert u8 == 3. The previous "scan every 1-byte Pure"
  // approach false-rejected valid orders (selfMatchingOption=1 / isBid/payWithDeep
  // bools are also 1-byte) and could false-pass if a stray u8 happened to be 3.
  const ORDER_TYPE_ARG_INDEX = 4;

  try {
    const bytes = Buffer.from(txBytesB64, "base64");
    const tx = Transaction.from(bytes);
    const data = tx.getData();
    const commands = data.commands ?? [];
    const inputs = (data.inputs ?? []) as unknown[];

    for (const cmd of commands) {
      if (!("MoveCall" in cmd) || !cmd.MoveCall) continue;
      const mc = cmd.MoveCall;
      if (mc.function !== PLACE_LIMIT_ORDER_FN) continue;

      const args = mc.arguments ?? [];
      const orderTypeU8 = resolvePureU8(args[ORDER_TYPE_ARG_INDEX], inputs);

      if (orderTypeU8 === undefined) {
        return {
          ok: false,
          reason:
            "Could not read the order-type argument from place_limit_order — " +
            "cannot verify POST_ONLY. Blocking (fail-closed).",
        };
      }
      if (orderTypeU8 !== POST_ONLY_VALUE) {
        return {
          ok: false,
          reason:
            `place_limit_order order type is ${orderTypeU8}, not POST_ONLY (3). ` +
            "Market (0), immediate-or-cancel (1), and fill-or-kill (2) are not permitted.",
        };
      }
    }

    // No place_limit_order call → gate not applicable (only invoked for limit_order).
    return { ok: true, reason: "" };
  } catch (err) {
    return {
      ok: false,
      reason:
        `Failed to parse PTB for POST_ONLY assertion: ` +
        (err instanceof Error ? err.message : String(err)),
    };
  }
}

/**
 * Resolve a MoveCall argument to its single-byte (u8) Pure value, handling both
 * an inline `{ Pure: { bytes } }` argument and an `{ Input: n }` reference into
 * the transaction's input list. Returns undefined if it isn't a 1-byte Pure.
 */
function resolvePureU8(arg: unknown, inputs: unknown[]): number | undefined {
  const decode1 = (b?: string): number | undefined => {
    if (!b) return undefined;
    const d = Buffer.from(b, "base64");
    return d.length === 1 ? d[0] : undefined;
  };
  if (!arg || typeof arg !== "object") return undefined;
  if ("Pure" in arg) {
    return decode1((arg as { Pure?: { bytes?: string } }).Pure?.bytes);
  }
  if ("Input" in arg) {
    const idx = (arg as { Input?: number }).Input;
    if (typeof idx !== "number") return undefined;
    const input = inputs[idx];
    if (input && typeof input === "object" && "Pure" in input) {
      return decode1((input as { Pure?: { bytes?: string } }).Pure?.bytes);
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Composite recipe gate — enforces the closed-set invariant for atomic composites
// ---------------------------------------------------------------------------

/**
 * Default net-SUI-delta outflow cap for composite transactions (in MIST).
 * Bounds tx.gas-split exfiltration independently of the USD cap — a composite
 * that drains more SUI than declared is BLOCK'd even when the USD value is within cap.
 * 10 SUI = 10 * 10^9 MIST. Server-overridable; never LLM-controlled.
 */
export const NET_SUI_DELTA_CAP_MIST = 10_000_000_000n; // 10 SUI

/**
 * Composite recipe gate — the authoritative composite safety check.
 *
 * Enforces four invariants (all fail-closed):
 *
 * (a) Target MULTISET: the composite PTB's MoveCall set must equal the declared
 *     recipe's allowedTargets multiset (no extra/missing calls). Aggregator/aftermath
 *     per-route calls are additionally admitted by module::function signature (same
 *     rationale as the single-action shape gate). Any unlisted call → BLOCK.
 *
 * (b) Coin-type provenance: the declared compositeLegs linkage must be coherent —
 *     swap output coin type must match the lend input coin type (no value teleportation).
 *
 * (c) Delta/owner anti-leak (AUTHORITATIVE): every object change in the dry-run
 *     must have an owner that is the sender, a shared object, or an object-owned
 *     (wrapped/dynamic field). ANY third-party address owner → BLOCK. This closes
 *     the tx.gas-split→TransferObjects SUI exfil AND the Result-derived-recipient
 *     vectors regardless of graph shape — a leak shows up as a non-sender owner.
 *     Reuses classifyOwner/extractObjectChanges from dry-run-object-changes.ts.
 *
 * (d) Net USD cap + net SUI delta cap on the whole composite PTB (not per-leg).
 *     Reuses computeNetOutflowUsd for the USD outflow. The net-SUI cap is independent:
 *     sum all SUI balance deltas for the sender; if net outflow exceeds the cap → BLOCK.
 *     This specifically bounds tx.gas exfiltration not caught by the USD cap alone.
 *
 * Dry-run failure → BLOCK (fail-closed: can't verify → refuse).
 * Unknown recipe → BLOCK (only declared recipes are composable).
 * Unpriced coin in outflow → BLOCK (value unbounded).
 * Unclassifiable owner → BLOCK (fail-loud, never benign).
 */
export async function checkCompositeRecipe(
  proposal: TradeProposal,
  suiClient: SuiClient,
  liveSuiUsd?: number,
): Promise<GateResult> {
  // --- Require a declared recipe id ---
  const recipeId = proposal.compositeRecipeId;
  if (!recipeId) {
    return {
      ok: false,
      reason:
        "Composite action requires a compositeRecipeId — none provided. " +
        "Refusing (fail-closed: no ad-hoc composition).",
    };
  }

  // Resolve the recipe: either a pre-registered static recipe OR a dynamically-built
  // recipe derived from the declared compositeLegs.actionType annotations.
  //
  // "dynamic" is a sentinel id that means "build the recipe from the declared legs".
  // All other ids must match a pre-registered static recipe in the registry.
  let recipe: CompositeRecipe;
  let isDynamic = false;
  if (recipeId === "dynamic") {
    // Dynamic path: build the recipe from the per-leg actionType declared in compositeLegs.
    // compositeLegs is required but MAY be empty (e.g. a zero-declared-recipient gas-only
    // composite — the anti-leak gate enforces that no third-party inflows exist).
    // Fail-closed: compositeLegs must not be undefined.
    if (!proposal.compositeLegs) {
      return {
        ok: false,
        reason:
          'Dynamic composite ("dynamic" recipe id) requires compositeLegs (may be empty). ' +
          "Refusing (fail-closed).",
      };
    }
    const legTypes = proposal.compositeLegs.map((l) => ({
      actionType: (l.actionType ?? "swap") as "send" | "swap" | "lend_deposit" | "stake",
    }));
    if (legTypes.length === 0) {
      // Zero-leg dynamic: no MoveCall requirements; only anti-leak + caps apply.
      recipe = { id: "dynamic", description: "Dynamic composite (zero legs)", legs: [], linkages: [] };
    } else {
      try {
        recipe = buildDynamicRecipe(legTypes);
      } catch (err) {
        return {
          ok: false,
          reason:
            `Failed to build dynamic recipe: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
    isDynamic = true;
  } else {
    const staticRecipe = getRecipe(recipeId);
    if (!staticRecipe) {
      return {
        ok: false,
        reason:
          `Composite recipe "${recipeId}" is not in the declared registry. ` +
          "Only pre-declared recipes may be composed into a single PTB.",
      };
    }
    recipe = staticRecipe;
  }

  // --- (a) Target multiset check ---
  const multisetResult = checkCompositeTargetMultiset(proposal.txBytes, recipe);
  if (!multisetResult.ok) return multisetResult;

  // --- (b) Coin-type provenance check ---
  // Skip for dynamic recipes: dynamic composites have no pre-declared linkages.
  // Independent legs each source from the wallet; chained legs are verified by the
  // builder's output-coin threading (not expressible in a static linkage list).
  if (!isDynamic) {
    const provenanceResult = checkCompositeCoinProvenance(proposal, recipe);
    if (!provenanceResult.ok) return provenanceResult;
  }

  // --- Extract declared send legs for the recipient-aware anti-leak check ---
  // These are the WYSIWYS-approved recipients captured at proposal time.
  // Recipients are already resolved 0x addresses — never re-resolved here (no TOCTOU).
  const declaredSendLegs: SendLeg[] = [];
  if (proposal.compositeLegs) {
    for (const leg of proposal.compositeLegs) {
      if (leg.actionType === "send" && leg.recipient) {
        declaredSendLegs.push({
          recipient: leg.recipient,
          coinType: leg.coinTypeIn,
          amountMist: leg.amountInNative,
        });
      }
    }
  }

  // --- Run dry-run for (c) and (d) ---
  // Fail-closed: any dry-run error → BLOCK. We pass the sender address so
  // extractObjectChanges can classify owners correctly relative to the sender.
  // Uses the statically imported dryRunTransaction (same binding the test mocks via vi.mock).
  let dryRun: DryRunResult;
  try {
    dryRun = await dryRunTransaction(suiClient, proposal.txBytes, proposal.walletAddress);
  } catch (err) {
    return {
      ok: false,
      reason:
        `Composite dry-run failed — cannot verify the transaction's effects. ` +
        `Blocking (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // --- (c) Recipient-aware anti-leak ---
  // When declaredSendLegs is empty (e.g. swap_lend_v1), degrades to the original
  // "no third-party inflow" check — backward compatible.
  const leakResult = checkCompositeDeltaAntiLeak(dryRun, proposal.walletAddress, declaredSendLegs);
  if (!leakResult.ok) return leakResult;

  // --- (d) Net-USD cap on whole composite ---
  const outflow = computeNetOutflowUsd(dryRun, proposal.walletAddress, liveSuiUsd);
  if (!outflow.ok) {
    return { ok: false, reason: outflow.reason };
  }

  let txUsdCap: number;
  let dailyUsdCap: number;
  try {
    ({ txUsdCap, dailyUsdCap } = getServerCaps());
  } catch (err) {
    return {
      ok: false,
      reason: `Cap config error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (outflow.usd > txUsdCap) {
    return {
      ok: false,
      reason:
        `Composite net outflow ~$${outflow.usd.toFixed(2)} exceeds per-tx cap of $${txUsdCap}. ` +
        "Blocking the composite.",
    };
  }
  if (proposal.dailyUsdSpentSoFar + outflow.usd > dailyUsdCap) {
    return {
      ok: false,
      reason:
        `Composite would push daily spend to ~$${(proposal.dailyUsdSpentSoFar + outflow.usd).toFixed(2)}, ` +
        `exceeding the daily cap of $${dailyUsdCap}.`,
    };
  }

  // --- (d) Net-SUI delta cap (independent of USD cap) ---
  // Sum all SUI balance deltas for the sender. A negative net means SUI left the wallet.
  // Cap bounds tx.gas-split→TransferObjects exfil not otherwise constrained by USD alone.
  const suiCapMist = proposal.netSuiDeltaCapMist ?? NET_SUI_DELTA_CAP_MIST;
  const netSuiResult = checkNetSuiDeltaCap(dryRun, proposal.walletAddress, suiCapMist);
  if (!netSuiResult.ok) return netSuiResult;

  return { ok: true, reason: "" };
}

/**
 * (a) Check that the PTB's MoveCall multiset exactly matches the declared recipe's
 * allowedTargets union across all legs (no extra, no missing).
 *
 * Framework/zero-value calls (coin::destroy_zero, coin::from_balance, etc.) are
 * excluded from the multiset comparison — they are permitted inside any composite
 * leg and do not represent external protocol calls. Aggregator/aftermath per-route
 * calls are additionally admitted by module::function signature.
 */
function checkCompositeTargetMultiset(txBytesB64: string, recipe: CompositeRecipe): GateResult {
  const noValueFrameworkCalls = new Set([
    `${SUINS_PACKAGE}::registry::lookup`,
    `${NATIVE_PACKAGE}::coin::destroy_zero`,
    `${NATIVE_PACKAGE}::coin::from_balance`,
    `${NATIVE_PACKAGE}::balance::join`,
    `${NATIVE_PACKAGE}::balance::split`,
    `${NATIVE_PACKAGE}::coin::into_balance`,
  ]);

  // Union of all targets allowed across all recipe legs.
  const allowedUnion = new Set<string>();
  for (const leg of recipe.legs) {
    for (const t of leg.allowedTargets) allowedUnion.add(t);
  }

  let calls;
  try {
    calls = extractMoveTargets(txBytesB64);
  } catch (err) {
    return {
      ok: false,
      reason: `Failed to parse composite PTB for multiset check: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  for (const call of calls) {
    if (noValueFrameworkCalls.has(call.target)) continue;
    // Aggregator/aftermath per-route calls admitted by signature (per-route package is upgradeable).
    if (isAggregatorSwapCall(call.module, call.function)) continue;
    if (isAftermathSwapCall(call.module, call.function)) continue;
    if (!allowedUnion.has(call.target)) {
      return {
        ok: false,
        reason:
          `Composite PTB contains an unlisted MoveCall "${call.target}" not in recipe "${recipe.id}". ` +
          "An extra call was spliced in — refusing the composite (multiset mismatch).",
      };
    }
  }

  // Check that at least one call from each recipe leg is present (no missing legs).
  // This catches a stripped composite that omits an entire leg while passing the
  // "no extra calls" check above.
  //
  // EXCEPTION: "send" legs have zero allowedTargets (TransferObjects is a PTB command,
  // not a MoveCall). Requiring a call for a zero-target leg would always fail. These
  // legs are verified exclusively by the recipient-aware anti-leak gate (gate c).
  for (let i = 0; i < recipe.legs.length; i++) {
    const leg = recipe.legs[i];
    // Skip the "has at least one call" requirement for zero-target legs (e.g. send).
    // Their correctness is the anti-leak gate's responsibility, not this multiset gate.
    if (leg.allowedTargets.size === 0) continue;

    const legAllowed = leg.allowedTargets;
    const hasLegCall = calls.some(
      (c) =>
        legAllowed.has(c.target) ||
        (leg.allowSignatureMatch && (isAggregatorSwapCall(c.module, c.function) || isAftermathSwapCall(c.module, c.function))),
    );
    if (!hasLegCall) {
      return {
        ok: false,
        reason:
          `Composite PTB is missing calls for leg ${i} ("${leg.actionType}") of recipe "${recipe.id}". ` +
          "The declared recipe requires all legs to be present.",
      };
    }
  }

  return { ok: true, reason: "" };
}

/**
 * (b) Coin-type provenance: verify the declared compositeLegs linkage is coherent.
 * The swap output coin type must match the lend input coin type — no value teleportation.
 * Any mismatch → BLOCK. Missing compositeLegs → BLOCK (fail-closed).
 */
function checkCompositeCoinProvenance(proposal: TradeProposal, recipe: CompositeRecipe): GateResult {
  if (!proposal.compositeLegs || proposal.compositeLegs.length !== recipe.legs.length) {
    return {
      ok: false,
      reason:
        `Composite proposal is missing compositeLegs (expected ${recipe.legs.length} legs). ` +
        "Blocking (fail-closed).",
    };
  }

  for (const linkage of recipe.linkages) {
    const fromLeg = proposal.compositeLegs[linkage.fromLeg];
    const toLeg = proposal.compositeLegs[linkage.toLeg];
    if (!fromLeg || !toLeg) {
      return {
        ok: false,
        reason: `Linkage leg index out of bounds (fromLeg=${linkage.fromLeg}, toLeg=${linkage.toLeg}).`,
      };
    }
    if (!fromLeg.coinTypeOut) {
      return {
        ok: false,
        reason:
          `Composite leg ${linkage.fromLeg} (swap) is missing coinTypeOut — ` +
          "cannot verify coin-type linkage.",
      };
    }
    if (fromLeg.coinTypeOut !== toLeg.coinTypeIn) {
      return {
        ok: false,
        reason:
          `Coin-type linkage mismatch: leg ${linkage.fromLeg} outputs "${fromLeg.coinTypeOut}" ` +
          `but leg ${linkage.toLeg} expects input "${toLeg.coinTypeIn}". ` +
          "The declared composite coin flow is incoherent.",
      };
    }
  }
  return { ok: true, reason: "" };
}

/**
 * A declared send leg extracted from the WYSIWYS-approved proposal.
 * Recipients are resolved 0x addresses captured at proposal time — never re-resolved.
 */
interface SendLeg {
  /** Resolved 0x recipient address (lower-case, normalised). */
  recipient: string;
  /** Canonical coin type being sent. */
  coinType: string;
  /** Amount in native units (MIST for SUI, micro-units for tokens). */
  amountMist: bigint;
}

/**
 * (c) Recipient-aware anti-leak: verify that EVERY third-party inflow in the dry-run
 * is explained by exactly one declared `send` leg (same recipient, same coinType, same
 * amount). The multiset of observed inflows MUST equal the multiset of declared legs —
 * no extra, no missing, no amount drift.
 *
 * Invariant: actual == expected (strict multiset equality, summed per recipient+coinType).
 *
 * Attack coverage:
 * - A2: ATTACKER not in legs → unlisted inflow → BLOCK.
 * - A3: correct recipient but inflated amount → amount mismatch → BLOCK.
 * - A4: leg says Alice, PTB sends to ATTACKER → unknown key → BLOCK.
 * - A5: declared leg + dust skim to ATTACKER → extra actual key → BLOCK.
 * - A6: gas exfil via positive delta to ATTACKER → unlisted inflow → BLOCK.
 * - A7: dropped send leg → expected key missing from actual → BLOCK.
 * - A9: coin-type teleport → (recipient, actual-coinType) ≠ (recipient, declared-coinType) → BLOCK.
 *
 * Backward compatibility: when `declaredSendLegs` is empty (e.g. swap_lend_v1), the
 * rule degrades to the original "no third-party inflow at all" behaviour.
 *
 * De-duplication: a transferred coin appears in BOTH objectChanges (ownerKind=third-party)
 * AND balanceDeltas (positive delta to recipient). To avoid double-counting, we accumulate
 * inflows exclusively from balanceDeltas (which are guaranteed present for every coin
 * transfer) and use the objectChanges walk only as a supplementary check for objects that
 * do NOT appear as balance deltas (non-coin objects sent to a third party → always leak).
 *
 * Gas effects: gas is a sender cost; the SUI gas deduction appears as a negative sender
 * delta, never as a positive third-party delta. The net-SUI cap (gate d) independently
 * bounds SUI exfiltration for the sender side.
 */
function checkCompositeDeltaAntiLeak(
  dryRun: DryRunResult,
  sender: string,
  declaredSendLegs: readonly SendLeg[] = [],
): GateResult {
  const senderNorm = sender.toLowerCase();

  // Walk objectChanges — non-coin objects (e.g. NFTs, shared object mutations) with
  // a third-party owner are ALWAYS a leak regardless of declared send legs, because
  // send legs only account for fungible coin transfers (balanceDeltas path).
  // A transferred coin also appears as a third-party objectChange; we suppress that
  // false-positive only when the accompanying balanceDelta is covered by a declared leg.
  // For simplicity and safety: if any objectChange has ownerKind="third-party" AND there
  // are no declared send legs that would explain it (zero-send-leg path), block immediately.
  // When send legs ARE declared, we defer to the balanceDelta multiset check below,
  // which is the authoritative accounting path (de-dup strategy: balanceDelta wins).
  if (declaredSendLegs.length === 0) {
    // Backward-compatible path: no send legs declared → zero tolerance for third-party owners.
    for (const change of dryRun.objectChanges ?? []) {
      if (change.ownerKind === "third-party") {
        return {
          ok: false,
          reason:
            `Composite dry-run shows an object (${change.objectId}) with a third-party owner ` +
            `— a non-sender address controls an asset after this transaction. ` +
            "Blocking the composite (anti-leak invariant).",
        };
      }
    }

    // Backward-compatible path: no third-party balance inflows allowed.
    for (const delta of dryRun.balanceDeltas) {
      if (delta.amount <= 0n) continue;
      const ownerNorm = (delta.owner ?? "").toLowerCase();
      if (ownerNorm && ownerNorm !== senderNorm) {
        return {
          ok: false,
          reason:
            `Composite dry-run shows a positive balance delta for a non-sender address ` +
            `("${delta.owner}" gained ${delta.amount} of ${delta.coinType}). ` +
            "This is a leak to a third party — blocking the composite.",
        };
      }
    }
    return { ok: true, reason: "" };
  }

  // Recipient-aware path: send legs declared.
  //
  // Build the EXPECTED multiset: sum declared amounts per (recipient, coinType).
  // Keys are normalised lower-case to prevent case-based bypass.
  const expected = new Map<string, bigint>();
  for (const leg of declaredSendLegs) {
    const key = `${leg.recipient.toLowerCase()}::${normalizeCoinType(leg.coinType)}`;
    expected.set(key, (expected.get(key) ?? 0n) + leg.amountMist);
  }

  // Build the ACTUAL multiset: sum positive non-sender balance deltas per (owner, coinType).
  // This is the authoritative inflow source — coin transfers always appear here.
  const actual = new Map<string, bigint>();
  for (const delta of dryRun.balanceDeltas) {
    if (delta.amount <= 0n) continue; // outflow or zero
    const ownerNorm = (delta.owner ?? "").toLowerCase();
    if (!ownerNorm || ownerNorm === senderNorm) continue; // sender residual — allowed
    const key = `${ownerNorm}::${normalizeCoinType(delta.coinType)}`;
    actual.set(key, (actual.get(key) ?? 0n) + delta.amount);
  }

  // Check: every actual inflow key must appear in expected with equal amount.
  // This stops A2 (unlisted recipient), A4 (swapped recipient), A5 (dust skim), A6 (gas exfil).
  for (const [key, amount] of actual) {
    const expectedAmount = expected.get(key);
    if (expectedAmount === undefined) {
      const [owner, coinType] = key.split("::", 2);
      return {
        ok: false,
        reason:
          `Composite dry-run shows an unexpected inflow: "${owner}" received ${amount} of ${coinType}. ` +
          "This recipient+coinType is not in any declared send leg — potential leak. " +
          "Blocking the composite (anti-leak: unlisted inflow).",
      };
    }
    if (amount !== expectedAmount) {
      const [owner, coinType] = key.split("::", 2);
      return {
        ok: false,
        reason:
          `Composite dry-run amount mismatch: "${owner}" received ${amount} of ${coinType}, ` +
          `but the declared leg specifies ${expectedAmount}. ` +
          "Blocking the composite (anti-leak: amount must match declared leg exactly).",
      };
    }
  }

  // Check: every expected inflow key must appear in actual with equal amount.
  // This stops A7 (dropped send leg — declared but no matching dry-run inflow).
  for (const [key, expectedAmount] of expected) {
    const actualAmount = actual.get(key);
    const [owner, coinType] = key.split("::", 2);
    if (actualAmount === undefined) {
      return {
        ok: false,
        reason:
          `Composite dry-run is missing the expected inflow: "${owner}" was supposed to receive ` +
          `${expectedAmount} of ${coinType} per the declared send leg, but received nothing. ` +
          "Blocking the composite (anti-leak: declared send leg not executed).",
      };
    }
    if (actualAmount !== expectedAmount) {
      return {
        ok: false,
        reason:
          `Composite dry-run amount mismatch for declared recipient "${owner}": ` +
          `expected ${expectedAmount} of ${coinType}, observed ${actualAmount}. ` +
          "Blocking the composite (anti-leak: amount must match declared leg exactly).",
      };
    }
  }

  // Coin transfers are authoritatively verified by the balanceDelta multiset above
  // (owner + coinType + amount). objectChanges carry only an ownerKind, NOT an owner
  // address, so they cannot re-confirm WHICH recipient a coin went to — the multiset is
  // the source of truth for coins, and a transferred coin always surfaces as a balanceDelta.
  // Here we only catch a NON-coin third-party object (e.g. an NFT): v1 send legs move coins,
  // so any non-coin object leaving to a third party is unexplained → leak.
  for (const change of dryRun.objectChanges ?? []) {
    if (change.ownerKind !== "third-party") continue;
    if (/::coin::Coin</.test(change.objectType ?? "")) continue; // value-verified by balanceDeltas
    return {
      ok: false,
      reason:
        `Composite dry-run shows a non-coin object (${change.objectId}) transferred to a ` +
        `third-party address — not a declared coin send. Blocking the composite (anti-leak invariant).`,
    };
  }

  return { ok: true, reason: "" };
}

/**
 * (d) Net-SUI delta cap: sum all SUI balance deltas for the sender.
 * If the net SUI outflow (negative sender delta) exceeds the cap → BLOCK.
 *
 * This independently bounds tx.gas-split→TransferObjects SUI exfiltration:
 * even if the USD value is within cap, draining more SUI than declared fails here.
 * Gas cost is excluded (same as computeNetOutflowUsd).
 */
function checkNetSuiDeltaCap(
  dryRun: DryRunResult,
  sender: string,
  capMist: bigint,
): GateResult {
  const senderNorm = sender.toLowerCase();
  let netSuiOut = 0n;

  for (const delta of dryRun.balanceDeltas) {
    if (delta.amount >= 0n) continue; // inflow — not an outflow
    if ((delta.owner ?? "").toLowerCase() !== senderNorm) continue;
    const coinType = normalizeCoinType(delta.coinType);
    if (coinType !== COIN_TYPES.SUI) continue;
    // Exclude gas cost from the SUI outflow (same as computeNetOutflowUsd).
    const rawOut = -delta.amount;
    const out = rawOut > dryRun.gasCostMist ? rawOut - dryRun.gasCostMist : 0n;
    netSuiOut += out;
  }

  if (netSuiOut > capMist) {
    return {
      ok: false,
      reason:
        `Composite net SUI outflow ${netSuiOut} MIST exceeds the SUI cap of ${capMist} MIST. ` +
        "Blocking (net-SUI delta cap — bounds tx.gas exfiltration).",
    };
  }
  return { ok: true, reason: "" };
}

// ---------------------------------------------------------------------------
// Legacy compatibility shim (Phase 1 callers used old GuardianInput shape)
// ---------------------------------------------------------------------------

/** @deprecated Use guardianCheck(TradeProposal, SuiClient) instead. */
export interface GuardianInput {
  txBytes: string;
  actionLabel: string;
  declaredUsdValue: number;
  walletAddress: string;
}

/** @deprecated Use GuardianResult instead. */
export interface GuardianResult_v1 {
  allowed: boolean;
  reason?: string;
  dryRunEffects?: unknown;
}
