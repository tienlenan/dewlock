/**
 * deepbook/client.ts — DeepBookClient factory with lazy SDK import.
 *
 * WHY lazy import: mirrors the Cetus pattern in build-swap.ts. The DeepBook SDK
 * must NOT be evaluated on non-order paths (transfers, swaps) to prevent any
 * bundling side-effects or crash on missing peer resolution.
 *
 * WHY whitelisted balanceManagers key "DEWLOCK": the SDK requires a named
 * balance-manager registry entry keyed by an arbitrary string. "DEWLOCK" is the
 * canonical key used throughout this codebase; callers pass the object id.
 */

// Type-only imports — erased at runtime, no SDK evaluation.
import type { DeepBookClient as DeepBookClientType } from "@mysten/deepbook-v3";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";

export type SuiClient = SuiJsonRpcClient;

/** The canonical balance-manager key used across this codebase. */
export const BALANCE_MANAGER_KEY = "DEWLOCK" as const;

export interface DeepBookClientOptions {
  suiClient: SuiClient;
  senderAddress: string;
  balanceManagerId: string;
}

/**
 * Lazily-imported DeepBook SDK module shape.
 * Resolved at runtime only when an order path is executed.
 */
export interface DeepBookSdkModule {
  DeepBookClient: new (opts: {
    client: ClientWithCoreApi;
    address: string;
    network: "mainnet" | "testnet";
    balanceManagers?: Record<string, { address: string; tradeCap?: string }>;
  }) => DeepBookClientType;
  OrderType: { POST_ONLY: number };
  SelfMatchingOptions: { CANCEL_TAKER: number };
  MAX_TIMESTAMP: number;
}

/**
 * Dynamically import the DeepBook SDK.
 * Throws with a descriptive message if the package is unavailable
 * (fail-closed contract: any build error blocks the order).
 */
export async function importDeepBookSdk(): Promise<DeepBookSdkModule> {
  try {
    const mod = await import("@mysten/deepbook-v3");
    return mod as unknown as DeepBookSdkModule;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load DeepBook SDK: ${msg}`);
  }
}

/**
 * Create a DeepBookClient instance using the lazy-imported SDK.
 * Returns both the client and the raw SDK module for caller access to constants.
 */
export async function createDeepBookClient(
  opts: DeepBookClientOptions,
): Promise<{ client: DeepBookClientType; sdk: DeepBookSdkModule }> {
  const sdk = await importDeepBookSdk();
  const client = new sdk.DeepBookClient({
    client: opts.suiClient as unknown as ClientWithCoreApi,
    address: opts.senderAddress,
    network: "mainnet",
    balanceManagers: {
      [BALANCE_MANAGER_KEY]: { address: opts.balanceManagerId },
    },
  });
  return { client, sdk };
}
