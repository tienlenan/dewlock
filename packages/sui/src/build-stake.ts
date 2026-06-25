/**
 * Build unsigned liquid-staking PTBs for afSUI (Aftermath SDK) and haSUI (Haedal direct-PTB).
 *
 * Provider discriminator: "afsui" | "hasui". The caller (Guardian / prepareTrade) passes the
 * lstProvider field from the TradeProposal. Unknown provider → StakeBuildError (fail-closed).
 *
 * WHY a separate builder from build-lend.ts: staking uses the Aftermath LSD SDK path
 * (staked_sui_vault::request_stake / request_unstake_atomic), not NAVI/Suilend. The Guardian
 * action-shape gate enforces distinct allowlist targets per verb, so lending and staking share
 * no MoveCall shape — mixing them would falsely pass the shape gate.
 *
 * afSUI path:
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
 * afSUI Move targets (Aftermath LSD SDK, verified by runtime inspection):
 *  stake:   {lsd}::staked_sui_vault::request_stake_and_keep
 *  unstake: {lsd}::staked_sui_vault::request_unstake_atomic_and_keep
 * where lsd = 0x1575034d2729907aefca1ac757d6ccfcd3fc7e9e77927523c06007d8353ad836
 * (verified: af.Staking().stakingApi().addresses.packages.lsd at runtime).
 *
 * haSUI path (DIRECT-PTB, no SDK, no new bundle):
 * Targets captured from a real mainnet request_stake txn (see HAEDAL_PACKAGE / HAEDAL_STAKING_OBJECT):
 *  stake:   interface::request_stake(&mut SuiSystemState@0x5, &mut Staking, Coin<SUI>, address)
 *  unstake: interface::request_unstake_instant(&mut Staking, Coin<HASUI>)
 * SUI for stake is split from tx.gas (same as afSUI path: SUI is always the gas coin).
 * haSUI for unstake is selected from wallet coin objects (merge+split pattern, no gas pin).
 * [needs mainnet verification] direct-PTB built from captured request_stake/request_unstake_instant
 * signatures; not exercised by unit tests.
 */

import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { pinSuiGasPayment, InsufficientGasCoverageError } from "./sui-gas-payment";
import { HAEDAL_PACKAGE, HAEDAL_STAKING_OBJECT, COIN_TYPES } from "./protocol-constants";

type SuiClient = SuiJsonRpcClient;
type AftermathSdk = typeof import("aftermath-ts-sdk");

/** Which LST provider to use for stake/unstake. */
export type LstProvider = "afsui" | "hasui";

export interface StakeSpec {
  senderAddress: string;
  /** Amount of SUI to stake, in MIST (native units). */
  amountNative: bigint;
  /** LST provider discriminator. Defaults to "afsui" for backward compatibility. */
  lstProvider?: LstProvider;
}

export interface UnstakeSpec {
  senderAddress: string;
  /** Amount of LST to redeem (unstake), in native units (9 decimals). */
  afSuiAmountNative: bigint;
  /** LST provider discriminator. Defaults to "afsui" for backward compatibility. */
  lstProvider?: LstProvider;
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
 * Build an unsigned stake PTB: SUI → afSUI (Aftermath) or SUI → haSUI (Haedal).
 * Throws StakeBuildError on any SDK/RPC error — callers (Guardian) treat a throw as BLOCK.
 */
export async function buildStake(client: SuiClient, spec: StakeSpec): Promise<StakeBuildResult> {
  const { amountNative, lstProvider = "afsui" } = spec;

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

  if (lstProvider === "hasui") {
    return buildHaedalStakePtb(client, spec);
  }
  if (lstProvider === "afsui") {
    return buildLiveStakePtb(client, spec);
  }
  throw new StakeBuildError(`Unknown lstProvider "${lstProvider}". Must be "afsui" or "hasui".`);
}

/**
 * Build an unsigned unstake PTB: afSUI → SUI (Aftermath atomic) or haSUI → SUI (Haedal instant).
 * Throws StakeBuildError on any SDK/RPC error — callers (Guardian) treat a throw as BLOCK.
 */
export async function buildUnstake(client: SuiClient, spec: UnstakeSpec): Promise<StakeBuildResult> {
  const { afSuiAmountNative, lstProvider = "afsui" } = spec;

  if (afSuiAmountNative <= 0n) {
    throw new StakeBuildError("Unstake amount must be positive.");
  }

  if (isFixtureMode()) {
    const tx = new Transaction();
    const bytes = await tx.build({ onlyTransactionKind: true });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: true };
  }

  if (lstProvider === "hasui") {
    return buildHaedalUnstakePtb(client, spec);
  }
  if (lstProvider === "afsui") {
    return buildLiveUnstakePtb(client, spec);
  }
  throw new StakeBuildError(`Unknown lstProvider "${lstProvider}". Must be "afsui" or "hasui".`);
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

// ---------------------------------------------------------------------------
// Haedal direct-PTB paths — [needs mainnet verification]
//
// Direct-PTB built from captured request_stake/request_unstake_instant entry
// signatures; not exercised by unit tests. Re-verify before a live demo if
// Haedal upgrades its package (HAEDAL_PACKAGE / HAEDAL_STAKING_OBJECT).
// ---------------------------------------------------------------------------

/**
 * Build an unsigned haSUI stake PTB: SUI → haSUI via Haedal interface::request_stake.
 *
 * PTB shape (direct MoveCall — no SDK):
 *   1. splitCoins(tx.gas, [amountNative])  → suiCoin (SUI split from gas)
 *   2. moveCall(interface::request_stake,  args=[SuiSystemState@0x5, Staking, suiCoin, sender])
 * haSUI is sent to recipient (sender) by the Move function — no TransferObjects needed.
 * Gas is pinned AFTER build (pinSuiGasPayment) to cover stake amount + fees without InsufficientGas.
 *
 * [needs mainnet verification] direct-PTB built from captured signatures; not unit-tested live.
 */
async function buildHaedalStakePtb(client: SuiClient, spec: StakeSpec): Promise<StakeBuildResult> {
  const { senderAddress, amountNative } = spec;

  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);

    // Split SUI from gas coin (SUI is always the gas coin on Sui).
    const [suiCoin] = tx.splitCoins(tx.gas, [amountNative]);

    // interface::request_stake(&mut SuiSystemState@0x5, &mut Staking, Coin<SUI>, address)
    tx.moveCall({
      target: `${HAEDAL_PACKAGE}::interface::request_stake`,
      arguments: [
        tx.object("0x0000000000000000000000000000000000000000000000000000000000000005"),
        tx.object(HAEDAL_STAKING_OBJECT),
        suiCoin,
        tx.pure.address(senderAddress),
      ],
    });

    // Pin gas payment: ensure the gas coin covers both stake amount and fees.
    await pinSuiGasPayment(client, tx, senderAddress, amountNative);

    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: false };
  } catch (err) {
    if (err instanceof StakeBuildError) throw err;
    if (err instanceof InsufficientGasCoverageError) throw err;
    throw new StakeBuildError(
      `Haedal stake PTB construction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Build an unsigned haSUI unstake PTB: haSUI → SUI via Haedal interface::request_unstake_instant.
 *
 * PTB shape (direct MoveCall — no SDK):
 *   1. select/merge haSUI coins from wallet → haSuiCoin
 *   2. splitCoins(haSuiCoin, [amountNative])   → exactHaSui
 *   3. moveCall(interface::request_unstake_instant, args=[Staking, exactHaSui])
 * SUI is sent to sender by the Move function. Gas is paid from a separate SUI coin (no pin needed).
 *
 * [needs mainnet verification] direct-PTB built from captured signatures; not unit-tested live.
 */
async function buildHaedalUnstakePtb(client: SuiClient, spec: UnstakeSpec): Promise<StakeBuildResult> {
  const { senderAddress, afSuiAmountNative } = spec;

  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);

    // Select haSUI coin objects from the wallet (merge if fragmented, then split exact amount).
    const haSuiCoinObj = await selectHaSuiCoin(client, tx, senderAddress, afSuiAmountNative);

    // interface::request_unstake_instant(&mut Staking, Coin<HASUI>)
    tx.moveCall({
      target: `${HAEDAL_PACKAGE}::interface::request_unstake_instant`,
      arguments: [
        tx.object(HAEDAL_STAKING_OBJECT),
        haSuiCoinObj,
      ],
    });

    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: false };
  } catch (err) {
    if (err instanceof StakeBuildError) throw err;
    if (err instanceof InsufficientGasCoverageError) throw err;
    throw new StakeBuildError(
      `Haedal unstake PTB construction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Select (and optionally merge) haSUI coins from the wallet, then split the exact amount needed.
 * Mirrors the selectCoin pattern from build-lend.ts.
 */
async function selectHaSuiCoin(
  client: SuiClient,
  tx: Transaction,
  owner: string,
  amount: bigint,
) {
  const coins = await client.getCoins({ owner, coinType: COIN_TYPES.HASUI });
  if (!coins.data || coins.data.length === 0) {
    throw new StakeBuildError(`No haSUI coins owned by ${owner} to unstake.`);
  }
  const [primary, ...rest] = coins.data.map((c) => c.coinObjectId);
  if (rest.length > 0) tx.mergeCoins(tx.object(primary), rest.map((id) => tx.object(id)));
  return tx.splitCoins(tx.object(primary), [amount])[0];
}
