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
 * Retry a read on a transient RPC rate-limit (429), with short backoff. These reads are
 * devInspect/simulate calls; a positions view fires several at once and public/keyed RPCs
 * throttle bursts. Non-429 errors rethrow immediately. Returns the value or rethrows.
 */
async function withRpcRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= retries || !/429|rate.?limit|too many requests/i.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); // 400ms, then 800ms
    }
  }
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
  const result = await withRpcRetry(() =>
    (client as {
      checkManagerBalance: (managerKey: string, coinKey: string) => Promise<{ coinType: string; balance: number }>;
    }).checkManagerBalance(BALANCE_MANAGER_KEY, coinKey),
  );
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
      orderIds = await withRpcRetry(() => db.accountOpenOrders(poolKey, BALANCE_MANAGER_KEY));
    } catch {
      continue; // one pool's read failing must not blank the others
    }
    const settled = await Promise.allSettled(
      orderIds.map((id) => withRpcRetry(() => db.getOrderNormalized(poolKey, id)).then((o) => ({ id, o }))),
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
  // Sequential (not concurrent) + retry-on-429: a burst of simultaneous devInspect calls
  // is what trips RPC rate limits and blanks balances. One failing coin drops only its row.
  const rows: SettledBalanceRow[] = [];
  for (const c of coins) {
    try {
      const b = await withRpcRetry(() => db.checkManagerBalance(BALANCE_MANAGER_KEY, c.coinKey));
      if (b.balance > 0) rows.push({ coinType: c.coinType, coinKey: c.coinKey, balance: b.balance });
    } catch {
      // skip this coin (read failed even after retry); never blank the whole list
    }
  }
  return rows;
}

/** Whitelisted pool keys (for callers that iterate all pools). */
export const WHITELISTED_POOL_KEYS = Object.keys(DEEPBOOK_POOLS);

/** Whitelisted pool → {base, quote} coin types. DEEP is the fee coin in every pool. */
const WHITELISTED_POOL_COINS: Record<string, { base: string; quote: string }> = {
  DEEP_USDC: { base: COIN_TYPES.DEEP, quote: COIN_TYPES.USDC },
  SUI_USDC: { base: COIN_TYPES.SUI, quote: COIN_TYPES.USDC },
  DEEP_SUI: { base: COIN_TYPES.DEEP, quote: COIN_TYPES.SUI },
};

export interface PoolTiedBalanceRow {
  coinType: string;
  coinKey: string;
  /** Funds locked in resting orders (lockedBalance), not withdrawable until cancel. */
  locked: number;
  /** Filled/owed funds settled in the pool account, claimable back to the BM. */
  settled: number;
}

/**
 * Read funds the BalanceManager has tied to whitelisted pools — locked in resting orders
 * (`lockedBalance`) and settled-but-unclaimed from fills (`account().settled_balances`).
 *
 * WHY this exists: `checkManagerBalance` maps to Move `balance_manager::balance<T>()`, which
 * counts ONLY coins physically in the BM's Bag. Placing an order moves funds OUT of the BM
 * into the pool, so a BM with a resting order or a filled-not-claimed trade reads 0 there —
 * making a genuinely funded account look empty. These two reads surface those funds.
 *
 * Amounts are aggregated per coin across all whitelisted pools (base/quote map to the pool's
 * coins; `deep` is always the DEEP fee coin). Resilient: a single pool's failing read drops
 * only its contribution, never the whole list.
 */
export async function getPoolTiedBalances(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
): Promise<PoolTiedBalanceRow[]> {
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  const db = client as {
    account: (
      poolKey: string,
      managerKey: string,
    ) => Promise<{ settled_balances: { base: number; quote: number; deep: number } }>;
    lockedBalance: (
      poolKey: string,
      managerKey: string,
    ) => Promise<{ base: number; quote: number; deep: number }>;
  };

  const acc = new Map<string, { locked: number; settled: number }>();
  const add = (coinType: string, locked: number, settled: number) => {
    if (locked <= 0 && settled <= 0) return;
    const cur = acc.get(coinType) ?? { locked: 0, settled: 0 };
    cur.locked += Math.max(0, locked);
    cur.settled += Math.max(0, settled);
    acc.set(coinType, cur);
  };

  // Sequential per pool (+ retry-on-429): a burst of devInspect calls trips RPC limits.
  for (const [poolKey, coins] of Object.entries(WHITELISTED_POOL_COINS)) {
    const [lockedRes, accountRes] = await Promise.allSettled([
      withRpcRetry(() => db.lockedBalance(poolKey, BALANCE_MANAGER_KEY)),
      withRpcRetry(() => db.account(poolKey, BALANCE_MANAGER_KEY)),
    ]);
    const locked = lockedRes.status === "fulfilled" ? lockedRes.value : { base: 0, quote: 0, deep: 0 };
    const settled =
      accountRes.status === "fulfilled"
        ? accountRes.value.settled_balances
        : { base: 0, quote: 0, deep: 0 };
    add(coins.base, locked.base, settled.base);
    add(coins.quote, locked.quote, settled.quote);
    add(COIN_TYPES.DEEP, locked.deep, settled.deep);
  }

  const rows: PoolTiedBalanceRow[] = [];
  for (const [coinType, v] of acc.entries()) {
    rows.push({ coinType, coinKey: deepbookCoinKeyForType(coinType) ?? coinType, locked: v.locked, settled: v.settled });
  }
  return rows;
}

/**
 * Whitelisted pool keys where the BM has a NON-ZERO settled balance (claimable). Used to
 * scope the claim PTB to only those pools — never settling a pool with nothing owed (which
 * would be a wasted, possibly-aborting call). Resilient: a failing pool read is skipped.
 */
export async function getPoolsWithSettledBalances(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
): Promise<string[]> {
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  const db = client as {
    account: (
      poolKey: string,
      managerKey: string,
    ) => Promise<{ settled_balances: { base: number; quote: number; deep: number } }>;
  };
  const pools: string[] = [];
  const poolKeys = Object.keys(WHITELISTED_POOL_COINS);
  let failures = 0;
  for (const poolKey of poolKeys) {
    try {
      const acc = await withRpcRetry(() => db.account(poolKey, BALANCE_MANAGER_KEY));
      const s = acc.settled_balances;
      if ((s.base ?? 0) > 0 || (s.quote ?? 0) > 0 || (s.deep ?? 0) > 0) pools.push(poolKey);
    } catch {
      failures++; // this pool's read failed even after retry
    }
  }
  // If EVERY pool read failed, an empty list is indeterminate, NOT "nothing settled" — the
  // caller must not tell the user there is nothing to claim when we simply couldn't verify.
  // Throw so the claim path surfaces a retry block (fail-closed) instead of a false negative.
  if (failures === poolKeys.length) {
    throw new Error("Could not read any DeepBook pool account (RPC) — settled balances indeterminate.");
  }
  return pools;
}
