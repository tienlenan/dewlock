/**
 * build-composite.ts — single-PTB composite builder for declared recipes and dynamic leg sequences.
 *
 * WHY single PTB: all legs execute atomically — if any leg fails, the entire PTB is reverted.
 * "One signature, all-or-nothing" is the user-facing guarantee.
 *
 * Live mode (swap_lend_v1): uses the Cetus aggregator's routerSwap to add the swap hops to
 * an existing tx and return the swap-output coin as a composable PTB argument. That coin is
 * split to the swap's guaranteed minimum and passed directly to NAVI depositCoinPTB — no
 * wallet coin selection between legs. This is the structural proof that the swap output
 * feeds the lend input. (The Aftermath router's add-trade path aborts multi-path SUI routes
 * mid-resolution; the aggregator is the same engine normal swaps use, so routes compose.)
 *
 * Dynamic composite (buildDynamicComposite): builds ONE PTB from N ordered legs of types
 * send/swap/lend_deposit/stake. Chaining: a leg whose amountFrom === "prev-output" consumes
 * the prior leg's PTBResult coin instead of pulling a fresh coin from the wallet.
 *
 * For live mode: the Guardian's checkCompositeRecipe still verifies the composite PTB's
 * MoveCall multiset + delta/owner anti-leak invariants regardless of how the PTB was built.
 *
 * Atomicity: a Move abort in any leg reverts the entire PTB. Nothing executes on abort.
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
import { HAEDAL_PACKAGE, HAEDAL_STAKING_OBJECT } from "./protocol-constants";

type SuiClient = SuiJsonRpcClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Spec for one leg of a composite transaction (swap_lend_v1 recipe). */
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
  /** Estimated swap-leg output (native units of the swap's coinTypeOut), for the flow preview. */
  swapEstimatedOutNative?: string;
  /** Guaranteed-minimum swap-leg output (native units), the slippage floor. */
  swapMinOutNative?: string;
}

// ---------------------------------------------------------------------------
// Dynamic composite types (Phase 3 — generalized N-leg builder)
// ---------------------------------------------------------------------------

/** One leg in a dynamic composite. Covers send/swap/lend_deposit/stake. */
export interface DynamicCompositeLeg {
  actionType: "send" | "swap" | "lend_deposit" | "stake";
  /** Input coin type for this leg. */
  coinTypeIn: string;
  /** Output coin type (required for swap legs). */
  coinTypeOut?: string;
  /** Amount in native units. Ignored when amountFrom === "prev-output". */
  amountInNative: bigint;
  /**
   * "prev-output": consume the prior leg's PTBResult coin as this leg's input.
   * "explicit":    pull amountInNative of coinTypeIn from the wallet.
   * Omitting defaults to "explicit".
   */
  amountFrom?: "explicit" | "prev-output";
  /** Resolved 0x recipient address (required for send legs). */
  recipient?: string;
  /** Slippage in bps (for swap legs, default 50). */
  slippageBps?: number;
  /** Lending protocol (for lend_deposit legs, default "navi"). */
  lendingProtocol?: "navi" | "suilend";
  /** LST provider (for stake legs, default "afsui"). */
  lstProvider?: "afsui" | "hasui";
}

/**
 * Per-leg output from buildDynamicComposite.
 * Carried in the compositeLegs array that the Guardian reads for the anti-leak gate.
 */
export interface DynamicCompositeLegResult {
  actionType: "send" | "swap" | "lend_deposit" | "stake";
  coinTypeIn: string;
  amountInNative: bigint;
  /** Set for send legs: the resolved 0x recipient (Guardian anti-leak reads this). */
  recipient?: string;
}

/** Result from buildDynamicComposite. */
export interface DynamicCompositeBuildResult {
  /** Base64 serialized unsigned PTB. */
  txBytes: string;
  /** True when built in fixture/demo mode. */
  isFixture: boolean;
  /**
   * Per-leg summary — ordered by leg index.
   * The caller sets proposal.compositeLegs from this for the Guardian's anti-leak gate.
   */
  compositeLegs: DynamicCompositeLegResult[];
  /** Estimated swap-leg outputs (native units), keyed by leg index. Display-only. */
  swapEstimatedOutByLeg?: Map<number, string>;
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
    return {
      txBytes: Buffer.from(bytes).toString("base64"),
      isFixture: false,
      swapEstimatedOutNative: estimatedAmountOut.toString(),
      swapMinOutNative: minAmountOut.toString(),
    };
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

// ---------------------------------------------------------------------------
// Dynamic composite builder (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Build a single PTB from an ordered list of N legs (send/swap/lend_deposit/stake).
 *
 * CHAINING: if a leg's amountFrom === "prev-output", it consumes the previous leg's
 * PTBResult coin directly (no wallet coin selection between legs). Independent legs
 * (amountFrom === "explicit" or omitted) pull their coin from the wallet balance.
 *
 * SUI-input legs (coinTypeIn === COIN_TYPES.SUI) split from tx.gas — SUI is always
 * the gas coin on Sui. Non-SUI independent legs merge+split from owned coin objects.
 *
 * Returns the same base64 txBytes shape as buildComposite, plus compositeLegs that
 * the caller MUST forward into proposal.compositeLegs for the Guardian's anti-leak gate.
 *
 * Throws CompositeBuildError on any error — callers (Guardian) treat a throw as BLOCK.
 * Max 8 legs (DoS/UX bound, matches buildDynamicRecipe).
 *
 * [needs mainnet verification]: live swap/lend/stake SDKs are loaded at runtime; the
 * fixture path covers the PTB structure. The Guardian re-verifies via dry-run.
 */
export async function buildDynamicComposite(
  client: SuiClient,
  senderAddress: string,
  legs: DynamicCompositeLeg[],
): Promise<DynamicCompositeBuildResult> {
  if (legs.length === 0 || legs.length > 8) {
    throw new CompositeBuildError(
      `Dynamic composite must have 1–8 legs; got ${legs.length}.`,
    );
  }

  // Validate send legs have a recipient
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.actionType === "send" && !leg.recipient) {
      throw new CompositeBuildError(
        `Send leg at index ${i} requires a resolved recipient (0x address).`,
      );
    }
    if (leg.actionType !== "send" && leg.amountInNative <= 0n) {
      throw new CompositeBuildError(
        `Leg ${i} (${leg.actionType}) has non-positive amountInNative.`,
      );
    }
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === "fixture") {
    return buildFixtureDynamicComposite(client, senderAddress, legs);
  }
  return buildLiveDynamicComposite(client, senderAddress, legs);
}

/**
 * Select a non-SUI coin from the wallet (merge if fragmented, split exact amount).
 * Used by independent non-SUI legs.
 */
async function selectNonSuiCoin(
  client: SuiClient,
  tx: Transaction,
  owner: string,
  coinType: string,
  amount: bigint,
): Promise<TransactionObjectArgument> {
  const coins = await client.getCoins({ owner, coinType });
  if (!coins.data || coins.data.length === 0) {
    throw new CompositeBuildError(
      `No coins of type ${coinType} found in wallet for composite leg.`,
    );
  }
  const [primary, ...rest] = coins.data.map((c) => c.coinObjectId);
  if (rest.length > 0) {
    tx.mergeCoins(tx.object(primary), rest.map((id) => tx.object(id)));
  }
  const [split] = tx.splitCoins(tx.object(primary), [amount]);
  return split as TransactionObjectArgument;
}

/**
 * Split EXACTLY `exactAmount` from a chained upstream coin and return that coin; the remainder
 * (dust = realized − exact) is transferred back to `sender` so nothing dangles. Shared by the
 * chained lend-deposit and the chained pay (swap→send-exact) paths.
 *
 * The caller MUST ensure `exactAmount` ≤ the upstream's guaranteed minimum (swap minOut /
 * withdrawn principal); otherwise the on-chain split aborts. Dust ALWAYS returns to the sender —
 * never to a third party (the upstream coin is the user's own).
 */
function splitExactFromChained(
  tx: Transaction,
  coin: TransactionObjectArgument,
  exactAmount: bigint,
  sender: string,
): TransactionObjectArgument {
  const [exact] = tx.splitCoins(coin, [exactAmount]);
  tx.transferObjects([coin], sender);
  return exact as TransactionObjectArgument;
}

/**
 * Live dynamic composite builder.
 * Iterates legs in order, tracking the "current output coin" for chaining.
 */
async function buildLiveDynamicComposite(
  client: SuiClient,
  senderAddress: string,
  legs: DynamicCompositeLeg[],
): Promise<DynamicCompositeBuildResult> {
  type NaviSdk = typeof import("@naviprotocol/lending");

  // Pre-check SUI coverage for any leg that consumes SUI from the gas coin
  // (independent SUI-in legs). Chained legs that originate from a prior swap
  // may produce non-SUI, so we skip coverage check for those.
  for (const leg of legs) {
    const isIndependent = !leg.amountFrom || leg.amountFrom === "explicit";
    if (isIndependent && leg.coinTypeIn === COIN_TYPES.SUI && leg.actionType !== "send") {
      await assertSuiGasCoverage(client, senderAddress, leg.amountInNative);
    }
  }

  let aggMod: Awaited<ReturnType<typeof loadAggregatorSdk>> | undefined;
  let grpcMod: typeof import("@mysten/sui/grpc") | undefined;
  let navi: NaviSdk | undefined;

  // Load swap SDK only if any leg needs it
  const needsSwap = legs.some((l) => l.actionType === "swap");
  if (needsSwap) {
    try {
      aggMod = await loadAggregatorSdk();
      grpcMod = await import("@mysten/sui/grpc");
    } catch (err) {
      throw new CompositeBuildError(
        `Failed to load aggregator SDK: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Load NAVI SDK only if any leg needs it
  const needsLend = legs.some((l) => l.actionType === "lend_deposit");
  if (needsLend) {
    try {
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      navi = require("../sdk-bundles/navi.cjs") as NaviSdk;
    } catch (err) {
      throw new CompositeBuildError(
        `Failed to load NAVI SDK: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);

    // Track the most recent leg's output coin so chained legs can consume it.
    let prevOutputCoin: TransactionObjectArgument | undefined;
    // For aggregator swaps we need a shared gRPC+agg setup
    let agg: InstanceType<Awaited<ReturnType<typeof loadAggregatorSdk>>["AggregatorClient"]> | undefined;
    if (aggMod && grpcMod) {
      const grpcBaseUrl = process.env.SUI_GRPC_URL ?? "https://fullnode.mainnet.sui.io:443";
      const grpc = new grpcMod.SuiGrpcClient({ network: "mainnet", baseUrl: grpcBaseUrl });
      agg = new aggMod.AggregatorClient({
        endpoint: process.env.CETUS_AGGREGATOR_ENDPOINT ?? "https://api-sui.cetus.zone/router_v3",
        signer: senderAddress,
        client: grpc as never,
        env: aggMod.Env.Mainnet,
      });
    }

    const swapEstimatedOutByLeg = new Map<number, string>();
    // Each swap leg's guaranteed minimum output (estimate × (1 − slippage)). A chained lend leg
    // splits exactly this from the prior swap's output coin — guaranteed to succeed on-chain.
    const swapMinOutByLeg = new Map<number, bigint>();
    const compositeLegs: DynamicCompositeLegResult[] = [];

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const isChained = leg.amountFrom === "prev-output";

      // A leg that does NOT consume the prior leg's output (independent leg) must return that
      // unconsumed output to the sender first — otherwise it dangles in the PTB (Sui
      // "UnusedValueWithoutDrop"). The output is the user's own coin, so the sender is correct.
      if (!isChained && prevOutputCoin !== undefined) {
        tx.transferObjects([prevOutputCoin], senderAddress);
        prevOutputCoin = undefined;
      }

      if (leg.actionType === "send") {
        // Send leg: deliver EXACTLY `amountInNative` of `coinTypeIn` to `recipient`.
        const recipient = leg.recipient!;
        let coinToSend: TransactionObjectArgument;

        if (isChained && prevOutputCoin) {
          // Pay-in-any-coin: split EXACTLY the declared amount from the chained upstream output
          // (e.g. a swap result) and send that; dust returns to the sender. The recipient must
          // receive exactly `amountInNative` (the Guardian anti-leak verifies this), so we never
          // forward the whole variable output. Guard: the exact amount must not exceed the prior
          // swap's guaranteed minimum, else the split aborts on-chain.
          if (leg.amountInNative <= 0n) {
            throw new CompositeBuildError(
              `Chained send leg ${i} requires a positive amountInNative (the exact pay amount).`,
            );
          }
          const priorMinOut = swapMinOutByLeg.get(i - 1);
          if (priorMinOut !== undefined && leg.amountInNative > priorMinOut) {
            throw new CompositeBuildError(
              `Chained send leg ${i} pays ${leg.amountInNative} but the prior swap only guarantees ` +
                `${priorMinOut} out — increase the swap input so the exact amount is covered.`,
            );
          }
          coinToSend = splitExactFromChained(tx, prevOutputCoin, leg.amountInNative, senderAddress);
          prevOutputCoin = undefined;
        } else {
          // Pull from wallet — SUI splits from gas, non-SUI from owned objects.
          if (leg.coinTypeIn === COIN_TYPES.SUI) {
            [coinToSend] = tx.splitCoins(tx.gas, [leg.amountInNative]);
          } else {
            coinToSend = await selectNonSuiCoin(client, tx, senderAddress, leg.coinTypeIn, leg.amountInNative);
          }
        }

        tx.transferObjects([coinToSend], recipient);
        compositeLegs.push({
          actionType: "send",
          coinTypeIn: leg.coinTypeIn,
          amountInNative: leg.amountInNative,
          recipient,
        });
        prevOutputCoin = undefined;

      } else if (leg.actionType === "swap") {
        // Swap leg: Cetus aggregator routerSwap → output coin (PTBResult).
        if (!agg || !aggMod) {
          throw new CompositeBuildError("Aggregator not initialized for swap leg.");
        }
        if (!leg.coinTypeOut) {
          throw new CompositeBuildError(`Swap leg at index ${i} requires coinTypeOut.`);
        }

        let inputCoin: TransactionObjectArgument | undefined;
        if (isChained && prevOutputCoin) {
          inputCoin = prevOutputCoin;
          prevOutputCoin = undefined;
        } else if (leg.coinTypeIn === COIN_TYPES.SUI) {
          // SUI: split from gas coin (composable mode)
          inputCoin = tx.splitCoins(tx.gas, [leg.amountInNative])[0] as TransactionObjectArgument;
        }
        // Non-SUI, non-chained: omit inputCoin — routerSwap selects wallet coins

        const slippageBps = leg.slippageBps ?? 50;
        const router = await agg.findRouters({
          from: leg.coinTypeIn,
          target: leg.coinTypeOut,
          amount: (isChained ? 0n : leg.amountInNative).toString(),
          byAmountIn: true,
          providers: [...AGGREGATOR_ACTIVE_PROVIDERS],
        });
        if (!router || router.amountOut == null) {
          throw new CompositeBuildError(`Aggregator returned no route for swap leg ${i}.`);
        }
        const estimatedOut = BigInt(router.amountOut.toString());
        const minOut = (estimatedOut * BigInt(10_000 - slippageBps)) / 10_000n;
        if (minOut <= 0n) {
          throw new CompositeBuildError(`Swap leg ${i} produced zero minimum output.`);
        }
        swapEstimatedOutByLeg.set(i, estimatedOut.toString());
        swapMinOutByLeg.set(i, minOut);

        const swapResult = (await agg.routerSwap({
          router,
          txb: tx,
          slippage: slippageBps / 10_000,
          ...(inputCoin ? { inputCoin } : {}),
        } as never)) as TransactionObjectArgument;
        if (!swapResult) {
          throw new CompositeBuildError(`Cetus routerSwap returned no output coin for leg ${i}.`);
        }

        // The output coin is the full swap output; downstream leg may split it.
        prevOutputCoin = swapResult;
        compositeLegs.push({
          actionType: "swap",
          coinTypeIn: leg.coinTypeIn,
          amountInNative: leg.amountInNative,
        });

      } else if (leg.actionType === "lend_deposit") {
        // NAVI deposit: consume inputCoin (chained or wallet-selected).
        if (!navi) {
          throw new CompositeBuildError("NAVI SDK not initialized for lend_deposit leg.");
        }

        let inputCoin: TransactionObjectArgument;
        let depositAmount: bigint;

        if (isChained && prevOutputCoin) {
          // Split the prior swap leg's GUARANTEED minimum output (same invariant as
          // buildLiveSwapLendPtb): routerSwap guarantees the realized output >= minOut, so splitting
          // exactly minOut always succeeds. Splitting a FIXED pre-quote leg.amountInNative could
          // exceed the realized swap output and abort the whole PTB on-chain. A chained leg consumes
          // the immediately-prior leg's output, so the producing swap is leg i-1.
          inputCoin = prevOutputCoin;
          prevOutputCoin = undefined;
          const priorMinOut = swapMinOutByLeg.get(i - 1);
          depositAmount =
            priorMinOut && priorMinOut > 0n
              ? priorMinOut
              : leg.amountInNative > 0n
                ? leg.amountInNative
                : 1n;
          // Split exactly the guaranteed minOut; dust (realized − minOut) returns to sender.
          const depositCoin = splitExactFromChained(tx, inputCoin, depositAmount, senderAddress);
          const naviOptions = { account: senderAddress, amount: Number(depositAmount) } as never;
          await navi.depositCoinPTB(tx, leg.coinTypeIn, depositCoin as never, naviOptions);
        } else {
          if (leg.coinTypeIn === COIN_TYPES.SUI) {
            inputCoin = tx.splitCoins(tx.gas, [leg.amountInNative])[0] as TransactionObjectArgument;
          } else {
            inputCoin = await selectNonSuiCoin(client, tx, senderAddress, leg.coinTypeIn, leg.amountInNative);
          }
          depositAmount = leg.amountInNative;
          const naviOptions = { account: senderAddress, amount: Number(depositAmount) } as never;
          await navi.depositCoinPTB(tx, leg.coinTypeIn, inputCoin as never, naviOptions);
        }

        compositeLegs.push({
          actionType: "lend_deposit",
          coinTypeIn: leg.coinTypeIn,
          amountInNative: leg.amountInNative,
        });
        prevOutputCoin = undefined;

      } else if (leg.actionType === "stake") {
        // Stake leg: Haedal haSUI direct-PTB or Aftermath afSUI SDK.
        // The chained path is not meaningful for stake (stake is terminal — haSUI is minted
        // into the sender's wallet, no output coin is wired into the next leg).
        const lstProvider = leg.lstProvider ?? "afsui";

        if (lstProvider === "hasui") {
          // Haedal: interface::request_stake(SuiSystemState, Staking, Coin<SUI>, address)
          let suiCoin: TransactionObjectArgument;
          if (isChained && prevOutputCoin) {
            suiCoin = prevOutputCoin;
            prevOutputCoin = undefined;
          } else {
            [suiCoin] = tx.splitCoins(tx.gas, [leg.amountInNative]);
          }
          tx.moveCall({
            target: `${HAEDAL_PACKAGE}::interface::request_stake`,
            arguments: [
              tx.object("0x0000000000000000000000000000000000000000000000000000000000000005"),
              tx.object(HAEDAL_STAKING_OBJECT),
              suiCoin,
              tx.pure.address(senderAddress),
            ],
          });
        } else {
          // Aftermath afSUI: use the SDK's getStakeTransaction then incorporate into this tx.
          // WHY: Aftermath's SDK creates its own Transaction internally — we cannot inject
          // it directly. For a standalone stake, we delegate to the SDK builder. For a composite
          // leg, we use the Haedal direct-PTB path as the composable alternative.
          // If the user picks afSUI in a composite, fall back to Haedal for composability;
          // if they explicitly want afsui, throw clearly so the caller can handle.
          throw new CompositeBuildError(
            `Aftermath afSUI staking (lstProvider "afsui") cannot be composed inline in a dynamic composite — ` +
            `the Aftermath SDK builds its own internal transaction. Use lstProvider "hasui" (Haedal) for ` +
            `composable staking in a multi-leg PTB.`,
          );
        }

        compositeLegs.push({
          actionType: "stake",
          coinTypeIn: leg.coinTypeIn,
          amountInNative: leg.amountInNative,
        });
        prevOutputCoin = undefined;
      }
    }

    // After all legs: a final unconsumed output (e.g. an independent swap as the last leg)
    // returns to the sender so the PTB has no dangling value (UnusedValueWithoutDrop).
    if (prevOutputCoin !== undefined) {
      tx.transferObjects([prevOutputCoin], senderAddress);
      prevOutputCoin = undefined;
    }

    // Build the transaction. If any swap leg used the aggregator, build via the aggregator's
    // own builder so it can resolve gas with its gRPC client. Otherwise use the JSON-RPC client.
    let bytes: Uint8Array;
    if (agg && needsSwap) {
      bytes = await agg.buildTransactionBytes(tx);
    } else {
      // Pin gas for SUI-input-only legs (send/lend/stake from wallet SUI).
      const suiLegs = legs.filter(
        (l) => l.coinTypeIn === COIN_TYPES.SUI && (!l.amountFrom || l.amountFrom === "explicit"),
      );
      const totalSuiOut = suiLegs.reduce((sum, l) => sum + l.amountInNative, 0n);
      if (totalSuiOut > 0n) {
        await pinSuiGasPayment(client, tx, senderAddress, totalSuiOut);
      }
      bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    }

    return {
      txBytes: Buffer.from(bytes).toString("base64"),
      isFixture: false,
      compositeLegs,
      swapEstimatedOutByLeg: swapEstimatedOutByLeg.size > 0 ? swapEstimatedOutByLeg : undefined,
    };
  } catch (err) {
    if (err instanceof CompositeBuildError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/insufficientcoinbalance|insufficient coin balance|insufficient.*balance/i.test(msg)) {
      throw new CompositeBuildError(
        "Insufficient balance for this composite transaction. " +
          "Check your coin balances and leave some SUI for gas, then try again.",
      );
    }
    throw new CompositeBuildError(`Dynamic composite PTB construction failed: ${msg}`);
  }
}

/**
 * Fixture dynamic composite builder — builds a structurally valid TransactionKind
 * using placeholder Move calls. No live chain or gas resolution needed.
 *
 * WHY onlyTransactionKind: tx.build({ onlyTransactionKind: true }) skips the gas-coin
 * resolution step (which requires a live getCoins RPC call) so the fixture path works
 * in unit tests with a stub client. The Guardian's delta/owner walk runs on whatever
 * PTB bytes come back; fixture bytes only need to parse cleanly.
 *
 * Per-leg compositeLegs (with recipients for send legs) is returned so the caller can
 * forward it into proposal.compositeLegs for the Guardian's anti-leak gate.
 */
async function buildFixtureDynamicComposite(
  _client: SuiClient,
  senderAddress: string,
  legs: DynamicCompositeLeg[],
): Promise<DynamicCompositeBuildResult> {
  try {
    const tx = new Transaction();
    // setSender is needed for TransactionKind serialization context.
    tx.setSender(senderAddress);

    const compositeLegs: DynamicCompositeLegResult[] = [];
    // Placeholder: split 1 MIST from gas as stand-in for any coin in the chained path.
    // In live mode, each leg produces a real PTBResult — in fixture mode, we approximate
    // the structural shape (gas-split coin = stand-in for the swap / deposit output).
    let prevOutputCoin: TransactionObjectArgument | undefined;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const isChained = leg.amountFrom === "prev-output" && prevOutputCoin != null;
      // Use 1n as the split amount for chained legs (the real amount is resolved at runtime).
      const splitAmt = isChained ? 1n : leg.amountInNative > 0n ? leg.amountInNative : 1n;

      if (leg.actionType === "send") {
        const recipient = leg.recipient!;
        let coinToSend: TransactionObjectArgument;
        if (isChained && prevOutputCoin) {
          coinToSend = prevOutputCoin;
          prevOutputCoin = undefined;
        } else {
          [coinToSend] = tx.splitCoins(tx.gas, [splitAmt]);
        }
        tx.transferObjects([coinToSend], recipient);
        compositeLegs.push({
          actionType: "send",
          coinTypeIn: leg.coinTypeIn,
          amountInNative: leg.amountInNative,
          recipient,
        });
        prevOutputCoin = undefined;

      } else if (leg.actionType === "swap") {
        // Fixture: split from gas as stand-in for the swap output coin.
        const [swapOut] = tx.splitCoins(tx.gas, [splitAmt]);
        prevOutputCoin = swapOut as TransactionObjectArgument;
        compositeLegs.push({
          actionType: "swap",
          coinTypeIn: leg.coinTypeIn,
          amountInNative: leg.amountInNative,
        });

      } else if (leg.actionType === "lend_deposit") {
        const NAVI_PKG = "0x1e4a13a0494d5facdbe8473e74127b838c2d446ecec0ce262e2eddafa77259cb";
        let inputCoin: TransactionObjectArgument;
        if (isChained && prevOutputCoin) {
          inputCoin = prevOutputCoin;
          prevOutputCoin = undefined;
        } else {
          [inputCoin] = tx.splitCoins(tx.gas, [splitAmt]);
        }
        tx.moveCall({
          target: `${NAVI_PKG}::incentive_v3::entry_deposit`,
          arguments: [inputCoin],
        });
        compositeLegs.push({
          actionType: "lend_deposit",
          coinTypeIn: leg.coinTypeIn,
          amountInNative: leg.amountInNative,
        });
        prevOutputCoin = undefined;

      } else if (leg.actionType === "stake") {
        // Fixture stake leg: use a pure-only MoveCall placeholder (no tx.object() calls)
        // so the TransactionKind can be built without a live client.
        // In live mode, the Haedal direct-PTB path uses tx.object() + HAEDAL_STAKING_OBJECT.
        // The fixture only needs to exercise the structural shape — a pure sender arg suffices.
        let suiCoin: TransactionObjectArgument;
        if (isChained && prevOutputCoin) {
          suiCoin = prevOutputCoin;
          prevOutputCoin = undefined;
        } else {
          [suiCoin] = tx.splitCoins(tx.gas, [splitAmt]);
        }
        tx.moveCall({
          target: `${HAEDAL_PACKAGE}::interface::request_stake`,
          // Omit the shared-object args (SuiSystemState + Staking) in fixture mode:
          // tx.object() triggers object resolution which requires a client.
          // The Guardian's multiset gate checks for this target; the coin arg is sufficient
          // for structural validation without live object data.
          arguments: [suiCoin, tx.pure.address(senderAddress)],
        });
        compositeLegs.push({
          actionType: "stake",
          coinTypeIn: leg.coinTypeIn,
          amountInNative: leg.amountInNative,
        });
        prevOutputCoin = undefined;
      }
    }

    // Build as TransactionKind — skips gas resolution + live RPC calls.
    // Avoids needing a real SuiClient in tests (no pinSuiGasPayment call).
    const bytes = await tx.build({ onlyTransactionKind: true });
    return {
      txBytes: Buffer.from(bytes).toString("base64"),
      isFixture: true,
      compositeLegs,
    };
  } catch (err) {
    if (err instanceof CompositeBuildError) throw err;
    throw new CompositeBuildError(
      `Dynamic composite fixture PTB construction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
