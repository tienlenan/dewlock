/**
 * Seal configuration — package ids, verified key servers, threshold (verified against the
 * installed @mysten/seal@1.2.0 surface + the Seal docs "verified key servers" list).
 *
 * `getAllowlistedKeyServers` was removed in seal 0.4.23 — we supply EXPLICIT `serverConfigs`.
 * Mainnet uses the decentralized committee key server (5-of-8 internally) via its aggregator
 * → one config, client threshold 1. Testnet uses two Mysten open servers (threshold 2) so the
 * CI parity test can run without mainnet gas.
 */

import type { KeyServerConfig } from "@mysten/seal";

export type SealNetwork = "mainnet" | "testnet";

/**
 * Seal network is INDEPENDENT of the app's DeFi network (NEXT_PUBLIC_SUI_NETWORK). It defaults to
 * "testnet" because the verified mainnet committee key server is permissioned (requires an API key —
 * "No API key found in request"), whereas the testnet Mysten servers are open. Sui addresses are
 * network-agnostic and `seal_approve` is pure address equality, so encrypting a mainnet wallet's
 * conversations against the testnet Seal infra is correct + free. Set NEXT_PUBLIC_SEAL_NETWORK=mainnet
 * once a mainnet key-server API key (Enoki/provider) is configured.
 */
export const SEAL_NETWORK: SealNetwork =
  (process.env.NEXT_PUBLIC_SEAL_NETWORK as SealNetwork) === "mainnet" ? "mainnet" : "testnet";

const RPC_URL: Record<SealNetwork, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
};

/** Fullnode URL for the Seal network (used to simulate seal_approve + build the SealClient). */
export const SEAL_RPC_URL = process.env.NEXT_PUBLIC_SEAL_RPC_URL || RPC_URL[SEAL_NETWORK];

/** Kill-switch (Decision 3): false → saves fall back to plaintext if Seal is unhealthy/disabled. */
export const SEAL_ENABLED = process.env.NEXT_PUBLIC_SEAL_ENABLED !== "false";

/** Our on-chain seal_approve policy package (move/dewlock_seal), published 2026-06-19. */
const SEAL_POLICY_PACKAGE: Record<SealNetwork, string> = {
  mainnet: "0x77aa928fded4eece2987b356774bc12a19ee88f240fca652409ef3ceb3910709",
  testnet: "0x15622655d10255880e5ad3e4b54f5b0d1d86740b57d58060c7a8bc4dc1f03008",
};

/** Verified Seal key servers (docs Pricing#verified-key-servers). */
const KEY_SERVERS: Record<SealNetwork, KeyServerConfig[]> = {
  mainnet: [
    {
      objectId: "0x686098f1439237fff9f36b99c7329683c22979d2005c2465cb891acb012a7595",
      weight: 1,
      aggregatorUrl: "https://seal-aggregator-mainnet.mystenlabs.com",
    },
  ],
  testnet: [
    { objectId: "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", weight: 1 },
    { objectId: "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8", weight: 1 },
  ],
};

const THRESHOLD: Record<SealNetwork, number> = { mainnet: 1, testnet: 2 };

/** The dewlock_seal policy package id (env override → built-in default for the active network). */
export const DEWLOCK_SEAL_PACKAGE_ID =
  process.env.NEXT_PUBLIC_DEWLOCK_SEAL_PACKAGE_ID || SEAL_POLICY_PACKAGE[SEAL_NETWORK];

export const SEAL_THRESHOLD = THRESHOLD[SEAL_NETWORK];

/** Verified key servers for the active network (optional JSON env override). */
export function sealKeyServers(): KeyServerConfig[] {
  const override = process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS;
  if (override) {
    try {
      const parsed = JSON.parse(override) as KeyServerConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* malformed override → fall through to defaults */
    }
  }
  return KEY_SERVERS[SEAL_NETWORK];
}
