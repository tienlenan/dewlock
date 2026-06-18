/**
 * Build an unsigned Cetus-Aggregator swap PTB (best execution across activated venues).
 *
 * WHY a separate builder from build-swap.ts: the aggregator returns a decomposed
 * route (RouterDataV3) and assembles a multi-hop PTB via `fastRouterSwap`, which
 * selects the input coin, runs each hop, and returns the output to the sender.
 * The Guardian then re-derives min-out from an INDEPENDENT aggregator quote.
 *
 * WHY routing is constrained: providers are limited to activated venues so the
 * route can only touch DEXs whose `<AGG>::<dex>::swap` wrapper is allowlisted.
 *
 * WHY dynamic import: keep the heavy SDK out of non-swap bundles (same rationale
 * as the Cetus CLMM SDK in build-swap.ts).
 */

import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { COIN_TYPES } from "./allowlist";
import { isFixtureMode, type SwapQuote } from "./quotes-source";
import {
  fetchAggregatorQuote,
  AGGREGATOR_ACTIVE_PROVIDERS,
  loadAggregatorSdk,
} from "./aggregator-quotes";
import type { SwapSpec, SwapBuildResult } from "./build-swap";
import { SwapBuildError } from "./build-swap";

type SuiClient = SuiJsonRpcClient;

/**
 * Build an unsigned aggregator swap PTB. Throws SwapBuildError on any SDK/RPC
 * error — callers (Guardian) treat a throw as BLOCK.
 */
export async function buildAggregatorSwap(
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
    const quote = await fetchAggregatorQuote(coinTypeIn, coinTypeOut, amountInNative, slippageBps, senderAddress);
    const tx = new Transaction();
    tx.setSender(senderAddress);
    // Placeholder PTB for demo — no real Move calls; UI shows the DEMO FIXTURE badge.
    const [coin] = tx.splitCoins(tx.gas, [0n]);
    tx.mergeCoins(tx.gas, [coin]);
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), quote };
  }

  return buildLiveAggregatorPtb(spec);
}

async function buildLiveAggregatorPtb(spec: SwapSpec): Promise<SwapBuildResult> {
  const { senderAddress, coinTypeIn, coinTypeOut, amountInNative, slippageBps } = spec;

  let mod: typeof import("@cetusprotocol/aggregator-sdk");
  let grpcMod: typeof import("@mysten/sui/grpc");
  try {
    // Normalized loader unwraps the SDK's named exports from `.default` under Next's
    // externalized server runtime (else `mod.Env.Mainnet` throws). @mysten/sui/grpc
    // exposes its exports top-level in the same runtime, so a plain import is fine.
    mod = await loadAggregatorSdk();
    grpcMod = await import("@mysten/sui/grpc");
  } catch (err) {
    throw new SwapBuildError(`Failed to load aggregator SDK: ${err instanceof Error ? err.message : String(err)}`);
  }

  // The aggregator selects coins on-chain → it needs a gRPC client (separate from
  // the JSON-RPC client the rest of the app uses). SuiGrpcClient has NO network→URL
  // default: the endpoint MUST be supplied as `baseUrl` (the gRPC-web transport reads
  // options.baseUrl). Passing the wrong key leaves baseUrl undefined → every gRPC call
  // silently fails → no route → swap never builds. [needs live-env] grpc endpoint.
  const grpcBaseUrl = process.env.SUI_GRPC_URL ?? "https://fullnode.mainnet.sui.io:443";

  let txBytes: Uint8Array;
  let router: Awaited<ReturnType<InstanceType<typeof mod.AggregatorClient>["findRouters"]>>;
  try {
    const grpc = new grpcMod.SuiGrpcClient({ network: "mainnet", baseUrl: grpcBaseUrl });
    const agg = new mod.AggregatorClient({
      endpoint: process.env.CETUS_AGGREGATOR_ENDPOINT ?? "https://api-sui.cetus.zone/router_v3",
      signer: senderAddress,
      client: grpc as never,
      env: mod.Env.Mainnet,
    });
    router = await agg.findRouters({
      from: coinTypeIn,
      target: coinTypeOut,
      amount: amountInNative.toString(),
      byAmountIn: true,
      providers: [...AGGREGATOR_ACTIVE_PROVIDERS],
    });
    if (!router || router.amountOut == null) {
      throw new SwapBuildError("Aggregator returned no route — cannot build swap.");
    }
    const txb = new Transaction();
    txb.setSender(senderAddress);
    // fastRouterSwap selects the input coin, runs each hop, returns output to sender.
    await agg.fastRouterSwap({ router, slippage: slippageBps / 10_000, txb });
    txBytes = await agg.buildTransactionBytes(txb);
  } catch (err) {
    if (err instanceof SwapBuildError) throw err;
    throw new SwapBuildError(`Aggregator swap PTB construction failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const estimatedAmountOut = BigInt(router.amountOut.toString());
  const minAmountOut = (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
  const routeProviders = [
    ...new Set(
      ((router as { paths?: Array<{ provider?: string }> }).paths ?? [])
        .map((p) => p.provider)
        .filter((p): p is string => !!p),
    ),
  ];
  const quote: SwapQuote = {
    coinTypeIn,
    coinTypeOut,
    amountIn: amountInNative,
    estimatedAmountOut,
    minAmountOut,
    slippageFraction: slippageBps / 10_000,
    poolId: "aggregator",
    source: "live",
    routeProviders,
  };

  return { txBytes: Buffer.from(txBytes).toString("base64"), quote };
}
