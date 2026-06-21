/**
 * deepbook/balance-manager.ts — BalanceManager onboarding PTB builders.
 *
 * BalanceManager is a Sui shared object that holds the user's funds for
 * DeepBook limit orders. It must be created once per wallet (off-stage,
 * one-time user-signed transaction) and funded before placing any order.
 *
 * WHY off-stage: creating + funding a BM before placing an order would require
 * two separate user signatures in sequence. For the demo the BM is pre-funded
 * by running the onboarding script once before the demo session begins.
 *
 * These PTB builders produce UNSIGNED transactions returned to the user for
 * signing — the server never holds private keys (0 user-fund keys server-side).
 *
 * Budget ceiling: deposit amounts are capped at the Guardian's $5/tx limit
 * (enforced by the caller / Guardian gate). These builders do NOT enforce caps
 * independently — they are plumbing; the Guardian is authoritative.
 */

import { Transaction } from "@mysten/sui/transactions";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { SuiClient } from "./client";
import { createDeepBookClient, BALANCE_MANAGER_KEY } from "./client";

export interface BalanceManagerCreateResult {
  /** Serialized unsigned PTB in base64. */
  txBytes: string;
  /**
   * Note: the created BM object id is NOT known until after execution.
   * Read it from tx effects objectChanges after the user signs and executes.
   */
  note: string;
}

export interface BalanceManagerDepositResult {
  txBytes: string;
}

/**
 * Build an unsigned PTB that creates and shares a new BalanceManager.
 *
 * After the user signs and executes this transaction, read the created
 * BalanceManager object id from `effects.objectChanges` where
 * `objectType` contains `balance_manager::BalanceManager`.
 */
export async function buildCreateBalanceManager(
  suiClient: SuiClient,
  senderAddress: string,
): Promise<BalanceManagerCreateResult> {
  // Use a placeholder balanceManagerId for client init (not needed for create call)
  const PLACEHOLDER_BM = "0x" + "0".repeat(64);
  const { client } = await createDeepBookClient({
    suiClient,
    senderAddress,
    balanceManagerId: PLACEHOLDER_BM,
  });

  const tx = new Transaction();
  tx.setSender(senderAddress);
  // createAndShareBalanceManager builds the ::balance_manager::new +
  // 0x2::transfer::public_share_object calls (both allowlisted). Called through the
  // real typed client so a method-name drift is a compile error, not a silent failure.
  client.balanceManager.createAndShareBalanceManager()(tx);

  const txBytes = await tx.build({ client: suiClient as unknown as ClientWithCoreApi });
  return {
    txBytes: Buffer.from(txBytes).toString("base64"),
    note: "After execution, read the BalanceManager object id from tx effects objectChanges.",
  };
}

/**
 * Build an unsigned PTB that deposits `amount` of `coinKey` into the BalanceManager.
 *
 * @param balanceManagerId - The existing shared BM object id (0x…64hex).
 * @param coinKey - DeepBook coin key string (e.g. "USDC", "SUI", "DEEP").
 * @param humanAmount - Human-readable amount (e.g. 5.0 for 5 USDC). SDK scales internally.
 */
export async function buildDepositIntoBalanceManager(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
  coinKey: string,
  humanAmount: number,
): Promise<BalanceManagerDepositResult> {
  if (humanAmount <= 0) {
    throw new Error("Deposit amount must be positive.");
  }
  const { client } = await createDeepBookClient({
    suiClient,
    senderAddress,
    balanceManagerId,
  });

  const tx = new Transaction();
  tx.setSender(senderAddress);
  client.balanceManager.depositIntoManager(BALANCE_MANAGER_KEY, coinKey, humanAmount)(tx);

  const txBytes = await tx.build({ client: suiClient as unknown as ClientWithCoreApi });
  return { txBytes: Buffer.from(txBytes).toString("base64") };
}

/**
 * Result of resolving a wallet's BalanceManagers.
 *  - "ok":        the read succeeded; `ids` is authoritative (possibly empty = not provisioned).
 *  - "rpc_error": the read FAILED; `ids` is empty but UNRELIABLE — the caller must
 *                 BLOCK (never offer onboarding), or a transient fullnode blip would
 *                 make a provisioned user mint a SECOND BalanceManager and orphan funds.
 */
export type BalanceManagerResolution =
  | { status: "ok"; ids: string[] }
  | { status: "rpc_error"; ids: [] };

/**
 * Look up existing BalanceManager object ids for a wallet.
 * Used to detect whether onboarding is needed before placing an order, and to
 * validate any client-supplied BM id against the sender's actual set (ownership).
 *
 * CRITICAL: an RPC error is reported as `rpc_error` — NOT as an empty list. The two
 * are indistinguishable in the raw SDK call but mean opposite things ("can't tell"
 * vs "definitely none"); conflating them mints duplicate BalanceManagers.
 */
export async function getExistingBalanceManagers(
  suiClient: SuiClient,
  senderAddress: string,
): Promise<BalanceManagerResolution> {
  try {
    const PLACEHOLDER_BM = "0x" + "0".repeat(64);
    const { client } = await createDeepBookClient({
      suiClient,
      senderAddress,
      balanceManagerId: PLACEHOLDER_BM,
    });
    const ids = await client.getBalanceManagerIds(senderAddress);
    return { status: "ok", ids: ids ?? [] };
  } catch (err) {
    // Observability for a fail-closed path: surface WHY resolution failed (RPC down,
    // SDK load error, …) so a "couldn't verify your account" block can be traced in prod.
    console.warn("[bm-resolve] getExistingBalanceManagers failed:", err instanceof Error ? err.message : String(err));
    return { status: "rpc_error", ids: [] };
  }
}
