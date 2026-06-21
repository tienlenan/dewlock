/**
 * Tests: structural PTB-shape gate + dry-run net-outflow cap (Phase-1 hardening).
 *
 * Closes two attacks the per-target allowlist gate alone misses:
 *  1. Composition bypass — a declared "swap" PTB that also smuggles an allowlisted
 *     add_liquidity (a second value-mover) must BLOCK on the shape gate.
 *  2. Under-declared outflow — value is taken from the dry-run's ACTUAL net
 *     balance deltas, not the self-declared amount; a PTB that moves more than
 *     declared, or more than the cap, BLOCKs. Unpriced outflow → fail-closed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import {
  CETUS_CLMM_PACKAGE,
  CETUS_CLMM_PACKAGE_V2,
  DEEPBOOK_PACKAGE,
  COIN_TYPES,
} from "../allowlist";
import type { DryRunResult } from "@dewlock/sui/dry-run";

// Mock the @dewlock/sui root so guardianCheck's dryRunTransaction is controllable.
// The guardian imports ONLY { dryRunTransaction, DryRunFailedError } from the root;
// allowlist/quotes-source come from their own subpaths (not mocked).
vi.mock("@dewlock/sui", async () => {
  // Real, dependency-free capObjectsForPreview (dry-run subpath) so the mocked root
  // still satisfies guardian's preview compose; dryRunTransaction stays controllable.
  const { capObjectsForPreview } = await vi.importActual<typeof import("@dewlock/sui/dry-run")>(
    "@dewlock/sui/dry-run",
  );
  return {
    dryRunTransaction: vi.fn(),
    DryRunFailedError: class DryRunFailedError extends Error {},
    capObjectsForPreview,
  };
});

import { dryRunTransaction } from "@dewlock/sui";
import { checkActionShape, checkAllowlist, computeNetOutflowUsd, guardianCheck } from "../guardian";
import type { TradeProposal } from "../guardian";

const mockDryRun = dryRunTransaction as unknown as import("vitest").Mock<
  (client: unknown, txBytes: string) => Promise<DryRunResult>
>;

const WALLET = "0x" + "a".repeat(64);
const RECIPIENT = "0x" + "c".repeat(64);

// Produce REAL full-tx BCS bytes that round-trip through Transaction.from().
// Manual gas config + pure-only args means tx.build() needs no client/RPC.
async function realBytes(populate: (tx: Transaction) => void): Promise<string> {
  const tx = new Transaction();
  tx.setSender(WALLET);
  tx.setGasBudget(50_000_000n);
  tx.setGasPrice(1000n);
  tx.setGasPayment([
    { objectId: "0x" + "d".repeat(64), version: "1", digest: "1".repeat(32) },
  ]);
  populate(tx);
  const bytes = await tx.build();
  return Buffer.from(bytes).toString("base64");
}

/** Minimal parseable PTB (no MoveCalls) — content is irrelevant when dry-run is mocked. */
function emptyKindBytes(): Promise<string> {
  return realBytes(() => {});
}

function ptbWithCalls(targets: string[]): Promise<string> {
  return realBytes((tx) => {
    for (const t of targets) {
      tx.moveCall({
        target: t as `${string}::${string}::${string}`,
        typeArguments: [COIN_TYPES.SUI, COIN_TYPES.USDC],
        arguments: [],
      });
    }
  });
}

function baseProposal(overrides: Partial<TradeProposal>): TradeProposal {
  return {
    txBytes: "",
    walletAddress: WALLET,
    actionLabel: "test",
    actionType: "transfer",
    coinTypeIn: COIN_TYPES.USDC,
    amountInNative: 2_000_000n, // $2 declared
    argProvenance: { amount: "user_turn", recipient: "user_turn", coinType: "user_turn" },
    dailyUsdSpentSoFar: 0,
    recipientAddress: RECIPIENT,
    ...overrides,
  };
}

const stubClient = {} as Parameters<typeof guardianCheck>[1];

// ---------------------------------------------------------------------------
// Aggregator dynamic-package swap route (per-route, upgradeable integration pkg)
// The live router emits a per-DEX integration package that is NOT statically
// enumerable; swap-route calls are matched by module::function signature so a
// multi-venue route (e.g. a DeepBook leg) is not falsely refused.
// ---------------------------------------------------------------------------

describe("aggregator swap — package-agnostic route calls", () => {
  // A per-route integration package that is NOT in any static allowlist.
  const DYN = "0x" + "9".repeat(64);
  const ROUTE_CALLS = [
    `${DYN}::router::new_swap_context`,
    `${DYN}::cetus::swap`,
    `${DYN}::deepbookv3::swap`,
    `${DYN}::router::confirm_swap`,
  ];

  it("checkActionShape passes a swap whose route calls use an unknown package", async () => {
    const txBytes = await ptbWithCalls(ROUTE_CALLS);
    const res = await checkActionShape(baseProposal({ actionType: "swap", txBytes }));
    expect(res.ok).toBe(true);
  });

  it("checkAllowlist passes the same route by module::function signature", async () => {
    const txBytes = await ptbWithCalls(ROUTE_CALLS);
    const res = await checkAllowlist(txBytes);
    expect(res.ok).toBe(true);
  });

  it("the package-agnostic bypass is swap-only — a transfer with a swap call is refused", async () => {
    const txBytes = await ptbWithCalls([`${DYN}::deepbookv3::swap`]);
    const res = await checkActionShape(baseProposal({ actionType: "transfer", txBytes }));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("shape mismatch");
  });

  it("permits coin::destroy_zero in a swap (full-balance cleanup, zero value)", async () => {
    const NATIVE = "0x0000000000000000000000000000000000000000000000000000000000000002";
    const txBytes = await ptbWithCalls([
      `${DYN}::router::new_swap_context`,
      `${DYN}::cetus::swap`,
      `${DYN}::router::confirm_swap`,
      `${NATIVE}::coin::destroy_zero`,
    ]);
    const res = await checkActionShape(baseProposal({ actionType: "swap", txBytes }));
    expect(res.ok).toBe(true);
    expect((await checkAllowlist(txBytes)).ok).toBe(true);
  });

  it("does NOT open a hole — a non-swap call under an unknown package in a swap is refused", async () => {
    const txBytes = await ptbWithCalls([
      `${DYN}::router::new_swap_context`,
      `${DYN}::drain::steal_all_coins`,
    ]);
    const res = await checkActionShape(baseProposal({ actionType: "swap", txBytes }));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("steal_all_coins");
  });
});

// ---------------------------------------------------------------------------
// 1. Structural shape gate
// ---------------------------------------------------------------------------

describe("checkActionShape — composition bypass", () => {
  it("BLOCKs a swap PTB that also contains an add_liquidity call", async () => {
    const txBytes = await ptbWithCalls([
      `${CETUS_CLMM_PACKAGE}::pool::swap`,
      `${CETUS_CLMM_PACKAGE_V2}::pool::add_liquidity_fix_coin`,
    ]);
    const res = await checkActionShape(baseProposal({ actionType: "swap", txBytes }));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("shape mismatch");
    expect(res.reason).toContain("add_liquidity_fix_coin");
  });

  it("passes a swap PTB that contains only swap calls", async () => {
    const txBytes = await ptbWithCalls([`${CETUS_CLMM_PACKAGE}::pool::swap`]);
    const res = await checkActionShape(baseProposal({ actionType: "swap", txBytes }));
    expect(res.ok).toBe(true);
  });

  it("passes a limit_order PTB with DeepBook order + proof calls", async () => {
    const txBytes = await ptbWithCalls([
      `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_owner`,
      `${DEEPBOOK_PACKAGE}::pool::place_limit_order`,
    ]);
    const res = await checkActionShape(baseProposal({ actionType: "limit_order", txBytes }));
    expect(res.ok).toBe(true);
  });

  it("BLOCKs a limit_order PTB that smuggles a Cetus swap", async () => {
    const txBytes = await ptbWithCalls([
      `${DEEPBOOK_PACKAGE}::pool::place_limit_order`,
      `${CETUS_CLMM_PACKAGE}::pool::swap`,
    ]);
    const res = await checkActionShape(baseProposal({ actionType: "limit_order", txBytes }));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("shape mismatch");
  });
});

// ---------------------------------------------------------------------------
// 2. Net-outflow valuation (pure)
// ---------------------------------------------------------------------------

function dryRun(deltas: DryRunResult["balanceDeltas"], gasCostMist = 0n): DryRunResult {
  return { effects: {} as DryRunResult["effects"], balanceDeltas: deltas, gasCostMist };
}

describe("computeNetOutflowUsd", () => {
  it("sums only the sender's outflows; ignores inflows and foreign owners", () => {
    const r = computeNetOutflowUsd(
      dryRun([
        { coinType: COIN_TYPES.USDC, amount: -10_000_000n, owner: WALLET }, // -$10 outflow
        { coinType: COIN_TYPES.USDC, amount: 5_000_000n, owner: WALLET }, // inflow ignored
        { coinType: COIN_TYPES.USDC, amount: -3_000_000n, owner: RECIPIENT }, // foreign owner ignored
      ]),
      WALLET,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.usd).toBeCloseTo(10);
  });

  it("subtracts gas from the SUI outflow so gas alone never trips the cap", () => {
    vi.stubEnv("SUI_USD_PRICE_FLOOR", "3.0");
    // 1 SUI out, of which 0.5 SUI is gas → net 0.5 SUI × $3 = $1.50
    const r = computeNetOutflowUsd(
      dryRun([{ coinType: COIN_TYPES.SUI, amount: -1_000_000_000n, owner: WALLET }], 500_000_000n),
      WALLET,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.usd).toBeCloseTo(1.5);
    vi.unstubAllEnvs();
  });

  it("fail-closed: an outflow in an unpriced coin returns not-ok", () => {
    // A coin with no Pyth feed AND no floor → getTrustedUsdPrice undefined → fail-closed.
    // (WETH/wBTC are now priced via Pyth+floor, so a genuinely unknown coin is used.)
    const r = computeNetOutflowUsd(
      dryRun([{ coinType: "0xdead::fake::FAKE", amount: -100n, owner: WALLET }]),
      WALLET,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no trusted USD price");
  });
});

// ---------------------------------------------------------------------------
// 3. guardianCheck — cap from ACTUAL outflow (end-to-end with mocked dry-run)
// ---------------------------------------------------------------------------

describe("guardianCheck — dry-run net-outflow cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TX_USD_CAP", "5");
    vi.stubEnv("DAILY_USD_CAP", "20");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("BLOCKs when actual outflow exceeds the per-tx cap even though declared is in-cap", async () => {
    const txBytes = await emptyKindBytes();
    // Declared $2 (in-cap), but the PTB really moves $10 of USDC.
    mockDryRun.mockResolvedValue(
      dryRun([{ coinType: COIN_TYPES.USDC, amount: -10_000_000n, owner: WALLET }]),
    );
    const res = await guardianCheck(baseProposal({ txBytes, amountInNative: 2_000_000n }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.gates).toContain("tx_cap");
      // The under-declaration is also surfaced.
      expect(res.gates).toContain("outflow_mismatch");
    }
  });

  it("PASSES when actual outflow matches the declared in-cap amount", async () => {
    const txBytes = await emptyKindBytes();
    mockDryRun.mockResolvedValue(
      dryRun([{ coinType: COIN_TYPES.USDC, amount: -2_000_000n, owner: WALLET }]),
    );
    const res = await guardianCheck(baseProposal({ txBytes, amountInNative: 2_000_000n }), stubClient);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.preview.estimatedUsdValue).toBeCloseTo(2);
  });

  it("fail-closed: BLOCKs when the dry-run shows an outflow in an unpriced coin", async () => {
    const txBytes = await emptyKindBytes();
    // Genuinely unpriced coin (no feed, no floor) — WETH/wBTC are now priced.
    mockDryRun.mockResolvedValue(
      dryRun([{ coinType: "0xdead::fake::FAKE", amount: -100_000_000n, owner: WALLET }]),
    );
    const res = await guardianCheck(baseProposal({ txBytes, amountInNative: 2_000_000n }), stubClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.gates).toContain("trusted_price");
  });
});
