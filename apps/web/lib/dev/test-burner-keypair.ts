/**
 * test-burner-keypair — dev-only burner key + network helpers for the local test wallet.
 *
 * SECURITY: this is a throwaway key generated/stored in the browser's localStorage so the app
 * can be driven WITHOUT a real wallet extension. It is double-gated (see isTestWalletEnabled):
 * a build-time env flag AND a localhost-only runtime check, so it is dead-code-eliminated and
 * never active on the deployed app. NEVER fund it with real mainnet assets.
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export type TestNetwork = "mainnet" | "devnet" | "localnet";

const SK_STORAGE_KEY = "dewlock.testwallet.sk";

/** Build-time + runtime gate. Both must hold, so the burner can never activate on Vercel. */
export function isTestWalletEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_WALLET !== "1") return false;
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/** The active test network — `NEXT_PUBLIC_SUI_NETWORK` (mainnet default; localnet/devnet for sends). */
export function testNetwork(): TestNetwork {
  const n = process.env.NEXT_PUBLIC_SUI_NETWORK;
  return n === "devnet" || n === "localnet" ? n : "mainnet";
}

/** RPC URL for a test network. Localnet is the standard local fullnode port. */
export function rpcUrlFor(network: TestNetwork): string {
  if (network === "localnet") return "http://127.0.0.1:9000";
  return getJsonRpcFullnodeUrl(network);
}

/** Faucet host for funding the burner. Mainnet has no faucet (returns null). */
export function faucetHostFor(network: TestNetwork): string | null {
  if (network === "devnet") return "https://faucet.devnet.sui.io";
  if (network === "localnet") return "http://127.0.0.1:9123";
  return null;
}

/** A SuiClient pointed at the active test network (used by the burner to build/execute). */
export function testSuiClient(network: TestNetwork = testNetwork()): SuiJsonRpcClient {
  return new SuiJsonRpcClient({ network, url: rpcUrlFor(network) });
}

/**
 * Load the persisted burner keypair, or generate + persist a fresh one. Stable across reloads
 * so the same test address keeps its (faucet-funded) balance during a session.
 */
export function loadOrCreateBurnerKeypair(): Ed25519Keypair {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(SK_STORAGE_KEY);
    if (stored) {
      try {
        return Ed25519Keypair.fromSecretKey(stored);
      } catch {
        // Corrupt entry — fall through and regenerate.
      }
    }
  }
  const kp = Ed25519Keypair.generate();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SK_STORAGE_KEY, kp.getSecretKey());
  }
  return kp;
}
