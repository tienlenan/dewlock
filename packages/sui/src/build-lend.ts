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
import { SuiGrpcClient } from "@mysten/sui/grpc";
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

// The NAVI/Suilend SDKs are ESM-only (no CJS export). This package compiles to
// CommonJS, so a plain `await import(pkg)` would be downleveled by tsc to require()
// and fail on an ESM-only package ("No exports main defined"). Wrapping import in a
// Function keeps it a TRUE native dynamic import at runtime — opaque to tsc AND to the
// bundler's static analysis — so Node's ESM loader handles it.
const esmImport = new Function("s", "return import(s)") as <T = unknown>(s: string) => Promise<T>;

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
    // Load the esbuild-prebundled, self-contained ESM copy (sdk-bundles/navi.mjs) via a
    // stable @dewlock/sui export — NOT the bare "@naviprotocol/lending" package, which on
    // Vercel sits behind a pnpm symlink the serverless packager strips (→ "Cannot find
    // package"). The bundle is force-included by file path. Types stay from the real package.
    navi = await esmImport<typeof import("@naviprotocol/lending")>("@dewlock/sui/navi-bundle");
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

  // SuilendClient + the market constants live on the `@suilend/sdk/client` SUBPATH
  // (the root does not re-export them). Suilend is bundler-only (directory imports),
  // so it stays a plain dynamic import (bundled by Next), NOT a native import().
  // Load the PRE-BUNDLED Suilend client via its package export — a clean-ESM file whose
  // directory imports esbuild already resolved, so native import() works (the raw
  // @suilend/sdk loads as an empty module under Node/Turbopack). `@mysten/*` stayed
  // external in the bundle, so it uses the repo's v2 client. Imported by package
  // specifier (not __dirname, which Next rewrites to a virtual path).
  let raw: Record<string, unknown>;
  try {
    raw = await esmImport<Record<string, unknown>>("@dewlock/sui/suilend-client-bundle");
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
    const grpc = new SuiGrpcClient({
      network: "mainnet",
      url: process.env.SUI_RPC_URL ?? "https://fullnode.mainnet.sui.io:443",
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
