/**
 * Native-SUI gas-coverage helper.
 *
 * A PTB that takes its input by splitting native SUI from `tx.gas` (transfers, SUI lends, the
 * Aftermath router) needs the gas coin to cover BOTH the split amount AND the gas budget. The
 * default auto gas-selection only guarantees the budget, so on a wallet whose SUI is fragmented
 * across coins it can pick a coin too small for the split — the dry-run then fails with
 * `InsufficientGas` even though the wallet "has gas" in total. Pinning the gas payment to the
 * largest SUI coins covering `input + reserve` removes that footgun; if the wallet's total SUI
 * genuinely can't cover input + gas, we throw a clear, actionable error instead.
 */

import type { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { COIN_TYPES } from "./allowlist";

/** SUI left for network gas when native SUI is spent from the gas coin (0.05 SUI). */
export const SUI_GAS_RESERVE_MIST = 50_000_000n;

/** Thrown when total SUI can't cover the spent amount + the gas reserve. Callers surface the
 * message verbatim as a block reason (it is already user-facing and actionable). */
export class InsufficientGasCoverageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientGasCoverageError";
  }
}

function fmtSui(mist: bigint): string {
  return (Number(mist) / 1e9).toFixed(4);
}

/**
 * Assert the wallet's total SUI covers `suiSpentFromGas + SUI_GAS_RESERVE_MIST`, WITHOUT
 * pinning the gas payment. Use this when the gas coin is managed by an external builder
 * (e.g. the Cetus aggregator's buildTransactionBytes) so we can't pin, but still want the
 * shortfall caught upfront — before the heavy build — as the same actionable error/gate.
 *
 * @throws InsufficientGasCoverageError when total SUI < spent + reserve.
 */
export async function assertSuiGasCoverage(
  client: SuiJsonRpcClient,
  sender: string,
  suiSpentFromGas: bigint,
): Promise<void> {
  const needed = suiSpentFromGas + SUI_GAS_RESERVE_MIST;
  const bal = await client.getBalance({ owner: sender, coinType: COIN_TYPES.SUI });
  const total = BigInt(bal.totalBalance);
  if (total < needed) {
    throw new InsufficientGasCoverageError(
      `Not enough SUI to cover this transaction plus network gas: need ~${fmtSui(needed)} SUI ` +
        `(${fmtSui(suiSpentFromGas)} for the swap + ${fmtSui(SUI_GAS_RESERVE_MIST)} for gas), ` +
        `but you hold ${fmtSui(total)} SUI. Lower the amount or add more SUI.`,
    );
  }
}

/**
 * Pin `tx`'s gas payment to SUI coins covering `suiSpentFromGas + SUI_GAS_RESERVE_MIST`,
 * largest-first. No-op-safe to call only when the input coin is native SUI.
 *
 * @throws InsufficientGasCoverageError when total SUI < spent + reserve.
 */
export async function pinSuiGasPayment(
  client: SuiJsonRpcClient,
  tx: Transaction,
  sender: string,
  suiSpentFromGas: bigint,
): Promise<void> {
  const needed = suiSpentFromGas + SUI_GAS_RESERVE_MIST;

  const all: { coinObjectId: string; version: string; digest: string; balance: string }[] = [];
  let cursor: string | null | undefined = null;
  do {
    const page = await client.getCoins({ owner: sender, coinType: COIN_TYPES.SUI, cursor });
    all.push(...page.data);
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  // Largest-first so the fewest coins cover input + gas (and the merged gas coin is big enough
  // for the split). Sui caps gas payment at 256 objects — largest-first keeps us well under it.
  all.sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));

  const picked: typeof all = [];
  let sum = 0n;
  for (const c of all) {
    picked.push(c);
    sum += BigInt(c.balance);
    if (sum >= needed) break;
  }

  if (picked.length === 0 || sum < needed) {
    throw new InsufficientGasCoverageError(
      `Not enough SUI to cover this transaction plus network gas: need ~${fmtSui(needed)} SUI ` +
        `(${fmtSui(suiSpentFromGas)} for the swap/transfer + ${fmtSui(SUI_GAS_RESERVE_MIST)} for gas), ` +
        `but you hold ${fmtSui(sum)} SUI. Lower the amount or add more SUI.`,
    );
  }

  tx.setGasPayment(
    picked.map((c) => ({ objectId: c.coinObjectId, version: c.version, digest: c.digest })),
  );
}
