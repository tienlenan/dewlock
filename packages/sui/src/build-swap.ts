/**
 * Build a Cetus CLMM swap PTB (unsigned).
 *
 * WHY min-out from a FRESH quote: the PTB builder fetches a live quote;
 * the Guardian then re-fetches independently (hardening point #4). Both must
 * agree within the tolerance band. A stale or tampered quote cannot slip through
 * because the Guardian's re-derivation is independent.
 *
 * WHY dynamic import for Cetus SDK: the SDK fails to load under Next.js/Turbopack
 * server bundling. Dynamic import inside buildLiveCetusPtb() means the module is
 * only resolved when a live swap path is actually executed.
 *
 * WHY we use createSwapTransactionPayload's RETURN value (not ignore it):
 * The Cetus SDK builds and returns its own Transaction internally. It calls
 * getOwnerCoinAssets(senderAddress) to pick the input coins and embeds
 * amount_limit in the Move call. We MUST serialize the returned tx — our outer
 * tx is only used for the fixture (demo) path. Discarding the return (old stub)
 * produced an empty PTB with no swap call.
 *
 * SDK init: initMainnetSDK(rpcUrl, senderAddress) — senderAddress is the second
 * positional arg and sets simulationAccount.address for devInspect (preswap)
 * AND validates the sender in createSwapTransactionPayload. Both throw
 * InvalidSimulateAccount / InvalidSendAddress if the address is zero/unset.
 *
 * SwapParams shape (SDK v5.4.0):
 *   { pool_id, a2b, by_amount_in, amount: string, amount_limit: string,
 *     coinTypeA, coinTypeB, swap_partner? }
 * Note 'amount' and 'amount_limit' are strings, not BN.
 */

import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
// Type-only import — erased at runtime, does NOT trigger SDK module evaluation.
import type CetusClmmSDK from "@cetusprotocol/cetus-sui-clmm-sdk";
import type { SwapParams } from "@cetusprotocol/cetus-sui-clmm-sdk";
import { fetchSwapQuote, type SwapQuote } from "./quotes-source";
import { COIN_TYPES } from "./allowlist";

// Server-side SuiClient type alias.
type SuiClient = SuiJsonRpcClient;

export interface SwapSpec {
  /** Sender's wallet address (required: used for coin selection + simulation). */
  senderAddress: string;
  /** Canonical coin type to sell. */
  coinTypeIn: string;
  /** Canonical coin type to buy. */
  coinTypeOut: string;
  /** Amount of coinTypeIn in native units. */
  amountInNative: bigint;
  /** Slippage tolerance in basis points (e.g. 50 = 0.5%). */
  slippageBps: number;
}

export interface SwapBuildResult {
  /** Serialized unsigned PTB in base64. */
  txBytes: string;
  /** The quote used to build this PTB — Guardian will re-derive independently. */
  quote: SwapQuote;
}

export class SwapBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwapBuildError";
  }
}

/**
 * Build an unsigned Cetus swap PTB.
 * Fetches a fresh quote (with senderAddress for preswap simulation) and
 * embeds the resulting min-out in the PTB via amount_limit.
 * Throws on any SDK/RPC error — callers (Guardian) treat throw as BLOCK.
 * The Cetus SDK is only loaded dynamically when the live path is reached.
 */
export async function buildSwap(
  client: SuiClient,
  spec: SwapSpec,
): Promise<SwapBuildResult> {
  const { senderAddress, coinTypeIn, coinTypeOut, amountInNative, slippageBps } = spec;

  // Validate coin types are known canonical types
  const knownTypes = Object.values(COIN_TYPES) as string[];
  if (!knownTypes.includes(coinTypeIn)) {
    throw new SwapBuildError(`Unknown input coin type: "${coinTypeIn}"`);
  }
  if (!knownTypes.includes(coinTypeOut)) {
    throw new SwapBuildError(`Unknown output coin type: "${coinTypeOut}"`);
  }
  if (coinTypeIn === coinTypeOut) {
    throw new SwapBuildError("Swap input and output coin types must differ.");
  }
  if (amountInNative <= 0n) {
    throw new SwapBuildError("Swap amount must be positive.");
  }
  if (slippageBps < 0 || slippageBps > 5000) {
    throw new SwapBuildError("Slippage must be 0–5000 bps (0–50%).");
  }

  // Fetch fresh quote — senderAddress threaded through for preswap simulation.
  // The quote contains poolId and minAmountOut derived from the live pool state.
  const quote = await fetchSwapQuote(
    coinTypeIn,
    coinTypeOut,
    amountInNative,
    slippageBps,
    senderAddress,
  );

  if (quote.source === "fixture") {
    // Demo/fixture mode: build a placeholder PTB that shows intent but doesn't execute.
    // The fixture badge in the UI prevents user confusion.
    const tx = new Transaction();
    tx.setSender(senderAddress);
    buildFixturePtb(tx, spec, quote);
    const txBytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    const txBytesB64 = Buffer.from(txBytes).toString("base64");
    return { txBytes: txBytesB64, quote };
  }

  // Live path: Cetus SDK builds and returns its own Transaction.
  const txBytesB64 = await buildLiveCetusPtb(client, spec, quote);
  return { txBytes: txBytesB64, quote };
}

// ---------------------------------------------------------------------------
// Live Cetus PTB construction — Cetus SDK loaded lazily here
// ---------------------------------------------------------------------------

async function buildLiveCetusPtb(
  client: SuiClient,
  spec: SwapSpec,
  quote: SwapQuote,
): Promise<string> {
  const { senderAddress, coinTypeIn } = spec;

  // Dynamic import: Cetus SDK is only resolved when this function is actually called.
  // A transfer or BLOCK demo never reaches buildLiveCetusPtb — those paths are
  // completely isolated from the Cetus module and its Class-extends-undefined error.
  let cetusModule: {
    default: typeof CetusClmmSDK;
    initMainnetSDK: (rpcUrl?: string, wallet?: string) => InstanceType<typeof CetusClmmSDK>;
  };
  try {
    cetusModule = await import("@cetusprotocol/cetus-sui-clmm-sdk") as typeof cetusModule;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SwapBuildError(`Failed to load Cetus SDK: ${msg}`);
  }

  const { initMainnetSDK } = cetusModule;
  const rpcUrl = process.env.SUI_RPC_URL ?? "https://fullnode.mainnet.sui.io:443";

  // senderAddress is the second positional arg — sets simulationAccount AND validates
  // the sender. Without it: InvalidSimulateAccount (preswap) and InvalidSendAddress
  // (createSwapTransactionPayload) are both thrown inside the SDK.
  let sdk: InstanceType<typeof CetusClmmSDK>;
  try {
    sdk = initMainnetSDK(rpcUrl, senderAddress);
    // Explicit setter to ensure it propagates to all internal SDK modules
    sdk.senderAddress = senderAddress;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SwapBuildError(`Failed to initialize Cetus SDK: ${msg}`);
  }

  let pool: Awaited<ReturnType<typeof sdk.Pool.getPool>>;
  try {
    pool = await sdk.Pool.getPool(quote.poolId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SwapBuildError(`Failed to fetch pool for swap PTB: ${msg}`);
  }

  const a2b = pool.coinTypeA === coinTypeIn;

  // SwapParams (SDK v5.4.0): all fields required except swap_partner.
  // amount_limit embeds the Guardian-approved min-out on-chain — Cetus Move's
  // pool::swap aborts if output < amount_limit, enforcing slippage protection.
  const swapParams: SwapParams = {
    pool_id: quote.poolId,
    a2b,
    by_amount_in: true,
    amount: quote.amountIn.toString(),
    amount_limit: quote.minAmountOut.toString(),
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
    swap_partner: undefined,
  };

  // createSwapTransactionPayload builds and RETURNS its own Transaction.
  // It calls getOwnerCoinAssets(senderAddress) internally to select coin objects,
  // then embeds all swap calls including amount_limit enforcement.
  // We MUST use this returned transaction — our outer tx has no swap calls.
  let swapTx: Transaction;
  try {
    swapTx = await sdk.Swap.createSwapTransactionPayload(swapParams, undefined);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SwapBuildError(`Cetus swap PTB construction failed: ${msg}`);
  }

  // Serialize the SDK's transaction. SuiJsonRpcClient satisfies ClientWithCoreApi
  // (it exposes .core: CoreClient). The cast carries over from the existing pattern.
  let txBytes: Uint8Array;
  try {
    txBytes = await swapTx.build({ client: client as unknown as ClientWithCoreApi });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SwapBuildError(`Failed to serialize swap PTB: ${msg}`);
  }

  return Buffer.from(txBytes).toString("base64");
}

// ---------------------------------------------------------------------------
// Fixture PTB — placeholder for demo mode
// ---------------------------------------------------------------------------

function buildFixturePtb(
  tx: Transaction,
  spec: SwapSpec,
  quote: SwapQuote,
): void {
  // A fixture PTB contains only the intent metadata; no real Move calls.
  // The UI displays the DEMO FIXTURE badge. This tx will NEVER execute on-chain.
  // We add a split/merge so the bytes are non-trivial for digest testing.
  tx.setSender(spec.senderAddress);
  // splitCoins with zero just to produce a serializable PTB for tests
  const [_coin] = tx.splitCoins(tx.gas, [0n]);
  tx.mergeCoins(tx.gas, [_coin]);
  void quote; // quote data surfaced in SwapBuildResult, not embedded in PTB
}
