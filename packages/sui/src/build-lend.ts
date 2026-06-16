/**
 * Build an unsigned lending PTB (deposit / repay) for NAVI or Suilend.
 *
 * Scope: only the health-IMPROVING verbs are buildable here — deposit (adds
 * collateral) and repay (reduces debt). Borrow/withdraw are health-REDUCING and
 * are gated OFF in the Guardian (checkLendingConstraints) until a guarded
 * post-tx health-factor follow-up.
 *
 * WHY the value is safe without a bespoke cap here: deposit/repay move coin OUT
 * of the wallet, so the Guardian's dry-run net-outflow cap bounds the USD value
 * automatically, and the trusted-price gate blocks an unpriced collateral coin.
 *
 * WHY dynamic import: keep the lending SDKs out of non-lending bundles (same
 * rationale as the Cetus/DeepBook SDKs). The Suilend SDK is bundler-only — it is
 * not clean Node-ESM — so its live path resolves only under Next, never in tests;
 * the fixture path is what tests and the demo exercise. [needs live-env].
 */

import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { COIN_TYPES } from "./allowlist";

type SuiClient = SuiJsonRpcClient;

export type LendProtocol = "navi" | "suilend";
export type LendAction = "deposit" | "repay";

export interface LendSpec {
  senderAddress: string;
  protocol: LendProtocol;
  action: LendAction;
  /** Canonical coin type being supplied/repaid. */
  coinType: string;
  /** Amount in native units. */
  amountNative: bigint;
  /** Suilend obligation id (required for live Suilend; ignored by NAVI). */
  obligationId?: string;
}

export interface LendBuildResult {
  /** Serialized unsigned PTB in base64. */
  txBytes: string;
  /** Health factor before/after, when read on-chain (preview only). */
  healthBefore?: number;
  healthAfter?: number;
  isFixture: boolean;
}

export class LendBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LendBuildError";
  }
}

function isFixtureMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "fixture";
}

/**
 * Build an unsigned deposit/repay PTB. Throws LendBuildError on any error —
 * callers (Guardian) treat a throw as BLOCK.
 */
export async function buildLend(client: SuiClient, spec: LendSpec): Promise<LendBuildResult> {
  const { senderAddress, coinType, amountNative, action } = spec;

  if (!Object.values(COIN_TYPES).includes(coinType as (typeof COIN_TYPES)[keyof typeof COIN_TYPES])) {
    throw new LendBuildError(`Unknown coin type "${coinType}" — only canonical types are permitted.`);
  }
  if (amountNative <= 0n) throw new LendBuildError("Lending amount must be positive.");
  if (action !== "deposit" && action !== "repay") {
    throw new LendBuildError(`Unsupported lend action "${action}" — only deposit/repay are buildable.`);
  }

  if (isFixtureMode()) {
    // Placeholder PTB for demo — no real Move calls; UI shows the DEMO FIXTURE badge.
    const tx = new Transaction();
    tx.setSender(senderAddress);
    const [coin] = tx.splitCoins(tx.gas, [0n]);
    tx.mergeCoins(tx.gas, [coin]);
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: true };
  }

  return spec.protocol === "navi"
    ? buildNaviLend(client, spec)
    : buildSuilendLend(client, spec);
}

// ---------------------------------------------------------------------------
// NAVI live path — @naviprotocol/lending (v2-native). [needs live-env]
// ---------------------------------------------------------------------------

async function buildNaviLend(client: SuiClient, spec: LendSpec): Promise<LendBuildResult> {
  const { senderAddress, coinType, amountNative, action } = spec;
  let navi: typeof import("@naviprotocol/lending");
  try {
    navi = await import("@naviprotocol/lending");
  } catch (err) {
    throw new LendBuildError(`Failed to load NAVI SDK: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);
    // Select the input coin object for the asset (SUI uses the gas coin).
    const isSui = coinType === COIN_TYPES.SUI;
    const coin = isSui
      ? tx.splitCoins(tx.gas, [amountNative])[0]
      : await selectCoin(client, tx, senderAddress, coinType, amountNative);
    const options = { account: senderAddress, amount: Number(amountNative) } as never;
    if (action === "deposit") {
      await navi.depositCoinPTB(tx, coinType, coin as never, options);
    } else {
      await navi.repayCoinPTB(tx, coinType, coin as never, options);
    }
    let healthBefore: number | undefined;
    try {
      healthBefore = await navi.getHealthFactor(senderAddress);
    } catch {
      healthBefore = undefined; // health read is best-effort for the preview
    }
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), healthBefore, isFixture: false };
  } catch (err) {
    throw new LendBuildError(`NAVI ${action} PTB construction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Suilend live path — @suilend/sdk (bundler-only, unverified here). [needs live-env]
// ---------------------------------------------------------------------------

async function buildSuilendLend(client: SuiClient, spec: LendSpec): Promise<LendBuildResult> {
  const { senderAddress, coinType, amountNative, action, obligationId } = spec;
  let suilend: typeof import("@suilend/sdk");
  try {
    suilend = await import("@suilend/sdk");
  } catch (err) {
    throw new LendBuildError(
      `Failed to load Suilend SDK (bundler-only): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  try {
    const SuilendClient = (suilend as { SuilendClient: { initialize: (...a: unknown[]) => Promise<unknown> } }).SuilendClient;
    const lc = (await SuilendClient.initialize(client as never)) as {
      depositIntoObligation: (sender: string, coinType: string, amount: string, tx: Transaction, obligationId?: string) => Promise<void>;
      repayIntoObligation: (sender: string, obligationId: string, coinType: string, amount: string, tx: Transaction) => Promise<void>;
    };
    const tx = new Transaction();
    tx.setSender(senderAddress);
    if (action === "deposit") {
      await lc.depositIntoObligation(senderAddress, coinType, amountNative.toString(), tx, obligationId);
    } else {
      if (!obligationId) throw new LendBuildError("Suilend repay requires an obligationId.");
      await lc.repayIntoObligation(senderAddress, obligationId, coinType, amountNative.toString(), tx);
    }
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: false };
  } catch (err) {
    if (err instanceof LendBuildError) throw err;
    throw new LendBuildError(`Suilend ${action} PTB construction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Coin selection helper — fetch + merge owned coins of a type, split the amount.
// ---------------------------------------------------------------------------

async function selectCoin(
  client: SuiClient,
  tx: Transaction,
  owner: string,
  coinType: string,
  amount: bigint,
) {
  const coins = await client.getCoins({ owner, coinType });
  if (!coins.data || coins.data.length === 0) {
    throw new LendBuildError(`No ${coinType} coins owned by ${owner} to lend.`);
  }
  const [primary, ...rest] = coins.data.map((c) => c.coinObjectId);
  if (rest.length > 0) tx.mergeCoins(tx.object(primary), rest.map((id) => tx.object(id)));
  return tx.splitCoins(tx.object(primary), [amount])[0];
}
