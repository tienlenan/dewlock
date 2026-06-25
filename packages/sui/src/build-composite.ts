/**
 * build-composite.ts — single-PTB composite builder for declared recipes (v1: swap→lend).
 *
 * WHY single PTB: both legs execute atomically — if NAVI deposit fails, the swap is also
 * reverted. "One signature, all-or-nothing" is the user-facing guarantee.
 *
 * WHY fixture-mode only in v1: the live aggregator SDK (fastRouterSwap) internally manages
 * its own coin flow and does not expose a stable "here is the output coin PTBResult" hook.
 * Refactoring that hook requires SDK cooperation beyond the scope of v1. The fixture path
 * demonstrates the PTB structure (swap leg output coin → lend leg input) and is what the
 * Guardian's dry-run, multiset, and delta/owner checks run against in tests.
 *
 * For live mode: the Guardian's checkCompositeRecipe still verifies the composite PTB's
 * MoveCall multiset + delta/owner invariants regardless of how the PTB was built.
 *
 * Atomicity: a Move abort in either leg (e.g. slippage exceeded, NAVI deposit rejected)
 * reverts the entire PTB. Nothing executes on abort.
 */

import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { COIN_TYPES } from "./allowlist";
import { pinSuiGasPayment } from "./sui-gas-payment";

type SuiClient = SuiJsonRpcClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Spec for one leg of a composite transaction. */
export interface CompositeLeg {
  actionType: "swap" | "lend_deposit";
  coinTypeIn: string;
  coinTypeOut?: string; // populated for swap legs
  amountInNative: bigint;
  /** Lending protocol (for lend_deposit legs). */
  lendingProtocol?: "navi" | "suilend";
  /** Slippage in bps (for swap legs). */
  slippageBps?: number;
}

/** Input to the composite builder. */
export interface CompositeSpec {
  senderAddress: string;
  /** Declared recipe id — must be in the closed registry. */
  recipeId: string;
  legs: [CompositeLeg, CompositeLeg, ...CompositeLeg[]];
}

/** Result from building a composite PTB. */
export interface CompositeBuildResult {
  /** Base64 serialized unsigned PTB. */
  txBytes: string;
  /** True when built in fixture/demo mode (no real Move calls). */
  isFixture: boolean;
}

export class CompositeBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompositeBuildError";
  }
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

/**
 * Build a single-PTB composite transaction for the declared recipe.
 *
 * v1 supports ONLY the "swap_lend_v1" recipe (swap → NAVI deposit). Any other
 * recipe id → CompositeBuildError (fail-closed: never ad-hoc compose).
 *
 * In fixture mode: builds a structurally valid PTB with placeholder swap output
 * wired into a placeholder lend call. The Guardian verifies the real PTB bytes
 * (delta/owner walk + multiset); fixture bytes satisfy the structural assertions
 * in tests without a live chain connection.
 *
 * Throws CompositeBuildError on any error — callers (Guardian) treat a throw as BLOCK.
 */
export async function buildComposite(
  client: SuiClient,
  spec: CompositeSpec,
): Promise<CompositeBuildResult> {
  const { senderAddress, recipeId, legs } = spec;

  // Only the declared recipe set is buildable — no ad-hoc composition.
  if (recipeId !== "swap_lend_v1") {
    throw new CompositeBuildError(
      `Composite recipe "${recipeId}" is not in the declared recipe set — refusing to compose. ` +
        "Only pre-declared recipes may be built as composites.",
    );
  }
  if (legs.length !== 2) {
    throw new CompositeBuildError(
      `Recipe "swap_lend_v1" requires exactly 2 legs, got ${legs.length}.`,
    );
  }
  const [swapLeg, lendLeg] = legs;
  if (swapLeg.actionType !== "swap") {
    throw new CompositeBuildError(
      `Recipe "swap_lend_v1" leg 0 must be "swap", got "${swapLeg.actionType}".`,
    );
  }
  if (lendLeg.actionType !== "lend_deposit") {
    throw new CompositeBuildError(
      `Recipe "swap_lend_v1" leg 1 must be "lend_deposit", got "${lendLeg.actionType}".`,
    );
  }
  if (!swapLeg.coinTypeOut) {
    throw new CompositeBuildError('Recipe "swap_lend_v1" swap leg requires coinTypeOut.');
  }
  // Coin-type linkage invariant: the swap output must match the lend input.
  // This is the structural proof that leg-1's output coin feeds leg-2's input.
  if (swapLeg.coinTypeOut !== lendLeg.coinTypeIn) {
    throw new CompositeBuildError(
      `Linkage violation: swap output coin "${swapLeg.coinTypeOut}" does not match ` +
        `lend input coin "${lendLeg.coinTypeIn}". The composite coin flow is broken.`,
    );
  }
  if (lendLeg.lendingProtocol !== "navi") {
    throw new CompositeBuildError(
      `Recipe "swap_lend_v1" lend leg only supports "navi" in v1, got "${lendLeg.lendingProtocol ?? "(none)"}".`,
    );
  }

  // Fixture mode: both paths build structurally, but with placeholder Move calls.
  // The Guardian's delta/owner walk runs on whatever PTB bytes come back, so the
  // test harness controls the dry-run mock independently of what we build here.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "fixture") {
    return buildFixtureComposite(client, senderAddress, swapLeg, lendLeg);
  }

  // Live mode: fail-closed — the live aggregator SDK does not expose a stable
  // "output coin PTBResult" hook for chaining. Until that API is available,
  // reject live composite builds rather than produce an unsafe PTB.
  throw new CompositeBuildError(
    "Composite live-mode build is not yet supported (requires aggregator SDK output-coin hook). " +
      "Use fixture mode or sequential Track A for this intent.",
  );
}

// ---------------------------------------------------------------------------
// Fixture composite builder — swap output coin → lend input (structural demo)
// ---------------------------------------------------------------------------

/**
 * Build a fixture composite PTB demonstrating the swap→lend coin linkage.
 *
 * Leg 0 (swap): split a coin from gas (placeholder for swap output).
 * Leg 1 (lend): pass the PTBResult coin from leg 0 directly — no wallet
 *   coin selection, no intermediate transfer. This is the structural invariant
 *   the Guardian's multiset and delta/owner checks verify.
 *
 * The placeholder Move calls use the canonical NAVI entry_deposit target so the
 * action-shape multiset check can be exercised in tests. No live chain needed.
 */
async function buildFixtureComposite(
  client: SuiClient,
  senderAddress: string,
  swapLeg: CompositeLeg,
  lendLeg: CompositeLeg,
): Promise<CompositeBuildResult> {
  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);

    // Leg 0 (swap placeholder): split the swap amount from gas coin.
    // In the real aggregator flow, fastRouterSwap selects coins and returns an
    // output PTBResult. Here we use a split as a structural stand-in so the
    // coin type flow is demonstrable: [split from gas] → swap → [PTBResult coin].
    const swapOutputCoin = _buildSwapLegFixture(tx, swapLeg);

    // Leg 1 (lend deposit): consume the PTBResult from leg 0 directly.
    // This is the linkage invariant: no wallet coin selection between legs.
    _buildLendLegFixture(tx, lendLeg, swapOutputCoin, senderAddress);

    // Pin gas to cover SUI outflow + gas (swap leg uses tx.gas for SUI input).
    const isSuiIn = swapLeg.coinTypeIn === COIN_TYPES.SUI;
    if (isSuiIn) {
      await pinSuiGasPayment(client, tx, senderAddress, swapLeg.amountInNative);
    }

    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: true };
  } catch (err) {
    if (err instanceof CompositeBuildError) throw err;
    throw new CompositeBuildError(
      `Composite fixture PTB construction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Add the swap leg placeholder to the shared transaction.
 * Returns the PTBResult coin that will feed the lend leg.
 *
 * IMPORTANT: the returned coin is a PTBResult (not a wallet object) — the lend
 * leg must consume it directly. Never transfer it back to the wallet between legs.
 */
function _buildSwapLegFixture(tx: Transaction, leg: CompositeLeg): TransactionObjectArgument {
  // Stand-in for the aggregator's fastRouterSwap output: split the input amount
  // from the gas coin (SUI path). For non-SUI input, the real path would merge+split
  // owned coins — in fixture mode, we use gas-split as a universal stand-in.
  // The Guardian's delta/owner walk on the mocked dry-run result is what validates
  // the real invariants; the fixture bytes only need to parse cleanly.
  //
  // tx.splitCoins() returns TransactionResult (union), and destructuring narrows to
  // NestedResult — cast to TransactionObjectArgument (the correct PTB argument type
  // for object/coin arguments, accepted by tx.moveCall arguments array).
  const [swapOutput] = tx.splitCoins(tx.gas, [leg.amountInNative]);
  return swapOutput as TransactionObjectArgument;
}

/**
 * Add the lend deposit leg to the shared transaction, consuming the coin from the swap leg.
 *
 * The coin parameter is the PTBResult from the swap leg — never a wallet-selected coin.
 * This enforces the linkage invariant: no intermediate wallet settle between legs.
 *
 * Placeholder: uses a moveCall with the NAVI entry_deposit target so the Guardian's
 * multiset check can verify the lend leg is present. The real NAVI SDK call would
 * pass the coin as the first positional argument; the placeholder mirrors that shape.
 *
 * The NAVI package is imported via the allowlist constants so the target string is
 * stable and consistent with allowedTargetsForAction("lend_deposit").
 */
function _buildLendLegFixture(
  tx: Transaction,
  _leg: CompositeLeg,
  inputCoin: TransactionObjectArgument,
  _senderAddress: string,
): void {
  // Import is done inline to avoid a circular dep with the agent package's allowlist.
  // The NAVI package id is authoritative from protocol-constants.ts (via the allowlist export).
  const NAVI_PKG = "0x1e4a13a0494d5facdbe8473e74127b838c2d446ecec0ce262e2eddafa77259cb";
  // Placeholder MoveCall: entry_deposit(coin, ...). The real call passes additional
  // NAVI pool + config objects; the fixture call uses the coin arg only, which is
  // sufficient for the Guardian's MoveCall multiset check and parse.
  tx.moveCall({
    target: `${NAVI_PKG}::incentive_v3::entry_deposit`,
    // Pass the swap-output PTBResult coin as the first argument — this is the
    // structural proof that leg-0's output feeds leg-1's input (no wallet settle).
    arguments: [inputCoin],
  });
}
