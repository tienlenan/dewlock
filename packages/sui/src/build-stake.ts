/**
 * Build an unsigned Aftermath liquid-staking PTB for afSUI (stake SUI → afSUI, unstake afSUI → SUI).
 *
 * WHY a separate builder from build-lend.ts: staking uses the Aftermath LSD SDK path
 * (staked_sui_vault::request_stake / request_unstake_atomic), not NAVI/Suilend. The Guardian
 * action-shape gate enforces distinct allowlist targets per verb, so lending and staking share
 * no MoveCall shape — mixing them would falsely pass the shape gate.
 *
 * WHY prebundled CJS via static require: aftermath-ts-sdk is ESM-only and sits behind a pnpm
 * symlink the Vercel serverless packager strips. Loaded from sdk-bundles/aftermath.cjs by a
 * STATIC relative require so Next's tracer ships it in the function — same rationale as
 * build-aftermath-swap.ts (loadAftermathSdk). Types still come from the real package.
 *
 * WHY tx.build({client}) on the live path: the SDK returns a @mysten/sui Transaction;
 * we build it to canonical BCS bytes + base64 for the Guardian. tx.serialize() emits JSON,
 * which the Guardian's Transaction.from(base64) would mis-decode (ULEB overflow).
 *
 * WHY SUI input uses tx.gas split + pinSuiGasPayment: native SUI is always the gas coin on
 * Sui. The Aftermath Staking SDK's fetchBuildStakeTx calls api.Coin().fetchCoinWithAmountTx
 * internally, which selects/merges SUI objects — the pin is applied AFTER the SDK builds
 * the transaction to ensure the gas coin covers both the stake amount and gas fees without
 * InsufficientGas.
 *
 * WHY isAtomic=true for unstake: the non-atomic path queues a redemption that resolves next
 * epoch (not instant). Atomic unstake uses Aftermath's reserve pool for instant SUI return.
 * Dewlock only supports instant (liquid) redemption — the spec says "instant redeem, no
 * native epoch delay." Atomic unstake may carry a small protocol fee but is the only path
 * that delivers SUI in the same transaction.
 *
 * Move targets emitted by the Aftermath LSD SDK (verified by runtime inspection):
 *  stake:   {lsd}::staked_sui_vault::request_stake_and_keep
 *  unstake: {lsd}::staked_sui_vault::request_unstake_atomic_and_keep
 * where lsd = 0x1575034d2729907aefca1ac757d6ccfcd3fc7e9e77927523c06007d8353ad836
 * (verified: af.Staking().stakingApi().addresses.packages.lsd at runtime).
 */

import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { pinSuiGasPayment, InsufficientGasCoverageError } from "./sui-gas-payment";

type SuiClient = SuiJsonRpcClient;
type AftermathSdk = typeof import("aftermath-ts-sdk");

export interface StakeSpec {
  senderAddress: string;
  /** Amount of SUI to stake, in MIST (native units). */
  amountNative: bigint;
}

export interface UnstakeSpec {
  senderAddress: string;
  /** Amount of afSUI to redeem (unstake), in native units (9 decimals). */
  afSuiAmountNative: bigint;
}

export interface StakeBuildResult {
  /** Serialized unsigned PTB in base64. */
  txBytes: string;
  isFixture: boolean;
}

export class StakeBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StakeBuildError";
  }
}

function isFixtureMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "fixture";
}

function loadAftermathSdk(): AftermathSdk {
  // STATIC require of the esbuild-prebundled CJS copy (sdk-bundles/aftermath.cjs). A static
  // relative require is followed by Next's tracer (and inlined into the route chunk), so the
  // SDK is present in the serverless function — unlike the bare ESM package, which sits behind
  // a pnpm symlink the Vercel packager strips ("Cannot find package") and is invisible to the
  // tracer when loaded via dynamic import. Types still come from the real package above.
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  return require("../sdk-bundles/aftermath.cjs") as AftermathSdk;
}

/**
 * Build an unsigned stake PTB: SUI → afSUI via Aftermath LSD.
 * Throws StakeBuildError on any SDK/RPC error — callers (Guardian) treat a throw as BLOCK.
 */
export async function buildStake(client: SuiClient, spec: StakeSpec): Promise<StakeBuildResult> {
  const { senderAddress, amountNative } = spec;

  if (amountNative <= 0n) {
    throw new StakeBuildError("Stake amount must be positive.");
  }

  if (isFixtureMode()) {
    // Placeholder PTB for demo — no real Move calls; UI shows the DEMO FIXTURE badge.
    // Build as TransactionKind (no gas/sender resolution) so no live client is needed.
    const tx = new Transaction();
    const bytes = await tx.build({ onlyTransactionKind: true });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: true };
  }

  return buildLiveStakePtb(client, spec);
}

/**
 * Build an unsigned unstake PTB: afSUI → SUI via Aftermath atomic unstake.
 * Uses isAtomic=true for instant SUI return (liquid; no epoch delay).
 * Throws StakeBuildError on any SDK/RPC error — callers (Guardian) treat a throw as BLOCK.
 */
export async function buildUnstake(client: SuiClient, spec: UnstakeSpec): Promise<StakeBuildResult> {
  const { afSuiAmountNative } = spec;

  if (afSuiAmountNative <= 0n) {
    throw new StakeBuildError("Unstake amount must be positive.");
  }

  if (isFixtureMode()) {
    const tx = new Transaction();
    const bytes = await tx.build({ onlyTransactionKind: true });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: true };
  }

  return buildLiveUnstakePtb(client, spec);
}

// ---------------------------------------------------------------------------
// Live paths — [needs live-env]
// ---------------------------------------------------------------------------

async function buildLiveStakePtb(client: SuiClient, spec: StakeSpec): Promise<StakeBuildResult> {
  const { senderAddress, amountNative } = spec;

  let mod: AftermathSdk;
  try {
    mod = loadAftermathSdk();
  } catch (err) {
    throw new StakeBuildError(
      `Failed to load Aftermath SDK: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const af = await mod.Aftermath.create({ network: "MAINNET" });
    const staking = af.Staking();

    // getStakeTransaction calls fetchBuildStakeTx internally, which:
    //   1. Creates a Transaction, sets sender.
    //   2. Calls api.Coin().fetchCoinWithAmountTx to select/merge SUI input.
    //   3. Calls stakeTx → request_stake_and_keep (the afSUI lands in sender's wallet).
    // validatorAddress is emitted DIRECTLY as a Move-call arg (tx.pure.address) with NO
    // default substitution — it must be a real active validator or request_add_stake aborts
    // on-chain. Aftermath delegates through its own validator; read it from the SDK addresses
    // so it tracks the protocol's current validator (don't hard-code). Fail-closed if absent.
    // stakingApi() is private in the SDK's published types but is the only accessor for the
    // protocol addresses; reach it through a narrow structural cast (same cast discipline as
    // the Transaction casts below). Runtime-verified path: addresses.objects.aftermathValidator.
    const aftermathValidator: string | undefined = (
      staking as unknown as {
        stakingApi(): { addresses?: { objects?: { aftermathValidator?: string } } };
      }
    ).stakingApi()?.addresses?.objects?.aftermathValidator;
    if (!aftermathValidator || !/^0x[0-9a-fA-F]{64}$/.test(aftermathValidator)) {
      throw new StakeBuildError(
        "Aftermath validator address unavailable from the SDK — cannot build a valid stake. Blocking (fail-closed).",
      );
    }
    const resultTx = await staking.getStakeTransaction({
      walletAddress: senderAddress,
      suiStakeAmount: amountNative,
      validatorAddress: aftermathValidator,
    }) as unknown as Transaction;

    // Native-SUI staking splits from the gas coin — pin gas payment to SUI coins covering
    // stake amount + gas so a fragmented wallet can't land on a gas coin too small.
    await pinSuiGasPayment(client, resultTx, senderAddress, amountNative);

    const bytes = await resultTx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: false };
  } catch (err) {
    if (err instanceof StakeBuildError) throw err;
    if (err instanceof InsufficientGasCoverageError) throw err;
    throw new StakeBuildError(
      `Aftermath stake PTB construction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function buildLiveUnstakePtb(client: SuiClient, spec: UnstakeSpec): Promise<StakeBuildResult> {
  const { senderAddress, afSuiAmountNative } = spec;

  let mod: AftermathSdk;
  try {
    mod = loadAftermathSdk();
  } catch (err) {
    throw new StakeBuildError(
      `Failed to load Aftermath SDK: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const af = await mod.Aftermath.create({ network: "MAINNET" });
    const staking = af.Staking();

    // getUnstakeTransaction calls fetchBuildUnstakeTx internally, which:
    //   1. Calls api.Coin().fetchCoinWithAmountTx to select/merge afSUI input.
    //   2. isAtomic=true → calls atomicUnstakeTx → request_unstake_atomic_and_keep.
    //      SUI is returned in the same transaction (instant, no epoch wait).
    //   isAtomic=false → request_unstake (queued, resolved next epoch) — NOT supported.
    const resultTx = await staking.getUnstakeTransaction({
      walletAddress: senderAddress,
      afSuiUnstakeAmount: afSuiAmountNative,
      isAtomic: true,
    }) as unknown as Transaction;

    const bytes = await resultTx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: false };
  } catch (err) {
    if (err instanceof StakeBuildError) throw err;
    if (err instanceof InsufficientGasCoverageError) throw err;
    throw new StakeBuildError(
      `Aftermath unstake PTB construction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
