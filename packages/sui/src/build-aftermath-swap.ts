/**
 * Build an unsigned Aftermath Router swap PTB.
 *
 * WHY a separate builder from build-aggregator-swap.ts: the Aftermath SDK fetches
 * a server-built transaction from its API (`getTransactionForCompleteTradeRoute`),
 * whereas the Cetus aggregator builds client-side via gRPC coin selection. The
 * resulting PTBs have different MoveCall shapes and are governed by different
 * allowlist targets (swap_cap::obtain_router_cap vs router::new_swap_context).
 *
 * WHY a prebundled CJS copy via static require: aftermath-ts-sdk is ESM-only and sits
 * behind a pnpm symlink the Vercel serverless packager strips. It's loaded from
 * sdk-bundles/aftermath.cjs by a STATIC relative require so Next's tracer ships it in
 * the function — same rationale as build-lend.ts (see loadAftermathSdk below).
 *
 * WHY tx.build({client}) (NOT tx.serialize()): the SDK returns an @mysten/sui Transaction;
 * we build it to canonical BCS bytes + base64 for the Guardian. tx.serialize() emits JSON,
 * which the Guardian's Transaction.from(base64) would mis-decode (ULEB overflow).
 *
 * Guardian invariant: the Guardian re-derives min-out from a FRESH Aftermath quote
 * (fetchAftermathQuote) when aftermath is the chosen source — never from Cetus.
 * The allowlist gate accepts Aftermath's MoveCall targets via the isAftermathSwapCall
 * module::function signature check (package-agnostic for per-DEX integration pkgs).
 */

import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { COIN_TYPES } from "./allowlist";
import { pinSuiGasPayment, InsufficientGasCoverageError } from "./sui-gas-payment";
import { isFixtureMode, type SwapQuote } from "./quotes-source";
import { fetchAftermathQuote } from "./aftermath-quotes";
import type { SwapSpec, SwapBuildResult } from "./build-swap";
import { SwapBuildError } from "./build-swap";

type SuiClient = SuiJsonRpcClient;

type AftermathSdk = typeof import("aftermath-ts-sdk");

function loadAftermathSdk(): AftermathSdk {
  // STATIC require of the esbuild-prebundled CJS copy (sdk-bundles/aftermath.cjs). A
  // static relative require is followed by Next's file tracer (and inlined when this
  // module is bundled into a route chunk), so the SDK is present in the serverless
  // function — unlike the bare ESM package, which sits behind a pnpm symlink the Vercel
  // packager strips ("Cannot find package") and is invisible to the tracer when loaded
  // via dynamic import. Types still come from the real package above.
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  return require("../sdk-bundles/aftermath.cjs") as AftermathSdk;
}

/**
 * Build an unsigned Aftermath swap PTB. Throws SwapBuildError on any SDK/RPC
 * error — callers (Guardian) treat a throw as BLOCK.
 */
export async function buildAftermathSwap(
  client: SuiClient,
  spec: SwapSpec,
): Promise<SwapBuildResult> {
  const { senderAddress, coinTypeIn, coinTypeOut, amountInNative, slippageBps } = spec;

  const known = Object.values(COIN_TYPES) as string[];
  if (!known.includes(coinTypeIn)) throw new SwapBuildError(`Unknown input coin type: "${coinTypeIn}"`);
  if (!known.includes(coinTypeOut)) throw new SwapBuildError(`Unknown output coin type: "${coinTypeOut}"`);
  if (coinTypeIn === coinTypeOut) throw new SwapBuildError("Swap input and output coin types must differ.");
  if (amountInNative <= 0n) throw new SwapBuildError("Swap amount must be positive.");
  if (slippageBps < 0 || slippageBps > 5000) throw new SwapBuildError("Slippage must be 0–5000 bps.");

  if (isFixtureMode()) {
    const quote = await fetchAftermathQuote(coinTypeIn, coinTypeOut, amountInNative, slippageBps);
    const tx = new Transaction();
    tx.setSender(senderAddress);
    // Placeholder PTB for demo — no real Move calls; UI shows the DEMO FIXTURE badge.
    const [coin] = tx.splitCoins(tx.gas, [0n]);
    tx.mergeCoins(tx.gas, [coin]);
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), quote };
  }

  return buildLiveAftermathPtb(client, spec);
}

async function buildLiveAftermathPtb(client: SuiClient, spec: SwapSpec): Promise<SwapBuildResult> {
  const { senderAddress, coinTypeIn, coinTypeOut, amountInNative, slippageBps } = spec;

  let mod: AftermathSdk;
  try {
    mod = await loadAftermathSdk();
  } catch (err) {
    throw new SwapBuildError(
      `Failed to load Aftermath SDK: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let txBytes: string;
  let estimatedAmountOut: bigint;

  try {
    const af = new mod.Aftermath("MAINNET");
    const router = af.Router();

    // Step 1: fetch the best route for this pair + amount.
    const completeRoute = await router.getCompleteTradeRouteGivenAmountIn({
      coinInType: coinTypeIn,
      coinOutType: coinTypeOut,
      coinInAmount: amountInNative,
    });

    // Extract estimated output — used to build the quote embedded in the result.
    const rawOut = (completeRoute as { coinOut?: { amount?: bigint | string } }).coinOut?.amount;
    if (rawOut == null) {
      throw new SwapBuildError("Aftermath router returned no coinOut.amount — cannot build swap.");
    }
    estimatedAmountOut = typeof rawOut === "bigint" ? rawOut : BigInt(String(rawOut));
    if (estimatedAmountOut <= 0n) {
      throw new SwapBuildError("Aftermath router returned zero estimated output — cannot build swap.");
    }

    // Step 2: request the server-built PTB for this route.
    // slippage is a fraction (0.005 = 0.5%), so convert from bps.
    const slippageFraction = slippageBps / 10_000;
    const txResult = await router.getTransactionForCompleteTradeRoute({
      walletAddress: senderAddress,
      completeRoute,
      slippage: slippageFraction,
    });

    // The result is a Transaction object (from @mysten/sui). Build it to BCS
    // transaction bytes, then base64-encode. NOTE: tx.serialize() returns the
    // transaction's JSON form — NOT BCS — so Guardian's Transaction.from(base64)
    // would mis-decode it (ULEB length overflow). tx.build({client}) resolves
    // gas + object refs and emits the canonical BCS bytes the Guardian expects.
    const resultTx = txResult as unknown as Transaction;
    // Native-SUI input is split from tx.gas — pin gas payment to SUI coins covering input + gas
    // so a fragmented wallet can't land on a gas coin too small for the split (InsufficientGas).
    if (coinTypeIn === COIN_TYPES.SUI) {
      await pinSuiGasPayment(client, resultTx, senderAddress, amountInNative);
    }
    const bytes = await resultTx.build({ client: client as unknown as ClientWithCoreApi });
    txBytes = Buffer.from(bytes).toString("base64");
  } catch (err) {
    if (err instanceof SwapBuildError) throw err;
    if (err instanceof InsufficientGasCoverageError) throw err; // already user-facing — don't bury it
    throw new SwapBuildError(
      `Aftermath swap PTB construction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const minAmountOut = (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
  const quote: SwapQuote = {
    coinTypeIn,
    coinTypeOut,
    amountIn: amountInNative,
    estimatedAmountOut,
    minAmountOut,
    slippageFraction: slippageBps / 10_000,
    poolId: "aftermath",
    source: "live",
    routeProviders: ["AFTERMATH"],
  };

  return { txBytes, quote };
}
