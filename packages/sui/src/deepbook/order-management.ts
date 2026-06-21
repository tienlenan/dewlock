/**
 * deepbook/order-management.ts — cancel a resting order / withdraw a settled balance.
 *
 * Both produce UNSIGNED PTBs returned to the client for WYSIWYS signing (the server
 * never holds keys). The DeepBook SDK is lazy-imported via createDeepBookClient.
 *
 * Methods are called through the REAL typed DeepBookClient (no type-erasing `as`
 * casts) so a method-name drift in a future SDK version is a COMPILE error here,
 * not a silent runtime failure — verified against @mysten/deepbook-v3@1.4.1:
 *   deepBook.cancelOrder              → pool::cancel_order
 *   balanceManager.withdrawFromManager→ balance_manager::withdraw    (partial)
 *   balanceManager.withdrawAllFromManager → balance_manager::withdraw_all (full)
 *
 * WITHDRAW RECIPIENT IS HARD-PINNED TO THE SENDER. There is no recipient parameter;
 * funds can only ever return to the wallet that signs. The Guardian re-asserts this.
 */

import { Transaction } from "@mysten/sui/transactions";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { SuiClient } from "./client";
import { createDeepBookClient, BALANCE_MANAGER_KEY } from "./client";

export interface CancelOrderSpec {
  senderAddress: string;
  /** Whitelisted DeepBook pool key (e.g. "DEEP_USDC"). */
  poolKey: string;
  /** BalanceManager shared object id (0x…64hex). */
  balanceManagerId: string;
  /** Resting order id to cancel (0x-hex). Cancel is whole-order (no amount). */
  orderId: string;
}

export interface WithdrawSettledSpec {
  senderAddress: string;
  /** BalanceManager shared object id (0x…64hex). */
  balanceManagerId: string;
  /** DeepBook coin key ("SUI" | "USDC" | "DEEP"). */
  coinKey: string;
  /**
   * Human-readable amount to withdraw (SDK scales internally). Omit to withdraw
   * the entire settled balance for the coin (withdraw_all).
   */
  humanAmount?: number;
}

export interface OrderManagementBuildResult {
  /** Serialized unsigned PTB in base64. */
  txBytes: string;
}

export class OrderManagementBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderManagementBuildError";
  }
}

/**
 * Build an unsigned PTB that cancels one resting order by id.
 * Emits a single `pool::cancel_order` MoveCall. Settled funds return to the BM.
 */
export async function buildCancelOrder(
  suiClient: SuiClient,
  spec: CancelOrderSpec,
): Promise<OrderManagementBuildResult> {
  const { senderAddress, poolKey, balanceManagerId, orderId } = spec;
  if (!orderId || !/^0x[0-9a-fA-F]+$/.test(orderId)) {
    throw new OrderManagementBuildError(`Invalid orderId "${orderId}" — expected a 0x-hex id.`);
  }

  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  const tx = new Transaction();
  tx.setSender(senderAddress);
  client.deepBook.cancelOrder(poolKey, BALANCE_MANAGER_KEY, orderId)(tx);

  let txBytes: Uint8Array;
  try {
    txBytes = await tx.build({ client: suiClient as unknown as ClientWithCoreApi });
  } catch (err) {
    throw new OrderManagementBuildError(
      `Failed to serialize cancel-order PTB: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return { txBytes: Buffer.from(txBytes).toString("base64") };
}

/**
 * Build an unsigned PTB that withdraws a settled balance to the SENDER.
 * Partial (`humanAmount` set) → balance_manager::withdraw; full (omitted) →
 * balance_manager::withdraw_all. The recipient is ALWAYS the sender.
 */
export async function buildWithdrawSettled(
  suiClient: SuiClient,
  spec: WithdrawSettledSpec,
): Promise<OrderManagementBuildResult> {
  const { senderAddress, balanceManagerId, coinKey, humanAmount } = spec;
  if (humanAmount !== undefined && !(humanAmount > 0)) {
    throw new OrderManagementBuildError("Withdraw amount must be positive (or omitted for withdraw-all).");
  }

  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  const tx = new Transaction();
  tx.setSender(senderAddress);
  // Recipient is hard-pinned to the sender — never a parameter, never a foreign address.
  const recipient = senderAddress;
  if (humanAmount === undefined) {
    client.balanceManager.withdrawAllFromManager(BALANCE_MANAGER_KEY, coinKey, recipient)(tx);
  } else {
    client.balanceManager.withdrawFromManager(BALANCE_MANAGER_KEY, coinKey, humanAmount, recipient)(tx);
  }

  let txBytes: Uint8Array;
  try {
    txBytes = await tx.build({ client: suiClient as unknown as ClientWithCoreApi });
  } catch (err) {
    throw new OrderManagementBuildError(
      `Failed to serialize withdraw-settled PTB: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return { txBytes: Buffer.from(txBytes).toString("base64") };
}
