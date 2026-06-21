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
  NAVI_PACKAGE,
  SUILEND_PACKAGE,
  WORMHOLE_WTT_PACKAGE,
  DEEPBOOK_PACKAGE,
  getTrustedUsdPrice,
  normalizeCoinType,
  getProtocolByTarget,
  assertProtocolActive,
  normalizeHomoglyphs,
  editDistance,
  LOOKALIKE_EDIT_DISTANCE_THRESHOLD,
} from "./allowlist";

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
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Lending protocols Dewlock has a built adapter for. */
export const LENDING_PROTOCOLS = ["navi", "suilend"] as const;
export type LendingProtocol = (typeof LENDING_PROTOCOLS)[number];

/** Swap execution source. "cetus" = direct CLMM pool; "aggregator" = Cetus best route; "aftermath" = Aftermath AMM router. */
export const SWAP_SOURCES = ["cetus", "aggregator", "aftermath"] as const;
export type SwapSource = (typeof SWAP_SOURCES)[number];
import { dryRunTransaction, DryRunFailedError, capObjectsForPreview, type DryRunResult } from "@dewlock/sui";
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
    const dryRunCheck = await runDryRunGate(proposal.txBytes, suiClient, proposal.walletAddress);
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
 */
function allowedTargetsForAction(actionType: ActionType): Set<string> {
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
    case "lend_withdraw":
      // Health-REDUCING verbs are gated off (checkLendingConstraints blocks them
      // before build); no targets allowlisted, so any such PTB is also refused.
      return new Set<string>();
    case "bridge_redeem":
      // Only the Sui-side Wormhole Token-Bridge redeem.
      return new Set([`${WORMHOLE_WTT_PACKAGE}::complete_transfer::complete_transfer`]);
    case "transfer":
      // Supported transfers (SUI) use splitCoins+transferObjects — no MoveCall —
      // so the legitimate shape has an empty MoveCall set. Any MoveCall in a
      // transfer PTB is unexpected and refused here. (Non-SUI transfers are not
      // currently a supported build path; were they wired, their target would
      // need an explicit allowlist + shape entry.)
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
  try {
    const bytes = Buffer.from(proposal.txBytes, "base64");
    const tx = Transaction.from(bytes);
    const commands = tx.getData().commands ?? [];
    const allowed = allowedTargetsForAction(proposal.actionType);
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
 *  - borrow/withdraw are health-REDUCING → gated OFF until a guarded follow-up
 *    that simulates the post-tx health factor.
 *  - deposit/repay are health-IMPROVING → permitted, but only to an active+built
 *    lending protocol. The USD value moved is bounded by the dry-run net-outflow
 *    cap (deposit/repay are outflows), and the deposited coin must be priced
 *    (the trusted-price gate blocks unpriced collateral).
 */
export function checkLendingConstraints(proposal: TradeProposal): GateResult {
  const { actionType, lendingProtocol } = proposal;

  if (actionType === "lend_borrow" || actionType === "lend_withdraw") {
    return {
      ok: false,
      reason:
        `Lending action "${actionType}" is guarded and not yet enabled. ` +
        "Borrow/withdraw create or increase debt and require a simulated post-tx " +
        "health-factor check; only deposit and repay are currently permitted.",
    };
  }

  if (!lendingProtocol) {
    return {
      ok: false,
      reason: "Lending action requires a lendingProtocol — none provided. Blocking (fail-closed).",
    };
  }
  const gate = assertProtocolActive(lendingProtocol);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason ?? `Lending protocol "${lendingProtocol}" is not active.` };
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

// Gate 6: Injection provenance
interface ProvenanceResult {
  requiresConfirm: boolean;
  blocked: boolean;
  reason?: string;
}

export function checkProvenance(proposal: TradeProposal): ProvenanceResult {
  const { argProvenance, amountInNative, recipientAddress } = proposal;

  // Derived recipient on a transfer is always a provenance confirm (hardening #6)
  const hasDerivedArg =
    argProvenance.recipient === "derived" ||
    argProvenance.amount === "derived" ||
    argProvenance.coinType === "derived";

  // BLOCK rule: if the recipient was never mentioned in the user turn at all
  // (i.e., came from memory/pool-data injection) AND moves real value → block.
  // The distinction: "derived" with user confirmation is requiresConfirm;
  // a completely untraced recipient with value > 0 is a hard block.
  const untracedRecipientWithValue =
    proposal.actionType === "transfer" &&
    argProvenance.recipient === "derived" &&
    amountInNative > 0n &&
    recipientAddress !== proposal.walletAddress; // sending to self is always safe

  if (untracedRecipientWithValue) {
    return {
      requiresConfirm: false,
      blocked: true,
      reason:
        `Transfer recipient "${recipientAddress}" was not provided in the current user message — ` +
        "it appears to come from memory or injected pool data. " +
        "Blocking: injection provenance gate. Please retype the recipient explicitly.",
    };
  }

  return {
    requiresConfirm: hasDerivedArg,
    blocked: false,
  };
}

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
): Promise<DryRunGateResult & { result: DryRunResult; digest: string; signableBytes: string }> {
  let result: DryRunResult;
  try {
    // senderAddress only labels object-change ownership in the preview; it never
    // affects the gate decision (which is bytes + balance-delta driven).
    result = await dryRunTransaction(suiClient, txBytesB64, senderAddress);
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
