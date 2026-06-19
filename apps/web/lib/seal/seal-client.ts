"use client";

/**
 * SealClient factory (client-only). Seal runs on its own network (SEAL_NETWORK, default testnet)
 * which is independent of the app's mainnet DeFi client — so the lib owns a dedicated
 * SuiJsonRpcClient pinned to the Seal network rather than using the dapp-kit one. Both the client
 * and the SealClient are memoized so encrypt/decrypt reuse one instance (and its key cache).
 * Key-server ids are verified-by-source (the docs list), so we skip the per-construction
 * verifyKeyServers round-trip to keep the save path fast.
 */

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SealClient, type SealCompatibleClient } from "@mysten/seal";
import { sealKeyServers, SEAL_ENABLED, SEAL_RPC_URL, SEAL_NETWORK } from "./seal-config";

let suiClient: SealCompatibleClient | null = null;
let sealClient: SealClient | null = null;

/** The Sui client pinned to the Seal network (testnet by default). */
export function sealSuiClient(): SealCompatibleClient {
  if (!suiClient) {
    suiClient = new SuiJsonRpcClient({
      network: SEAL_NETWORK,
      url: SEAL_RPC_URL,
    }) as unknown as SealCompatibleClient;
  }
  return suiClient;
}

export function getSealClient(): SealClient {
  if (!sealClient) {
    sealClient = new SealClient({
      suiClient: sealSuiClient(),
      serverConfigs: sealKeyServers(),
      verifyKeyServers: false,
    });
  }
  return sealClient;
}

/**
 * Kill-switch + config gate (Decision 3): is Seal usable at all right now? Cheap + sync so it never
 * adds latency to the autosave path. A key-server outage is detected REACTIVELY — the first encrypt
 * that throws makes the caller fall back to a plaintext save (with a note), not a proactive ping.
 */
export function isSealUsable(): boolean {
  return SEAL_ENABLED && sealKeyServers().length > 0;
}
