/**
 * Build an unsigned lending PTB (deposit / repay / borrow / withdraw) for NAVI or Suilend.
 *
 * Deposit/repay are health-IMPROVING: coin leaves the wallet → the Guardian's
 * dry-run net-outflow cap bounds the USD value automatically, and the trusted-price
 * gate blocks an unpriced collateral coin.
 *
 * Borrow/withdraw are health-REDUCING: the Guardian runs a fail-closed post-tx
 * health-factor gate (checkPostTxHealthFactor) and a dedicated borrow-inflow value
 * cap BEFORE this builder's result reaches the user. A borrow is an inflow to the
 * wallet, so the net-outflow cap structurally cannot see it — the borrow cap
 * in guardian.ts is the sole backstop for borrow value.
 *
 * WHY prebundled CJS via static require: the NAVI/Suilend SDKs are ESM-only (Suilend is
 * even bundler-only — directory imports that load as an empty module under raw Node) and
 * sit behind pnpm symlinks the Vercel serverless packager strips. They're loaded from
 * sdk-bundles/*.cjs by STATIC relative require so Next's tracer ships them in the
 * function (a bare/dynamic import would not resolve at runtime). [needs live-env].
 */

import { Transaction } from "@mysten/sui/transactions";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { COIN_TYPES } from "./allowlist";
import { pinSuiGasPayment } from "./sui-gas-payment";

type SuiClient = SuiJsonRpcClient;

export type LendProtocol = "navi" | "suilend";
export type LendAction = "deposit" | "repay" | "borrow" | "withdraw";

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

// The NAVI/Suilend SDKs are ESM-only and sit behind pnpm symlinks the Vercel serverless
// packager strips. They're loaded from esbuild-prebundled CJS copies (sdk-bundles/*.cjs)
// via STATIC relative require() in the build functions below — so Next's tracer follows
// them and they ship in the function (a bare/dynamic import would not resolve at runtime).

/**
 * Build an unsigned deposit/repay/borrow/withdraw PTB. Throws LendBuildError on
 * any error — callers (Guardian) treat a throw as BLOCK.
 */
export async function buildLend(client: SuiClient, spec: LendSpec): Promise<LendBuildResult> {
  const { senderAddress, coinType, amountNative, action } = spec;

  if (!Object.values(COIN_TYPES).includes(coinType as (typeof COIN_TYPES)[keyof typeof COIN_TYPES])) {
    throw new LendBuildError(`Unknown coin type "${coinType}" — only canonical types are permitted.`);
  }
  if (amountNative <= 0n) throw new LendBuildError("Lending amount must be positive.");
  if (action !== "deposit" && action !== "repay" && action !== "borrow" && action !== "withdraw") {
    throw new LendBuildError(`Unsupported lend action "${action}" — only deposit/repay/borrow/withdraw are buildable.`);
  }
  // Borrow/withdraw are NAVI-only (the Guardian's post-tx health-factor gate is
  // NAVI-specific; Suilend has no borrow/withdraw builder). Reject as a validation
  // guard — before fixture mode and the Suilend branch — so a borrow/withdraw can
  // never fall into Suilend's deposit/repay path in any mode.
  if ((action === "borrow" || action === "withdraw") && spec.protocol !== "navi") {
    throw new LendBuildError(
      `"${action}" is only buildable on NAVI — "${spec.protocol}" supports deposit/repay only.`,
    );
  }

  if (isFixtureMode()) {
    // Placeholder PTB for demo — no real Move calls; UI shows the DEMO FIXTURE badge.
    // Build as TransactionKind (no gas/sender resolution) so no live client is needed —
    // unit tests pass a stub client and the Vercel demo path has no chain connection.
    const tx = new Transaction();
    const bytes = await tx.build({ onlyTransactionKind: true });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: true };
  }

  if (spec.protocol === "navi") {
    if (action === "borrow") return buildNaviBorrow(client, spec);
    if (action === "withdraw") return buildNaviWithdraw(client, spec);
    return buildNaviLend(client, spec);
  }
  return buildSuilendLend(client, spec);
}

// ---------------------------------------------------------------------------
// NAVI live path — @naviprotocol/lending (v2-native). [needs live-env]
// ---------------------------------------------------------------------------

async function buildNaviLend(client: SuiClient, spec: LendSpec): Promise<LendBuildResult> {
  const { senderAddress, coinType, amountNative, action } = spec;
  let navi: typeof import("@naviprotocol/lending");
  try {
    // STATIC require of the esbuild-prebundled CJS copy (sdk-bundles/navi.cjs). A static
    // relative require is followed by Next's tracer (and inlined into the route chunk), so
    // the SDK ships in the serverless function — unlike the bare "@naviprotocol/lending"
    // package, which on Vercel sits behind a pnpm symlink the packager strips ("Cannot
    // find package") and is invisible to the tracer via dynamic import. Types stay real.
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    navi = require("../sdk-bundles/navi.cjs") as typeof import("@naviprotocol/lending");
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
    // Native-SUI deposits/repays split from tx.gas — pin gas to coins covering amount + gas.
    if (isSui) await pinSuiGasPayment(client, tx, senderAddress, amountNative);
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), healthBefore, isFixture: false };
  } catch (err) {
    throw new LendBuildError(`NAVI ${action} PTB construction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// NAVI borrow path — borrowCoinPTB emits incentive_v3::borrow_v2 (v2 protocol).
// The borrowed coin is an inflow to the wallet; the Guardian's borrow-inflow value
// cap and post-tx HF gate run BEFORE this builder is called. [needs live-env]
// ---------------------------------------------------------------------------

/**
 * Build an unsigned NAVI borrow PTB. The borrowed coin lands in the signer's wallet.
 * For native SUI: borrowCoinPTB returns a Balance — we wrap it to a Coin and transfer
 * to the sender, then pin gas so there is enough coverage. [needs live-env]
 */
async function buildNaviBorrow(client: SuiClient, spec: LendSpec): Promise<LendBuildResult> {
  const { senderAddress, coinType, amountNative } = spec;
  let navi: typeof import("@naviprotocol/lending");
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    navi = require("../sdk-bundles/navi.cjs") as typeof import("@naviprotocol/lending");
  } catch (err) {
    throw new LendBuildError(`Failed to load NAVI SDK: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);
    const options = { account: senderAddress, amount: Number(amountNative) } as never;
    // borrowCoinPTB returns a Coin object containing the borrowed funds. Transfer it to
    // the signer so the borrowed coin materialises in their wallet after execution.
    const borrowedCoin = await navi.borrowCoinPTB(tx, coinType, amountNative as never, options);
    tx.transferObjects([borrowedCoin as never], senderAddress);
    // Native SUI borrows come back via the gas-coin budget; pin gas to cover borrow + fees.
    const isSui = coinType === COIN_TYPES.SUI;
    if (isSui) await pinSuiGasPayment(client, tx, senderAddress, amountNative);
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: false };
  } catch (err) {
    throw new LendBuildError(`NAVI borrow PTB construction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// NAVI withdraw path — withdrawCoinPTB emits incentive_v3::withdraw_v2 (v2 protocol).
// The withdrawn coin is an inflow to the wallet from the NAVI pool. [needs live-env]
// ---------------------------------------------------------------------------

/**
 * Build an unsigned NAVI withdraw PTB. The withdrawn collateral returns to the signer's
 * wallet. For native SUI: withdrawCoinPTB wraps the Balance to a Coin internally via
 * 0x2::coin::from_balance; we transfer the result to the sender. [needs live-env]
 */
async function buildNaviWithdraw(client: SuiClient, spec: LendSpec): Promise<LendBuildResult> {
  const { senderAddress, coinType, amountNative } = spec;
  let navi: typeof import("@naviprotocol/lending");
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    navi = require("../sdk-bundles/navi.cjs") as typeof import("@naviprotocol/lending");
  } catch (err) {
    throw new LendBuildError(`Failed to load NAVI SDK: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);
    const options = { account: senderAddress, amount: Number(amountNative) } as never;
    // withdrawCoinPTB returns a Coin<T> (wraps Balance<T> internally via coin::from_balance).
    // Transfer it to the signer so the collateral materialises in their wallet after execution.
    const withdrawnCoin = await navi.withdrawCoinPTB(tx, coinType, amountNative as never, options);
    tx.transferObjects([withdrawnCoin as never], senderAddress);
    // SUI withdraws from NAVI return the gas coin indirectly; pin gas to cover fees.
    const isSui = coinType === COIN_TYPES.SUI;
    if (isSui) await pinSuiGasPayment(client, tx, senderAddress, 0n);
    const bytes = await tx.build({ client: client as unknown as ClientWithCoreApi });
    return { txBytes: Buffer.from(bytes).toString("base64"), isFixture: false };
  } catch (err) {
    throw new LendBuildError(`NAVI withdraw PTB construction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Suilend live path — @suilend/sdk (bundler-only, unverified here). [needs live-env]
// ---------------------------------------------------------------------------

// Minimal shapes for the @suilend/sdk 3.x client API we use (verified from its d.ts).
interface SuilendClientApi {
  createObligation: (tx: Transaction) => unknown;
  deposit: (sendCoin: unknown, coinType: string, obligationOwnerCap: unknown, tx: Transaction) => unknown;
  repayIntoObligation: (ownerId: string, obligationId: string, coinType: string, value: string, tx: Transaction) => Promise<unknown>;
}
interface SuilendClientModule {
  SuilendClient: { initialize: (lendingMarketId: string, lendingMarketType: string, grpc: unknown) => Promise<SuilendClientApi> };
  LENDING_MARKET_ID: string;
  LENDING_MARKET_TYPE: string;
}

async function buildSuilendLend(client: SuiClient, spec: LendSpec): Promise<LendBuildResult> {
  const { senderAddress, coinType, amountNative, action, obligationId } = spec;

  // SuilendClient + the market constants live on the `@suilend/sdk/client` SUBPATH (the
  // root does not re-export them). The raw @suilend/sdk uses bundler-only directory
  // imports that load as an empty module under Node/Turbopack, so we STATIC require the
  // esbuild-prebundled CJS copy (sdk-bundles/suilend-client.cjs) whose directory imports
  // esbuild already resolved. A static relative require is traced + included by Next, so
  // it ships in the serverless function. `@mysten/*` stayed external (repo's v2 client).
  let raw: Record<string, unknown>;
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    raw = require("../sdk-bundles/suilend-client.cjs") as Record<string, unknown>;
  } catch (err) {
    throw new LendBuildError(
      `Failed to load the vendored Suilend client: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    // Resolve through the ESM/CJS interop (named exports may land under `.default`).
    const def = (raw.default as Record<string, unknown> | undefined) ?? {};
    const pick = <T,>(k: string): T => (raw[k] ?? def[k]) as T;
    const SuilendClient = pick<SuilendClientModule["SuilendClient"]>("SuilendClient");
    const LENDING_MARKET_ID = pick<string>("LENDING_MARKET_ID");
    const LENDING_MARKET_TYPE = pick<string>("LENDING_MARKET_TYPE");
    if (!SuilendClient || typeof SuilendClient.initialize !== "function") {
      throw new LendBuildError(
        `Suilend client unavailable from the vendored bundle — keys: [${Object.keys(raw).join(",")}] default: [${Object.keys(def).join(",")}]`,
      );
    }
    if (typeof LENDING_MARKET_ID !== "string" || typeof LENDING_MARKET_TYPE !== "string") {
      throw new LendBuildError(
        `Suilend market constants missing — id:${typeof LENDING_MARKET_ID} type:${typeof LENDING_MARKET_TYPE}`,
      );
    }

    // The 3.x initialize takes (lendingMarketId, lendingMarketType, SuiGrpcClient).
    // SuiGrpcClient reads `baseUrl` (NOT `url`) for its gRPC-web transport — passing `url`
    // leaves the transport base undefined, so every request crashes and the lending-market
    // reserves come back unparsed (reserve.coinType.name undefined → findReserveArrayIndex
    // fails). Use the gRPC endpoint (SUI_GRPC_URL); the JSON-RPC SUI_RPC_URL may be a keyed
    // provider that does not serve gRPC-web.
    const grpc = new SuiGrpcClient({
      network: "mainnet",
      baseUrl: process.env.SUI_GRPC_URL ?? "https://fullnode.mainnet.sui.io:443",
    });
    const lc = await SuilendClient.initialize(LENDING_MARKET_ID, LENDING_MARKET_TYPE, grpc);

    const tx = new Transaction();
    tx.setSender(senderAddress);

    if (action === "deposit") {
      // Provide the input coin (SUI uses the gas coin; others are selected + merged).
      const isSui = coinType === COIN_TYPES.SUI;
      const coin = isSui
        ? tx.splitCoins(tx.gas, [amountNative])[0]
        : await selectCoin(client, tx, senderAddress, coinType, amountNative);
      // Fresh obligation per deposit (the owner cap is returned), then deposit into it
      // and transfer the cap to the user so they own the position.
      const ownerCap = lc.createObligation(tx);
      lc.deposit(coin, coinType, ownerCap, tx);
      tx.transferObjects([ownerCap as Parameters<Transaction["transferObjects"]>[0][number]], senderAddress);
    } else {
      if (!obligationId) throw new LendBuildError("Suilend repay requires an existing obligationId.");
      const isSui = coinType === COIN_TYPES.SUI;
      const coin = isSui
        ? tx.splitCoins(tx.gas, [amountNative])[0]
        : await selectCoin(client, tx, senderAddress, coinType, amountNative);
      void coin;
      await lc.repayIntoObligation(senderAddress, obligationId, coinType, amountNative.toString(), tx);
    }

    // Native-SUI deposits split from tx.gas — pin gas to coins covering amount + gas.
    if (coinType === COIN_TYPES.SUI) await pinSuiGasPayment(client, tx, senderAddress, amountNative);
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
