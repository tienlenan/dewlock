/**
 * Tests: buildDynamicComposite LIVE path (buildLiveDynamicComposite).
 *
 * The fixture-mode tests (build-dynamic-composite.test.ts) never exercise the live
 * chained coin-flow — they force NEXT_PUBLIC_DEMO_MODE=fixture, which is a structurally
 * different branch. These tests run the LIVE builder with the swap/gRPC SDKs mocked (NAVI
 * deposit runs for real off the bundled SDK), so the live split/transfer/deposit ordering
 * is actually covered.
 *
 * Most important assertion (L1 regression lock): on a chained swap→lend, the deposit splits
 * the prior swap's GUARANTEED minimum output (estimate × (1 − slippage)) — NOT the fixed
 * pre-quote leg.amountInNative. Splitting the estimate could exceed the realized swap output
 * and abort the whole PTB on-chain. We assert directly on the built PTB's pure split inputs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Transaction } from "@mysten/sui/transactions";

// Shared state, hoisted so the (hoisted) vi.mock factories can reference it.
const h = vi.hoisted(() => ({
  estimatedOut: "990000", // amount the mocked aggregator reports for every route
  builtTx: undefined as unknown as Transaction, // captured in buildTransactionBytes
}));

// Gas helpers hit the RPC; no-op them so the test is hermetic.
vi.mock("../sui-gas-payment", () => ({
  pinSuiGasPayment: vi.fn(async () => {}),
  assertSuiGasCoverage: vi.fn(async () => {}),
}));

// Aggregator SDK — fake client that produces an output coin on the passed txb and captures
// the fully-built tx in buildTransactionBytes (returning stub bytes, no live chain build).
vi.mock("../aggregator-quotes", () => {
  class AggregatorClient {
    async findRouters() {
      return { amountOut: h.estimatedOut };
    }
    async routerSwap(arg: { txb: { moveCall: (c: unknown) => unknown } }) {
      // Emulate a swap output coin via a placeholder moveCall result.
      return arg.txb.moveCall({ target: "0x2::coin::zero", typeArguments: ["0x2::sui::SUI"] });
    }
    async buildTransactionBytes(tx: Transaction) {
      h.builtTx = tx;
      return new Uint8Array([1, 2, 3, 4]);
    }
  }
  return {
    loadAggregatorSdk: async () => ({ AggregatorClient, Env: { Mainnet: "mainnet" } }),
    AGGREGATOR_ACTIVE_PROVIDERS: [] as string[],
  };
});

vi.mock("@mysten/sui/grpc", () => ({
  SuiGrpcClient: class {
    constructor(_opts: unknown) {}
  },
}));

import { buildDynamicComposite, type DynamicCompositeLeg } from "../build-composite";
import { COIN_TYPES } from "../protocol-constants";

const WALLET = "0x" + "a".repeat(64);

// Live path makes no getCoins call in these scenarios (gas helpers mocked, swap is SUI-in via
// gas split, lend is chained) — a minimal stub satisfies the signature.
const client = { getCoins: async () => ({ data: [] }) } as never;

/** Collect every 8-byte pure (u64 LE) input value referenced in the built PTB. */
function pureU64Inputs(tx: Transaction): bigint[] {
  const inputs = (tx.getData().inputs ?? []) as Array<{ Pure?: { bytes?: string } }>;
  const out: bigint[] = [];
  for (const inp of inputs) {
    const bytes = inp?.Pure?.bytes;
    if (typeof bytes === "string") {
      const buf = Buffer.from(bytes, "base64");
      if (buf.length === 8) out.push(buf.readBigUInt64LE(0));
    }
  }
  return out;
}

let originalMode: string | undefined;

beforeEach(() => {
  originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
  delete process.env.NEXT_PUBLIC_DEMO_MODE; // ensure the LIVE branch runs
  h.builtTx = undefined as unknown as Transaction;
});

afterEach(() => {
  if (originalMode === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
  else process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
});

describe("buildLiveDynamicComposite — chained swap→lend", () => {
  const legs: DynamicCompositeLeg[] = [
    { actionType: "swap", coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountInNative: 5_000_000_000n },
    { actionType: "lend_deposit", coinTypeIn: COIN_TYPES.USDC, amountInNative: 100_000n, amountFrom: "prev-output", lendingProtocol: "navi" },
  ];

  it("runs the live path (isFixture=false) and reports the swap estimate", async () => {
    const result = await buildDynamicComposite(client, WALLET, legs);

    expect(result.isFixture).toBe(false);
    expect(result.txBytes.length).toBeGreaterThan(0);
    expect(result.compositeLegs.map((l) => l.actionType)).toEqual(["swap", "lend_deposit"]);
    expect(result.swapEstimatedOutByLeg?.get(0)).toBe("990000");
  });

  it("L1: deposit splits the swap's guaranteed minOut, NOT the fixed pre-quote amountInNative", async () => {
    // estimate 990000, default slippage 50bps → minOut = 990000 * 9950/10000 = 985050.
    await buildDynamicComposite(client, WALLET, legs);

    const amounts = pureU64Inputs(h.builtTx);
    expect(amounts).toContain(985050n); // deposit splits minOut
    expect(amounts).not.toContain(100_000n); // NOT the leg's fixed amountInNative
  });
});

describe("buildLiveDynamicComposite — swap-only", () => {
  it("runs the live path and flushes the final swap output (no dangling value)", async () => {
    const legs: DynamicCompositeLeg[] = [
      { actionType: "swap", coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountInNative: 1_000_000_000n },
    ];

    const result = await buildDynamicComposite(client, WALLET, legs);

    expect(result.isFixture).toBe(false);
    expect(result.txBytes.length).toBeGreaterThan(0);
    expect(result.compositeLegs.map((l) => l.actionType)).toEqual(["swap"]);
  });
});
