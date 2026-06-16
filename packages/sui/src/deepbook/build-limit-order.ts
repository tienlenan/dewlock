/**
 * deepbook/build-limit-order.ts — Build an unsigned DeepBook POST_ONLY limit-order PTB.
 *
 * WHY POST_ONLY only: POST_ONLY (orderType=3) guarantees the order rests on the book
 * as a maker — it never takes liquidity. This is the only safe order type for an
 * AI copilot: market/taker orders execute immediately at unknown prices.
 *
 * WHY human-readable price/quantity at this boundary: the DeepBook SDK v1.4.1
 * accepts human-readable units and scales internally (FLOAT_SCALAR=1e9, per-coin
 * scalar). The Guardian's USD-cap math converts to native units separately.
 *
 * WHY expiry is REQUIRED: an order without an expiry could rest on the book
 * indefinitely, executing at a stale price the user no longer intends. The
 * Guardian gate enforces this independently; the builder also enforces it to
 * fail at construction time before Guardian even runs.
 *
 * WHY tick/lot alignment is enforced here AND in Guardian: the builder validates
 * first (fast fail at build time), Guardian re-validates independently
 * (same independent-re-derivation principle as min-out Gate 4).
 */

import { Transaction } from "@mysten/sui/transactions";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { SuiClient } from "./client";
import { createDeepBookClient, BALANCE_MANAGER_KEY } from "./client";
import { fetchBookSnapshot, getFixtureBookSnapshot, type BookParams } from "./indexer";
import { COIN_TYPES, DEEPBOOK_POOLS } from "../allowlist";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WhitelistedPoolKey = "DEEP_USDC" | "SUI_USDC" | "DEEP_SUI";

export interface LimitOrderSpec {
  senderAddress: string;
  /** Whitelisted DeepBook pool key. */
  poolKey: WhitelistedPoolKey;
  /** BalanceManager shared object id (0x…64hex). Required for live path. */
  balanceManagerId: string;
  side: "BUY" | "SELL";
  /** Human-readable price in quote currency (SDK scales internally). */
  price: number;
  /** Human-readable quantity in base currency (SDK scales internally). */
  quantity: number;
  /**
   * Expiry timestamp in milliseconds (unix ms). REQUIRED — undefined is not accepted.
   * Use MAX_TIMESTAMP from @mysten/deepbook-v3 for "no expiry" (not recommended for AI).
   */
  expireTimestampMs: number;
}

export interface LimitOrderBuildResult {
  /** Serialized unsigned PTB in base64. */
  txBytes: string;
  bookParams: BookParams;
  midPrice: number;
  /** Canonical base coin type for the pool (e.g. DEEP type for DEEP_USDC). */
  baseCoinType: string;
  /** Canonical quote coin type for the pool (e.g. USDC type for DEEP_USDC). */
  quoteCoinType: string;
  /**
   * Notional value in quote currency (price * quantity).
   * USDC pools: direct USD-equivalent. DEEP_SUI: needs SUI price conversion.
   */
  notionalQuote: number;
  /** Whether this result was built from the fixture path (not live RPC). */
  isFixture: boolean;
}

export class LimitOrderBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitOrderBuildError";
  }
}

// ---------------------------------------------------------------------------
// Pool → coin type mapping (matches DeepBook mainnet pool configuration)
// ---------------------------------------------------------------------------

const POOL_COIN_TYPES: Record<WhitelistedPoolKey, { base: string; quote: string }> = {
  DEEP_USDC: { base: COIN_TYPES.DEEP, quote: COIN_TYPES.USDC },
  SUI_USDC: { base: COIN_TYPES.SUI, quote: COIN_TYPES.USDC },
  DEEP_SUI: { base: COIN_TYPES.DEEP, quote: COIN_TYPES.SUI },
};

// ---------------------------------------------------------------------------
// Tick/lot alignment validation (pure math — no RPC needed)
// ---------------------------------------------------------------------------

/**
 * Validate that price and quantity are aligned to the pool's tick/lot/min-size.
 * Uses modulo with an epsilon to handle floating-point representation issues.
 * Returns a list of validation error messages (empty = valid).
 */
export function validateTickLotAlignment(
  price: number,
  quantity: number,
  bookParams: BookParams,
): string[] {
  const errors: string[] = [];
  const { tickSize, lotSize, minSize } = bookParams;

  // Use integer arithmetic where possible to avoid float modulo imprecision.
  // Scale to the number of decimal places in tick/lot size.
  const tickDecimals = countSignificantDecimals(tickSize);
  const lotDecimals = countSignificantDecimals(lotSize);

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
    errors.push(
      `Quantity ${quantity} is below minimum order size ${minSize}.`,
    );
  }

  return errors;
}

function countSignificantDecimals(n: number): number {
  const s = n.toString();
  const dot = s.indexOf(".");
  if (dot === -1) return 0;
  return s.length - dot - 1;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build an unsigned DeepBook POST_ONLY limit-order PTB.
 *
 * Validates inputs, fetches live book params + mid-price (or fixture),
 * verifies tick/lot alignment, then builds the placeLimitOrder PTB.
 * Throws LimitOrderBuildError on any validation or build failure.
 */
export async function buildLimitOrder(
  suiClient: SuiClient,
  spec: LimitOrderSpec,
): Promise<LimitOrderBuildResult> {
  const { senderAddress, poolKey, balanceManagerId, side, price, quantity, expireTimestampMs } =
    spec;

  // --- Input validation (fast fail before any RPC) ---
  if (!DEEPBOOK_POOLS[poolKey]) {
    throw new LimitOrderBuildError(
      `Pool "${poolKey}" is not on the whitelisted pool list. ` +
        `Allowed pools: ${Object.keys(DEEPBOOK_POOLS).join(", ")}.`,
    );
  }
  if (price <= 0) {
    throw new LimitOrderBuildError("Price must be positive.");
  }
  if (quantity <= 0) {
    throw new LimitOrderBuildError("Quantity must be positive.");
  }
  if (!Number.isFinite(expireTimestampMs) || expireTimestampMs <= 0) {
    throw new LimitOrderBuildError(
      "expireTimestampMs is required and must be a positive integer. " +
        "An order without an expiry could rest at a stale price indefinitely.",
    );
  }
  if (expireTimestampMs <= Date.now()) {
    throw new LimitOrderBuildError(
      `expireTimestampMs ${expireTimestampMs} is in the past. ` +
        "Order expiry must be in the future.",
    );
  }

  const isFixture = process.env.NEXT_PUBLIC_DEMO_MODE === "fixture";
  const coinTypes = POOL_COIN_TYPES[poolKey];

  // --- Fetch book params + mid-price ---
  let bookSnapshot: Awaited<ReturnType<typeof fetchBookSnapshot>>;
  if (isFixture) {
    bookSnapshot = getFixtureBookSnapshot(poolKey);
  } else {
    try {
      bookSnapshot = await fetchBookSnapshot(suiClient, senderAddress, balanceManagerId, poolKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new LimitOrderBuildError(`Failed to fetch book snapshot for ${poolKey}: ${msg}`);
    }
  }

  const { bookParams, midPrice } = bookSnapshot;

  // --- Tick/lot/min-size validation ---
  const alignmentErrors = validateTickLotAlignment(price, quantity, bookParams);
  if (alignmentErrors.length > 0) {
    throw new LimitOrderBuildError(
      `Order parameters fail tick/lot/min-size validation:\n` + alignmentErrors.join("\n"),
    );
  }

  const notionalQuote = price * quantity;

  // --- Fixture path: build placeholder PTB ---
  if (isFixture) {
    const tx = new Transaction();
    tx.setSender(senderAddress);
    // Minimal non-empty PTB for fixture (split+merge gas, no real Move calls)
    const [coin] = tx.splitCoins(tx.gas, [0n]);
    tx.mergeCoins(tx.gas, [coin]);
    const txBytes = await tx.build({ client: suiClient as unknown as ClientWithCoreApi });
    return {
      txBytes: Buffer.from(txBytes).toString("base64"),
      bookParams,
      midPrice,
      baseCoinType: coinTypes.base,
      quoteCoinType: coinTypes.quote,
      notionalQuote,
      isFixture: true,
    };
  }

  // --- Live path: DeepBook SDK builds the PTB ---
  return await buildLiveOrderPtb(suiClient, spec, bookParams, midPrice, coinTypes, notionalQuote);
}

// ---------------------------------------------------------------------------
// Live PTB construction — SDK loaded lazily here
// ---------------------------------------------------------------------------

async function buildLiveOrderPtb(
  suiClient: SuiClient,
  spec: LimitOrderSpec,
  bookParams: BookParams,
  midPrice: number,
  coinTypes: { base: string; quote: string },
  notionalQuote: number,
): Promise<LimitOrderBuildResult> {
  const { senderAddress, poolKey, balanceManagerId, side, price, quantity, expireTimestampMs } =
    spec;

  const { client: dbClient, sdk } = await createDeepBookClient({
    suiClient,
    senderAddress,
    balanceManagerId,
  });

  // Hard gate: only proceed with on-chain whitelisted pools
  let isWhitelisted: boolean;
  try {
    isWhitelisted = await (dbClient as { whitelisted: (key: string) => Promise<boolean> })
      .whitelisted(poolKey);
  } catch (err) {
    throw new LimitOrderBuildError(
      `Failed to verify pool whitelist status for "${poolKey}": ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }
  if (!isWhitelisted) {
    throw new LimitOrderBuildError(
      `Pool "${poolKey}" is not whitelisted on DeepBook (not a 0-fee pool). ` +
        "Only whitelisted pools are permitted.",
    );
  }

  // Pre-validate with SDK's own param checker (belt-and-suspenders after our validation)
  try {
    const valid = await (dbClient as {
      checkLimitOrderParams: (
        poolKey: string,
        price: number,
        qty: number,
        expireTs: number,
      ) => Promise<boolean>;
    }).checkLimitOrderParams(poolKey, price, quantity, expireTimestampMs);
    if (!valid) {
      throw new LimitOrderBuildError(
        `DeepBook SDK checkLimitOrderParams rejected the order parameters ` +
          `(pool=${poolKey}, price=${price}, qty=${quantity}, expire=${expireTimestampMs}).`,
      );
    }
  } catch (err) {
    if (err instanceof LimitOrderBuildError) throw err;
    // checkLimitOrderParams not available on all SDK versions — treat as warning
    console.warn("[build-limit-order] checkLimitOrderParams unavailable:", err);
  }

  // Build the unsigned PTB
  const tx = new Transaction();
  tx.setSender(senderAddress);

  // POST_ONLY = 3, CANCEL_TAKER = 1 (SDK constants)
  const { OrderType, SelfMatchingOptions, MAX_TIMESTAMP } = sdk;
  const postOnly = OrderType?.POST_ONLY ?? 3;
  const cancelTaker = SelfMatchingOptions?.CANCEL_TAKER ?? 1;
  // MAX_TIMESTAMP is the SDK sentinel; we use the caller-supplied expireTimestampMs
  void MAX_TIMESTAMP; // referenced for documentation; expireTimestampMs is always set

  (dbClient as {
    deepBook: {
      placeLimitOrder: (params: {
        poolKey: string;
        balanceManagerKey: string;
        clientOrderId: string;
        price: number;
        quantity: number;
        isBid: boolean;
        orderType: number;
        selfMatchingOption: number;
        expiration: number;
        payWithDeep: boolean;
      }) => (tx: Transaction) => void;
    };
  }).deepBook.placeLimitOrder({
    poolKey,
    balanceManagerKey: BALANCE_MANAGER_KEY,
    clientOrderId: String(Date.now()),
    price,
    quantity,
    isBid: side === "BUY",
    orderType: postOnly,
    selfMatchingOption: cancelTaker,
    expiration: expireTimestampMs,
    payWithDeep: false,
  })(tx);

  let txBytes: Uint8Array;
  try {
    txBytes = await tx.build({ client: suiClient as unknown as ClientWithCoreApi });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new LimitOrderBuildError(`Failed to serialize limit-order PTB: ${msg}`);
  }

  return {
    txBytes: Buffer.from(txBytes).toString("base64"),
    bookParams,
    midPrice,
    baseCoinType: coinTypes.base,
    quoteCoinType: coinTypes.quote,
    notionalQuote,
    isFixture: false,
  };
}
