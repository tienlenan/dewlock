/**
 * deepbook/account-orders.ts — read-only DeepBook account state.
 *
 * Three reads, all via the lazy-imported DeepBook SDK (no SDK evaluation on
 * non-order paths):
 *  - readSettledBalance: a single coin's withdrawable balance (the Guardian's
 *    withdraw_settled amount ceiling — must throw on any error so the gate fails
 *    closed, never silently returns 0).
 *  - getOpenOrders: resting orders across whitelisted pools, normalized to plain
 *    rows (side + price + filled%) for the positions UI.
 *  - getSettledBalances: per-coin withdrawable balances for the positions UI.
 *
 * `getOrderNormalized` is the ONLY per-order read that exposes side (`isBid`) and
 * a limit `normalized_price`; plain `getOrder`/`getOrders` lack both.
 */

import type { SuiClient } from "./client";
import { createDeepBookClient, BALANCE_MANAGER_KEY } from "./client";
import { COIN_TYPES, DEEPBOOK_POOLS } from "../allowlist";
import { normalizeCoinType } from "../protocol-constants";

/** Canonical coin type → DeepBook SDK coin key (the 3 whitelisted-pool coins). */
const DEEPBOOK_COIN_KEY_BY_TYPE: Record<string, string> = {
  [COIN_TYPES.DEEP]: "DEEP",
  [COIN_TYPES.SUI]: "SUI",
  [COIN_TYPES.USDC]: "USDC",
};

/** Map a canonical coin type to its DeepBook coin key, or undefined if unsupported. */
export function deepbookCoinKeyForType(coinType: string): string | undefined {
  return DEEPBOOK_COIN_KEY_BY_TYPE[normalizeCoinType(coinType)] ?? DEEPBOOK_COIN_KEY_BY_TYPE[coinType];
}

export interface OpenOrderRow {
  orderId: string;
  poolKey: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  filledPct: number;
  expireTimestampMs: number;
}

export interface SettledBalanceRow {
  coinType: string;
  coinKey: string;
  balance: number;
}

/**
 * Read the settled (withdrawable) balance for one coin in the BalanceManager.
 * THROWS on any error — the caller (Guardian withdraw ceiling) must fail closed.
 * Returns a human-readable amount (the SDK scales internally).
 */
export async function readSettledBalance(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
  coinType: string,
): Promise<number> {
  const coinKey = deepbookCoinKeyForType(coinType);
  if (!coinKey) {
    throw new Error(`Unsupported coin type for DeepBook settled-balance read: ${coinType}`);
  }
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  const result = await (client as {
    checkManagerBalance: (managerKey: string, coinKey: string) => Promise<{ coinType: string; balance: number }>;
  }).checkManagerBalance(BALANCE_MANAGER_KEY, coinKey);
  return result.balance;
}

/**
 * List resting open orders for the BalanceManager across the given whitelisted pools.
 * Fully-filled and expired orders are hidden (not cancelable). Per-order reads are
 * resilient: a single failing read drops that order, never the whole list.
 */
export async function getOpenOrders(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
  poolKeys: string[],
): Promise<OpenOrderRow[]> {
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  const db = client as {
    accountOpenOrders: (poolKey: string, managerKey: string) => Promise<string[]>;
    getOrderNormalized: (
      poolKey: string,
      orderId: string,
    ) => Promise<{
      quantity: string;
      filled_quantity: string;
      isBid: boolean;
      normalized_price: string;
      status: number;
      expire_timestamp: string;
    } | null>;
  };

  const rows: OpenOrderRow[] = [];
  const now = Date.now();
  for (const poolKey of poolKeys) {
    let orderIds: string[];
    try {
      orderIds = await db.accountOpenOrders(poolKey, BALANCE_MANAGER_KEY);
    } catch {
      continue; // one pool's read failing must not blank the others
    }
    const settled = await Promise.allSettled(
      orderIds.map((id) => db.getOrderNormalized(poolKey, id).then((o) => ({ id, o }))),
    );
    for (const r of settled) {
      if (r.status !== "fulfilled" || !r.value.o) continue;
      const { id, o } = r.value;
      const quantity = Number(o.quantity);
      const filled = Number(o.filled_quantity);
      const expireMs = Number(o.expire_timestamp);
      // Hide non-cancelable orders: fully filled or already expired.
      if (quantity > 0 && filled >= quantity) continue;
      if (expireMs > 0 && expireMs < now) continue;
      rows.push({
        orderId: id,
        poolKey,
        side: o.isBid ? "BUY" : "SELL",
        price: Number(o.normalized_price),
        quantity,
        filledPct: quantity > 0 ? (filled / quantity) * 100 : 0,
        expireTimestampMs: expireMs,
      });
    }
  }
  return rows;
}

/**
 * Read settled balances for the whitelisted-pool coins (DEEP/SUI/USDC). Non-zero
 * entries are withdrawable. Per-coin reads are resilient (one failure drops one row).
 */
export async function getSettledBalances(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
): Promise<SettledBalanceRow[]> {
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  const db = client as {
    checkManagerBalance: (managerKey: string, coinKey: string) => Promise<{ coinType: string; balance: number }>;
  };
  const coins: Array<{ coinType: string; coinKey: string }> = [
    { coinType: COIN_TYPES.DEEP, coinKey: "DEEP" },
    { coinType: COIN_TYPES.SUI, coinKey: "SUI" },
    { coinType: COIN_TYPES.USDC, coinKey: "USDC" },
  ];
  const settled = await Promise.allSettled(
    coins.map((c) =>
      db.checkManagerBalance(BALANCE_MANAGER_KEY, c.coinKey).then((b) => ({ ...c, balance: b.balance })),
    ),
  );
  const rows: SettledBalanceRow[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    if (r.value.balance > 0) {
      rows.push({ coinType: r.value.coinType, coinKey: r.value.coinKey, balance: r.value.balance });
    }
  }
  return rows;
}

/** Whitelisted pool keys (for callers that iterate all pools). */
export const WHITELISTED_POOL_KEYS = Object.keys(DEEPBOOK_POOLS);
