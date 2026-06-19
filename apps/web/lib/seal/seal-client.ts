"use client";

/**
 * SealClient factory (client-only). Built from a dapp-kit Sui client + the pinned verified
 * key servers. Memoized per underlying client so repeated encrypt/decrypt reuse one instance
 * (and its key cache). Key-server ids are verified-by-source (the docs list), so we skip the
 * per-construction `verifyKeyServers` round-trip to keep the save path fast.
 */

import { SealClient, type SealCompatibleClient } from "@mysten/seal";
import { sealKeyServers, SEAL_ENABLED } from "./seal-config";

const clients = new WeakMap<object, SealClient>();

export function getSealClient(suiClient: SealCompatibleClient): SealClient {
  const key = suiClient as unknown as object;
  const cached = clients.get(key);
  if (cached) return cached;
  const client = new SealClient({
    suiClient,
    serverConfigs: sealKeyServers(),
    verifyKeyServers: false,
  });
  clients.set(key, client);
  return client;
}

/**
 * Kill-switch + config gate (Decision 3): is Seal usable at all right now? Cheap + sync so it
 * never adds latency to the autosave path. Detection of a key-server outage is REACTIVE — the
 * first encrypt that throws makes the caller fall back to a plaintext save (with a visible note),
 * rather than a proactive network ping on every save.
 */
export function isSealUsable(): boolean {
  return SEAL_ENABLED && sealKeyServers().length > 0;
}
