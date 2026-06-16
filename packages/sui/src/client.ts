/**
 * Dewlock server-side Sui RPC clients.
 * Exports a mainnet client (primary) and a devnet client (feature-flagged).
 * Both are lazy singletons — instantiated on first call so module import stays cheap.
 *
 * Never expose these on the client bundle; import from server components or API routes only.
 *
 * @mysten/sui v2.x: SuiClient was renamed to SuiJsonRpcClient (in @mysten/sui/jsonRpc).
 * Constructor now requires explicit { network, url } instead of just { url }.
 */

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

// Re-export the type under the familiar alias so callers import from here.
export type SuiClient = SuiJsonRpcClient;

let mainnetClient: SuiJsonRpcClient | null = null;
let devnetClient: SuiJsonRpcClient | null = null;

/** Mainnet Sui RPC client — used for track/transfer/swap/LP. */
export function getSuiMainnetClient(): SuiJsonRpcClient {
  if (!mainnetClient) {
    mainnetClient = new SuiJsonRpcClient({
      network: "mainnet",
      url: process.env.SUI_RPC_URL ?? "https://fullnode.mainnet.sui.io:443",
    });
  }
  return mainnetClient;
}

/**
 * Devnet Sui RPC client — used only for the confidential transfer module.
 * Gated by NEXT_PUBLIC_FEATURE_CONFIDENTIAL=true; not wired in Phase 1.
 */
export function getSuiDevnetClient(): SuiJsonRpcClient {
  if (!devnetClient) {
    devnetClient = new SuiJsonRpcClient({
      network: "devnet",
      url:
        process.env.SUI_DEVNET_RPC_URL ??
        "https://fullnode.devnet.sui.io:443",
    });
  }
  return devnetClient;
}
