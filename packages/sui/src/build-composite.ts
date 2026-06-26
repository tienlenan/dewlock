/**
 * build-composite.ts — single-PTB composite builder for declared recipes (v1: swap→lend).
 *
 * WHY single PTB: both legs execute atomically — if NAVI deposit fails, the swap is also
 * reverted. "One signature, all-or-nothing" is the user-facing guarantee.
 *
 * Live mode (swap_lend_v1): uses the Cetus aggregator's routerSwap to add the swap hops to
 * an existing tx and return the swap-output coin as a composable PTB argument. That coin is
 * split to the swap's guaranteed minimum and passed directly to NAVI depositCoinPTB — no
 * wallet coin selection between legs. This is the structural proof that the swap output
 * feeds the lend input. (The Aftermath router's add-trade path aborts multi-path SUI routes
 * mid-resolution; the aggregator is the same engine normal swaps use, so routes compose.)
 *
 * For live mode: the Guardian's checkCompositeRecipe still verifies the composite PTB's
 * MoveCall multiset + delta/owner invariants regardless of how the PTB was built.
 *
 * Atomicity: a Move abort in either leg (e.g. slippage exceeded, NAVI deposit rejected)
 * reverts the entire PTB. Nothing executes on abort.
 *
 * NOTE [needs mainnet verification]: the aggregator routerSwap output-coin shape and the
 * NAVI depositCoinPTB coin-argument signature are verified against the SDKs at build time
 * but depend on upstream versions (@cetusprotocol/aggregator-sdk + sdk-bundles/navi.cjs).
 */

import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { COIN_TYPES } from "./allowlist";
import { pinSuiGasPayment, assertSuiGasCoverage } from "./sui-gas-payment";
import { loadAggregatorSdk, AGGREGATOR_ACTIVE_PROVIDERS } from "./aggregator-quotes";

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

  // Live mode: the Cetus aggregator's routerSwap adds the swap hops to a shared tx and
  // RETURNS the output coin as a composable PTB argument (targetCoin). We wire that coin
  // straight into NAVI depositCoinPTB — one PTB, one signature. This uses the SAME route
  // engine as a normal (non-composite) swap, so multi-path SUI routes compose cleanly
  // (the Aftermath router's add-trade path aborts those mid-resolution).
  // [needs mainnet verification] — Guardian's checkCompositeRecipe re-verifies the full
  // PTB via dry-run before returning approvedDigest to the client.
  return buildLiveSwapLendPtb(client, senderAddress, swapLeg, lendLeg);
}

// ---------------------------------------------------------------------------
// Live composite builder — Cetus aggregator swap → NAVI deposit (one PTB)
// [needs mainnet verification]
// ---------------------------------------------------------------------------

/**
 * Build a live composite PTB: SUI → (Cetus aggregator swap) → USDC →
 * (NAVI depositCoinPTB) in a SINGLE PTB.
 *
 * WHY the Cetus aggregator (not Aftermath): the aggregator's routerSwap returns the
 * swap-output coin as a composable PTB argument and runs the exact route engine used by
 * normal swaps, so multi-path SUI routes assemble cleanly. The Aftermath router's
 * addTransactionForCompleteTradeRoute splits the gas-token SUI input during a deferred
 * resolution step that aborts (MoveAbort 46001) for multi-path routes.
 *
 * Coin flow (the structural linkage the Guardian's delta/owner walk verifies):
 *   inputCoin (split from gas for SUI) → routerSwap → targetCoin (swap output) →
 *   split EXACTLY minAmountOut → NAVI deposit; the dust remainder returns to the sender.
 *
 * WHY deposit minAmountOut (not the whole coin): the proven non-composite NAVI deposit
 * always passes a coin whose value equals the deposit amount. The live swap output is an
 * estimate that varies with slippage, but routerSwap guarantees output >= minAmountOut, so
 * splitting exactly minAmountOut always succeeds and reproduces that invariant. The small
 * remainder above the floor is transferred back to the sender so no coin object dangles.
 *
 * Throws CompositeBuildError on any failure (SDK load, route fetch, build).
 * Callers (Guardian) treat a throw as BLOCK → atomic degrades to step-by-step.
 */
async function buildLiveSwapLendPtb(
  client: SuiClient,
  sender: string,
  swapLeg: CompositeLeg,
  lendLeg: CompositeLeg,
): Promise<CompositeBuildResult> {
  type NaviSdk = typeof import("@naviprotocol/lending");

  // Upfront SUI-coverage gate (the aggregator manages the gas coin, so we assert rather
  // than pin): a balance shortfall is caught here — before the route fetch + build — and
  // surfaces as the same actionable "not enough SUI" error/gate as a normal SUI swap,
  // instead of a raw InsufficientCoinBalance deep in PTB resolution.
  if (swapLeg.coinTypeIn === COIN_TYPES.SUI) {
    await assertSuiGasCoverage(client, sender, swapLeg.amountInNative);
  }

  let aggMod: Awaited<ReturnType<typeof loadAggregatorSdk>>;
  let grpcMod: typeof import("@mysten/sui/grpc");
  let navi: NaviSdk;
  try {
    aggMod = await loadAggregatorSdk();
    grpcMod = await import("@mysten/sui/grpc");
  } catch (err) {
    throw new CompositeBuildError(
      `Failed to load aggregator SDK: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    navi = require("../sdk-bundles/navi.cjs") as NaviSdk;
  } catch (err) {
    throw new CompositeBuildError(
      `Failed to load NAVI SDK: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    // The aggregator selects/builds on-chain via gRPC (separate from the JSON-RPC client).
    const grpcBaseUrl = process.env.SUI_GRPC_URL ?? "https://fullnode.mainnet.sui.io:443";
    const grpc = new grpcMod.SuiGrpcClient({ network: "mainnet", baseUrl: grpcBaseUrl });
    const agg = new aggMod.AggregatorClient({
      endpoint: process.env.CETUS_AGGREGATOR_ENDPOINT ?? "https://api-sui.cetus.zone/router_v3",
      signer: sender,
      client: grpc as never,
      env: aggMod.Env.Mainnet,
    });

    // Leg 0: find the best route for coinTypeIn → coinTypeOut (constrained to allowlisted venues).
    const slippageBps = swapLeg.slippageBps ?? 50;
    const router = await agg.findRouters({
      from: swapLeg.coinTypeIn,
      target: swapLeg.coinTypeOut!,
      amount: swapLeg.amountInNative.toString(),
      byAmountIn: true,
      providers: [...AGGREGATOR_ACTIVE_PROVIDERS],
    });
    if (!router || router.amountOut == null) {
      throw new CompositeBuildError("Aggregator returned no route — cannot build composite swap.");
    }
    const estimatedAmountOut = BigInt(router.amountOut.toString());
    const minAmountOut = (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
    if (minAmountOut <= 0n) {
      throw new CompositeBuildError(
        "Aggregator route produced a zero minimum output — cannot build composite swap.",
      );
    }

    const tx = new Transaction();
    tx.setSender(sender);

    // Pre-split the SUI input from gas so routerSwap consumes OUR coin (composable mode).
    // For a non-SUI input we omit inputCoin and let routerSwap select the wallet coin.
    const inputCoin =
      swapLeg.coinTypeIn === COIN_TYPES.SUI
        ? tx.splitCoins(tx.gas, [swapLeg.amountInNative])[0]
        : undefined;

    // Leg 0 (swap): routerSwap returns the swap-output coin as a PTB argument.
    const targetCoin = (await agg.routerSwap({
      router,
      txb: tx,
      slippage: slippageBps / 10_000,
      ...(inputCoin ? { inputCoin } : {}),
    } as never)) as TransactionObjectArgument;
    if (!targetCoin) {
      throw new CompositeBuildError(
        "Cetus routerSwap returned no output coin — cannot wire swap output into the NAVI deposit leg.",
      );
    }

    // Leg 1 (lend deposit): split exactly the guaranteed floor and deposit it, mirroring the
    // proven NAVI invariant (coin value === deposit amount). NAVI SDK signature:
    // depositCoinPTB(tx, coinType, coin, { account, amount: number (native units) }).
    const [depositCoin] = tx.splitCoins(targetCoin, [minAmountOut]);
    const naviOptions = { account: sender, amount: Number(minAmountOut) } as never;
    await navi.depositCoinPTB(tx, lendLeg.coinTypeIn, depositCoin as never, naviOptions);

    // Return the swap-output remainder (dust above the floor) to the sender so no coin
    // object dangles. The transfer targets the SENDER → passes the Guardian anti-leak walk.
    tx.transferObjects([targetCoin], sender);

    // Build via the aggregator's own builder (resolves gas with its gRPC client), matching
    // the proven normal-swap path. Adding the NAVI deposit + transfer only raises the gas
    // budget; it does not change how the swap's gas/input coins are selected.
    const bytes = await agg.buildTransactionBytes(tx);
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: false };
  } catch (err) {
    if (err instanceof CompositeBuildError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    // A coin/gas shortfall is a user balance problem, NOT a route/compose limitation — give
    // a clear, actionable message so it isn't misread as "atomic unavailable for this route"
    // (which wrongly implies step-by-step would succeed; it would hit the same shortfall).
    if (/insufficientcoinbalance|insufficient coin balance|insufficient.*balance/i.test(msg)) {
      throw new CompositeBuildError(
        "Insufficient SUI: this swap plus network gas is more than your SUI balance. " +
          "Reduce the swap amount (leave a little SUI for gas) or top up, then try again.",
      );
    }
    throw new CompositeBuildError(`Composite live PTB construction failed: ${msg}`);
  }
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
 */
function _buildLendLegFixture(
  tx: Transaction,
  _leg: CompositeLeg,
  inputCoin: TransactionObjectArgument,
  _senderAddress: string,
): void {
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
