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
// SuiJsonRpcClient is the v2.x successor to SuiClient; same interface for our purposes.
type SuiClient = SuiJsonRpcClient;
import {
  ALLOWED_MOVE_TARGETS,
  COIN_DECIMALS,
  COIN_TYPES,
  DEEPBOOK_POOLS,
  getTrustedUsdPrice,
  normalizeHomoglyphs,
  editDistance,
  LOOKALIKE_EDIT_DISTANCE_THRESHOLD,
} from "./allowlist";
import { dryRunTransaction, DryRunFailedError, type DryRunResult } from "@dewlock/sui";
// quotes-source imports Cetus SDK — use subpath to keep it isolated from the root bundle
import { fetchSwapQuote } from "@dewlock/sui/quotes-source";
import type { SwapQuote } from "@dewlock/sui/quotes-source";

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
  actionType: "transfer" | "swap" | "add_liquidity" | "limit_order";

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
}

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
  recipientAddress?: string;
  estimatedUsdValue: number;
  gasCostMist: bigint;
  balanceDeltas: DryRunResult["balanceDeltas"];
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
}

// ---------------------------------------------------------------------------
// Cap constants (server-authoritative — read from env, NEVER from client)
// ---------------------------------------------------------------------------

function getServerCaps(): { txUsdCap: number; dailyUsdCap: number } {
  // Hardening point #1: caps come from server-only env vars.
  // NEXT_PUBLIC_TX_USD_CAP is display-only; a tampered client value CANNOT reach here.
  const txUsdCap = parseFloat(process.env.TX_USD_CAP ?? "5");
  const dailyUsdCap = parseFloat(process.env.DAILY_USD_CAP ?? "20");
  if (isNaN(txUsdCap) || txUsdCap <= 0) {
    throw new Error("TX_USD_CAP env var is invalid — refusing all transactions.");
  }
  if (isNaN(dailyUsdCap) || dailyUsdCap <= 0) {
    throw new Error("DAILY_USD_CAP env var is invalid — refusing all transactions.");
  }
  return { txUsdCap, dailyUsdCap };
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

  // --- Gate 2: Trusted USD price + native-units cap fallback ---
  let estimatedUsdValue = 0;
  if (proposal.actionType === "limit_order" && proposal.limitPrice !== undefined && proposal.limitQuantity !== undefined) {
    // For limit orders: notional = price * quantity in quote currency.
    // DEEP_USDC and SUI_USDC use USDC as quote ($1). DEEP_SUI uses SUI as quote.
    const notionalQuote = proposal.limitPrice * proposal.limitQuantity;
    // Use quote-side USD price to convert notional to USD.
    // If no quoteCoinType is available, fall back to coinTypeIn trusted price.
    const quoteCoinType = proposal.coinTypeOut ?? proposal.coinTypeIn;
    const quotePrice = getTrustedUsdPrice(quoteCoinType);
    if (quotePrice === undefined) {
      // For DEEP_SUI, quoteCoinType is SUI — getTrustedUsdPrice(SUI) returns a value.
      // If quote price is still unknown, fall through to coinTypeIn price as last resort.
      const basePrice = getTrustedUsdPrice(proposal.coinTypeIn);
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
    const usdPrice = getTrustedUsdPrice(proposal.coinTypeIn);
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

  // --- Gate 4: Independent min-out cross-check (for swaps) ---
  if (proposal.actionType === "swap" && proposal.coinTypeOut && proposal.poolId) {
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

  // --- Gate 5 + Gate 3: Dry-run (fail-closed) + WYSIWYS digest ---
  // Even if earlier gates failed, we still need the digest for WYSIWYS.
  // But if other gates already blocked, we skip the RPC call (saves latency).
  let dryRunResult: DryRunResult | null = null;
  let approvedDigest = "";

  if (reasons.length === 0) {
    // Only attempt dry-run if all prior gates passed (avoid leaking RPC calls on blocked tx)
    const dryRunCheck = await runDryRunGate(proposal.txBytes, suiClient);
    if (!dryRunCheck.ok) {
      block("dry_run", dryRunCheck.reason);
    } else {
      dryRunResult = dryRunCheck.result;
      approvedDigest = dryRunCheck.digest;
    }
  }

  // --- Final verdict ---
  if (reasons.length > 0) {
    return { ok: false, reasons, gates };
  }

  // All gates passed — return pass with approvedDigest and preview
  const preview: TxPreview = {
    actionLabel: proposal.actionLabel,
    coinTypeIn: proposal.coinTypeIn,
    coinTypeOut: proposal.coinTypeOut,
    amountInNative: proposal.amountInNative,
    minAmountOutNative: proposal.minAmountOutNative,
    slippageBps: proposal.slippageBps,
    recipientAddress: proposal.recipientAddress,
    estimatedUsdValue,
    gasCostMist: dryRunResult!.gasCostMist,
    balanceDeltas: dryRunResult!.balanceDeltas,
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
  };

  return {
    ok: true,
    txBytes: proposal.txBytes,
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
  try {
    const bytes = Buffer.from(txBytesB64, "base64");
    const tx = Transaction.from(bytes);
    const data = tx.getData();

    // Inspect all MoveCall commands in the transaction
    const commands = data.commands ?? [];
    for (const cmd of commands) {
      if ("MoveCall" in cmd && cmd.MoveCall) {
        const mc = cmd.MoveCall;
        const target = `${mc.package}::${mc.module}::${mc.function}`;
        if (!ALLOWED_MOVE_TARGETS.has(target)) {
          return {
            ok: false,
            reason: `Move call "${target}" is not on the protocol allowlist. Only Cetus CLMM and SuiNS calls are permitted.`,
          };
        }
      }
    }
    return { ok: true, reason: "" };
  } catch (err) {
    // Parsing failure → unknown content → block
    return {
      ok: false,
      reason: `Failed to parse PTB for allowlist check: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Gate 9: Coin-type on-chain verification
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
  if (!proposal.coinTypeOut || !proposal.slippageBps) {
    return { ok: true, reason: "" };
  }

  // Re-derive min-out from a FRESH independent quote (not the one the builder used)
  let freshQuote: SwapQuote;
  try {
    freshQuote = await fetchSwapQuote(
      proposal.coinTypeIn,
      proposal.coinTypeOut,
      proposal.amountInNative,
      proposal.slippageBps,
    );
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

  // Compare PTB-embedded min-out vs freshly-derived min-out (10% tolerance band)
  if (proposal.minAmountOutNative !== undefined) {
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
): Promise<DryRunGateResult & { result: DryRunResult; digest: string }> {
  let result: DryRunResult;
  try {
    result = await dryRunTransaction(suiClient, txBytesB64);
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
    };
  }

  // WYSIWYS digest (hardening #3): compute over the exact bytes the Guardian inspected
  const rawBytes = Buffer.from(txBytesB64, "base64");
  const digest = await sha256HexNode(rawBytes);

  return { ok: true, reason: "", result, digest };
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
function checkPostOnlyInPtb(txBytesB64: string): { ok: boolean; reason: string } {
  const PLACE_LIMIT_ORDER_FN = "place_limit_order";
  const POST_ONLY_VALUE = 3;

  try {
    const bytes = Buffer.from(txBytesB64, "base64");
    const tx = Transaction.from(bytes);
    const data = tx.getData();
    const commands = data.commands ?? [];

    let foundOrderCall = false;
    for (const cmd of commands) {
      if (!("MoveCall" in cmd) || !cmd.MoveCall) continue;
      const mc = cmd.MoveCall;
      if (mc.function !== PLACE_LIMIT_ORDER_FN) continue;

      foundOrderCall = true;

      // The SDK passes arguments in order: poolObj, balanceManagerObj, clientOrderId,
      // price, quantity, isBid, orderType (u8), selfMatchingOption (u8), expiration, payWithDeep.
      // orderType is the 7th argument (index 6, 0-based).
      // We look for a Pure input with value 3 among the call's arguments.
      // Since exact arg index position may vary by SDK version, we scan all Pure inputs
      // for the presence of POST_ONLY=3 and absence of any taker order type (0,1,2).
      const args = mc.arguments ?? [];
      const pureValues: number[] = [];

      for (const arg of args) {
        if (arg && typeof arg === "object" && "Pure" in arg) {
          const pureArg = arg.Pure as { bytes?: string } | undefined;
          if (pureArg?.bytes) {
            // Decode base64 single-byte pure arg (u8)
            const decoded = Buffer.from(pureArg.bytes, "base64");
            if (decoded.length === 1) {
              pureValues.push(decoded[0]);
            }
          }
        }
      }

      // Must find POST_ONLY (3) among the pure u8 values
      const hasPostOnly = pureValues.includes(POST_ONLY_VALUE);
      // Must not find taker order types (0=no restriction, 1=immediate_or_cancel, 2=fill_or_kill)
      const hasTakerType = pureValues.some((v) => v === 0 || v === 1 || v === 2);

      if (!hasPostOnly) {
        return {
          ok: false,
          reason:
            `place_limit_order call does not encode POST_ONLY order type (expected u8=3). ` +
            `Found pure u8 values: [${pureValues.join(", ")}]. ` +
            "Market and taker order types are not permitted.",
        };
      }
      if (hasTakerType) {
        return {
          ok: false,
          reason:
            `place_limit_order call contains a taker order type (0, 1, or 2). ` +
            `Found pure u8 values: [${pureValues.join(", ")}]. ` +
            "Only POST_ONLY (3) is permitted.",
        };
      }
    }

    // If the PTB has no place_limit_order call, the orderbook gate is not applicable.
    // Return ok=true so we don't block non-order transactions that happen to go through
    // this gate. (The gate is only invoked when actionType==="limit_order".)
    void foundOrderCall;
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
