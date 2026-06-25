/**
 * Tests: Guardian composite-recipe gate — Phase 6 moat-critical safety tests.
 *
 * These tests are the red-team-hardened set that the spec requires. Every BLOCK
 * assertion covers a real attack vector; every PASS assertion proves the happy
 * path works. ALL 10 safety tests must be green before this phase ships.
 *
 * Safety tests (in order):
 *  1. Valid swap→lend composite (all deltas net to sender) → PASS.
 *  2. Leg 2 TransferObjects the swap output to a third party → BLOCK (non-sender objectChange owner).
 *  3. SplitCoins(tx.gas)→TransferObjects([that], attacker) SUI-exfil → BLOCK (non-sender balance delta).
 *  4. Result/Input-derived recipient not provably the sender → BLOCK (anti-leak).
 *  5. Extra undeclared MoveCall spliced in (target-multiset mismatch) → BLOCK.
 *  6. Non-allowlisted leg target (unknown protocol) → BLOCK.
 *  7. Whole-PTB net-delta over USD cap → BLOCK.
 *  8. Whole-PTB net-SUI outflow over SUI cap → BLOCK.
 *  9. Intent matching no recipe → routed to Track A (never composed ad-hoc).
 * 10. Single-action regression: full suite pattern stays intact after adding composite type.
 *
 * Also tested:
 * - Atomicity invariant: a composite PTB aborts both legs (dry-run failure → nothing executes).
 * - WYSIWYS: approvedDigest is stable over the composite PTB bytes.
 * - Missing compositeLegs → BLOCK (fail-closed).
 * - Coin-type linkage mismatch → BLOCK.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import {
  COIN_TYPES,
  NAVI_PACKAGE,
  CETUS_CLMM_PACKAGE,
} from "../allowlist";
import type { DryRunResult } from "@dewlock/sui/dry-run";

// ---------------------------------------------------------------------------
// Mock external dependencies — keep tests fast and deterministic
// ---------------------------------------------------------------------------

vi.mock("@dewlock/sui", async () => {
  const { capObjectsForPreview } = await vi.importActual<typeof import("@dewlock/sui/dry-run")>(
    "@dewlock/sui/dry-run",
  );
  return {
    dryRunTransaction: vi.fn(),
    DryRunFailedError: class DryRunFailedError extends Error {},
    capObjectsForPreview,
  };
});

vi.mock("@dewlock/sui/navi-hf-simulation", () => ({
  simulateNaviHealthFactor: vi.fn(),
}));

// Mock SUI price fetch so tests don't call the network.
vi.mock("@dewlock/sui/aggregator-quotes", () => ({
  fetchSuiUsdPrice: vi.fn(async () => 3.5),
  fetchAggregatorQuote: vi.fn(async () => ({ minAmountOut: 1000000n })),
  AGGREGATOR_ACTIVE_PROVIDERS: [],
}));

import { dryRunTransaction } from "@dewlock/sui";
import {
  guardianCheck,
  checkCompositeRecipe,
  computeNetOutflowUsd,
  NET_SUI_DELTA_CAP_MIST,
} from "../guardian";
import type { TradeProposal } from "../guardian";

const mockDryRun = dryRunTransaction as unknown as import("vitest").Mock<
  (client: unknown, txBytes: string) => Promise<DryRunResult>
>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALLET = "0x" + "a".repeat(64);
const ATTACKER = "0x" + "b".repeat(64);
const NAVI_PKG = NAVI_PACKAGE;

// ---------------------------------------------------------------------------
// PTB helpers — build real BCS bytes that round-trip through Transaction.from()
// ---------------------------------------------------------------------------

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

/**
 * Build a fixture composite PTB:
 * leg 0: Cetus CLMM swap MoveCall (from recipe's swap leg allowedTargets) + splitCoins
 * leg 1: NAVI entry_deposit with the split coin (placeholder lend)
 * No TransferObjects to any attacker.
 *
 * Both the swap-leg target (CETUS_CLMM_PACKAGE::pool::swap) and the lend-leg target
 * (NAVI_PACKAGE::incentive_v3::entry_deposit) are in the recipe's declared allowedTargets,
 * so the multiset check passes. The splitCoins is a native PTB command (not a MoveCall)
 * and is not checked by the multiset gate.
 */
async function validCompositePtb(): Promise<string> {
  return realBytes((tx) => {
    // Swap leg placeholder: a Cetus CLMM swap call (in the recipe's swap leg allowedTargets).
    // In the real composite, fastRouterSwap emits this target; here it is a bare MoveCall
    // with no arguments so the PTB round-trips without a live chain connection.
    tx.moveCall({
      target: `${CETUS_CLMM_PACKAGE}::pool::swap`,
      arguments: [],
    });
    // Bridge: split a coin representing the swap output (structural stand-in).
    const [swapOutput] = tx.splitCoins(tx.gas, [1_000_000n]);
    // Lend leg: pass the swap output coin directly to NAVI (no wallet settle).
    tx.moveCall({
      target: `${NAVI_PKG}::incentive_v3::entry_deposit`,
      arguments: [swapOutput],
    });
  });
}

/**
 * Build a tampered composite PTB where the attacker also receives a coin via TransferObjects.
 * This simulates the "third-party TransferObjects" attack where the composite PTB passes
 * the multiset check (both swap + lend calls present) but leaks value to a non-sender.
 * The anti-leak gate catches this via the dry-run objectChange ownerKind="third-party".
 */
async function thirdPartyTransferPtb(): Promise<string> {
  return realBytes((tx) => {
    // Swap leg placeholder (passes multiset check for the swap leg).
    tx.moveCall({ target: `${CETUS_CLMM_PACKAGE}::pool::swap`, arguments: [] });
    const [swapOutput] = tx.splitCoins(tx.gas, [1_000_000n]);
    // Lend leg (passes multiset check for the lend leg).
    tx.moveCall({
      target: `${NAVI_PKG}::incentive_v3::entry_deposit`,
      arguments: [swapOutput],
    });
    // Attacker receives a coin — the leak. Caught by the dry-run anti-leak walk
    // (objectChange ownerKind="third-party" for the transferred coin object).
    const [stolen] = tx.splitCoins(tx.gas, [500_000n]);
    tx.transferObjects([stolen], ATTACKER);
  });
}

/**
 * Build a PTB with SplitCoins(tx.gas)→TransferObjects([that], attacker) — the SUI exfil vector.
 * Both swap + lend legs are present to pass the multiset check; the anti-leak catches the
 * exfil via the dry-run balance delta showing a positive delta to the attacker address.
 */
async function suiExfilPtb(): Promise<string> {
  return realBytes((tx) => {
    // Both legs present (passes multiset check).
    tx.moveCall({ target: `${CETUS_CLMM_PACKAGE}::pool::swap`, arguments: [] });
    tx.moveCall({ target: `${NAVI_PKG}::incentive_v3::entry_deposit`, arguments: [] });
    // SUI exfil: split from gas and transfer to attacker. Caught by balance delta walk.
    const [exfil] = tx.splitCoins(tx.gas, [5_000_000_000n]);
    tx.transferObjects([exfil], ATTACKER);
  });
}

/**
 * Build a PTB with an extra MoveCall not in the recipe (multiset mismatch attack).
 */
async function extraCallPtb(extraTarget: string): Promise<string> {
  return realBytes((tx) => {
    const [swapOutput] = tx.splitCoins(tx.gas, [1_000_000n]);
    tx.moveCall({
      target: `${NAVI_PKG}::incentive_v3::entry_deposit`,
      arguments: [swapOutput],
    });
    // Extra MoveCall not in any recipe leg.
    tx.moveCall({
      target: extraTarget as `${string}::${string}::${string}`,
      arguments: [],
    });
  });
}

// ---------------------------------------------------------------------------
// DryRunResult factories
// ---------------------------------------------------------------------------

/**
 * A clean composite dry-run: SUI outflow (swap cost) and USDC outflow (lend) all sender-owned.
 * No third-party owners. All positive deltas go to the sender.
 */
function cleanDryRun(): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      // SUI outflow (swap + gas): sender's SUI decreases.
      { coinType: COIN_TYPES.SUI, amount: -6_000_000_000n, owner: WALLET },
      // USDC outflow (lend deposit): sender's USDC decreases.
      { coinType: COIN_TYPES.USDC, amount: -2_000_000n, owner: WALLET },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [
      // Swap result: coin mutated (shared NAVI pool).
      { objectId: "0x" + "e".repeat(64), changeType: "mutated", ownerKind: "shared" },
      // NAVI position created (object-owned = dynamic field).
      { objectId: "0x" + "f".repeat(64), changeType: "created", ownerKind: "object" },
    ],
  };
}

/**
 * Tampered dry-run: a third-party objectChange (the leak).
 */
function thirdPartyObjectDryRun(): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -2_000_000_000n, owner: WALLET },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [
      // A coin was transferred to an attacker — this is the third-party leak.
      { objectId: "0x" + "aa".repeat(32), changeType: "transferred", ownerKind: "third-party" },
    ],
  };
}

/**
 * Tampered dry-run: SUI exfil via a positive balance delta to an attacker.
 */
function suiExfilDryRun(): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -10_000_000_000n, owner: WALLET },
      // Attacker gains SUI — this is the exfil.
      { coinType: COIN_TYPES.SUI, amount: 5_000_000_000n, owner: ATTACKER },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Over-cap dry-run: outflow greatly exceeds the TX_USD_CAP.
 */
function overCapDryRun(): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    // USDC outflow = $7000 (over $5000 default cap).
    balanceDeltas: [{ coinType: COIN_TYPES.USDC, amount: -7_000_000_000n, owner: WALLET }],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Over-SUI-cap dry-run: SUI outflow exceeds NET_SUI_DELTA_CAP_MIST (10 SUI = 10^10 MIST).
 */
function overSuiCapDryRun(): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    // 15 SUI outflow (net of gas) = 15 * 10^9 MIST → over 10 SUI cap.
    balanceDeltas: [{ coinType: COIN_TYPES.SUI, amount: -16_000_000_000n, owner: WALLET }],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

// ---------------------------------------------------------------------------
// Proposal factories
// ---------------------------------------------------------------------------

function baseCompositeProposal(txBytes: string, overrides: Partial<TradeProposal> = {}): TradeProposal {
  return {
    txBytes,
    walletAddress: WALLET,
    actionLabel: "Swap SUI then deposit USDC into NAVI",
    actionType: "composite",
    coinTypeIn: COIN_TYPES.SUI,
    coinTypeOut: COIN_TYPES.USDC,
    amountInNative: 5_000_000_000n, // 5 SUI
    argProvenance: { amount: "user_turn", coinType: "user_turn" },
    dailyUsdSpentSoFar: 0,
    compositeRecipeId: "swap_lend_v1",
    compositeLegs: [
      { coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountInNative: 5_000_000_000n },
      { coinTypeIn: COIN_TYPES.USDC, amountInNative: 0n, lendingProtocol: "navi" },
    ],
    ...overrides,
  };
}

const stubClient = {
  getCoinMetadata: async ({ coinType }: { coinType: string }) => {
    const known: Record<string, number> = {
      [COIN_TYPES.SUI]: 9,
      [COIN_TYPES.USDC]: 6,
    };
    return known[coinType] !== undefined ? { decimals: known[coinType] } : null;
  },
  dryRunTransactionBlock: vi.fn(),
} as unknown as Parameters<typeof guardianCheck>[1];

// ---------------------------------------------------------------------------
// Test setup: reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: clean dry-run (safe composite). Individual tests override per scenario.
  mockDryRun.mockResolvedValue(cleanDryRun());
  // Unset env caps to get default values.
  delete process.env.TX_USD_CAP;
  delete process.env.DAILY_USD_CAP;
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
});

afterEach(() => {
  delete process.env.TX_USD_CAP;
  delete process.env.DAILY_USD_CAP;
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
});

// ---------------------------------------------------------------------------
// Safety test 1: Valid swap→lend composite → PASS
// ---------------------------------------------------------------------------

describe("Safety test 1: valid swap→lend composite", () => {
  it("passes all gates when all deltas net to sender and no third-party owners", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(cleanDryRun());

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Safety test 2: Leg 2 sends output to a third party → BLOCK
// ---------------------------------------------------------------------------

describe("Safety test 2: third-party TransferObjects in leg 2", () => {
  it("blocks when an objectChange has a third-party owner (non-sender objectChange)", async () => {
    const txBytes = await validCompositePtb(); // PTB doesn't matter — dry-run is mocked
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(thirdPartyObjectDryRun());

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/third-party/i);
  });

  it("blocks via guardianCheck too (end-to-end gate routing)", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(thirdPartyObjectDryRun());

    const result = await guardianCheck(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect((result as { gates: string[] }).gates).toContain("composite_recipe");
  });
});

// ---------------------------------------------------------------------------
// Safety test 3: SplitCoins(tx.gas)→TransferObjects([that], attacker) SUI-exfil → BLOCK
// ---------------------------------------------------------------------------

describe("Safety test 3: SUI exfiltration via gas split and transfer", () => {
  it("blocks when a non-sender address has a positive balance delta (SUI exfil)", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(suiExfilDryRun());

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/non-sender|third party/i);
  });

  it("blocks even when USD outflow is within cap (SUI cap is independent)", async () => {
    const txBytes = await validCompositePtb();
    // Outflow: 10 SUI (net of gas 1 MIST → 9.999... SUI out) — over NET_SUI_DELTA_CAP_MIST (10 SUI).
    // No third-party object but net-SUI exceeds cap.
    const dryRun: DryRunResult = {
      effects: {} as DryRunResult["effects"],
      // 11 SUI out (after gas subtraction = 10 SUI net) — right at the edge of the cap.
      balanceDeltas: [{ coinType: COIN_TYPES.SUI, amount: -12_000_000_000n, owner: WALLET }],
      gasCostMist: 1_000_000n,
      objectChanges: [],
    };
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(dryRun);

    const result = await checkCompositeRecipe(proposal, stubClient);

    // 12_000_000_000 - 1_000_000 = 11_999_000_000 MIST net SUI out > 10_000_000_000 cap → BLOCK
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/SUI|cap|mist/i);
  });
});

// ---------------------------------------------------------------------------
// Safety test 4: Result/Input-derived recipient not provably the sender → BLOCK
// ---------------------------------------------------------------------------

describe("Safety test 4: non-sender recipient in dry-run balance delta", () => {
  it("blocks when any positive balance delta accrues to a non-sender address", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes);
    // A positive delta to an attacker (could come from Result-derived coin transfer).
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [
        { coinType: COIN_TYPES.USDC, amount: -2_000_000n, owner: WALLET },
        { coinType: COIN_TYPES.USDC, amount: 1_000_000n, owner: ATTACKER }, // leak
      ],
      gasCostMist: 1_000_000n,
      objectChanges: [],
    });

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/non-sender|third party/i);
  });
});

// ---------------------------------------------------------------------------
// Safety test 5: Extra undeclared MoveCall → BLOCK (multiset mismatch)
// ---------------------------------------------------------------------------

describe("Safety test 5: extra undeclared MoveCall spliced into composite", () => {
  it("blocks when the PTB contains a MoveCall not in any recipe leg's allowedTargets", async () => {
    // Use a fully-qualified DEEPBOOK target not in the swap_lend_v1 recipe.
    const DEEPBOOK_PKG = "0x000000000000000000000000000000000000000000000000000000000000dee9";
    const txBytes = await extraCallPtb(`${DEEPBOOK_PKG}::pool::place_limit_order`);
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(cleanDryRun());

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unlisted MoveCall|multiset/i);
  });

  it("blocks when a completely unknown protocol is spliced in", async () => {
    const SCAM_PKG = "0x" + "f".repeat(64);
    const txBytes = await extraCallPtb(`${SCAM_PKG}::scam::drain`);
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(cleanDryRun());

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unlisted|multiset/i);
  });
});

// ---------------------------------------------------------------------------
// Safety test 6: Non-allowlisted leg target → BLOCK
// ---------------------------------------------------------------------------

describe("Safety test 6: non-allowlisted recipe or missing recipe id", () => {
  it("blocks when compositeRecipeId is absent (fail-closed)", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes, { compositeRecipeId: undefined });

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/compositeRecipeId|fail-closed/i);
  });

  it("blocks when compositeRecipeId names an unknown recipe", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes, { compositeRecipeId: "nonexistent_recipe_v99" });

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not in the declared registry/i);
  });

  it("blocks when the recipe leg is missing from the PTB (missing lend leg call)", async () => {
    // PTB has only a splitCoins — no NAVI MoveCall at all — so the multiset check
    // must detect that the lend leg is missing.
    const txBytes = await realBytes((tx) => {
      tx.splitCoins(tx.gas, [1_000_000n]);
      // No NAVI entry_deposit call → missing leg 1.
    });
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(cleanDryRun());

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/missing calls for leg/i);
  });
});

// ---------------------------------------------------------------------------
// Safety test 7: Over-USD-cap composite → BLOCK
// ---------------------------------------------------------------------------

describe("Safety test 7: whole-PTB net USD outflow over cap", () => {
  it("blocks when composite net outflow exceeds TX_USD_CAP", async () => {
    process.env.TX_USD_CAP = "100"; // $100 cap for this test
    process.env.DAILY_USD_CAP = "10000";

    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(overCapDryRun());

    const result = await checkCompositeRecipe(proposal, stubClient, 1.0);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cap/i);
  });
});

// ---------------------------------------------------------------------------
// Safety test 8: Over-SUI-cap composite → BLOCK
// ---------------------------------------------------------------------------

describe("Safety test 8: whole-PTB net SUI delta over SUI cap", () => {
  it("blocks when composite net SUI outflow exceeds NET_SUI_DELTA_CAP_MIST", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(overSuiCapDryRun());

    // 16_000_000_000 - 1_000_000 = 15_999_000_000 MIST out > 10_000_000_000 cap → BLOCK
    const result = await checkCompositeRecipe(proposal, stubClient, 3.5);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/SUI.*cap|cap.*SUI|MIST/i);
  });

  it("NET_SUI_DELTA_CAP_MIST is 10 SUI (10^10 MIST)", () => {
    expect(NET_SUI_DELTA_CAP_MIST).toBe(10_000_000_000n);
  });

  it("passes when net SUI outflow is within cap", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes);
    // 5 SUI out (net of 1 MIST gas) = 4.999 SUI net → under 10 SUI cap.
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [{ coinType: COIN_TYPES.SUI, amount: -5_000_000_000n, owner: WALLET }],
      gasCostMist: 1_000_000n,
      objectChanges: [],
    });

    const result = await checkCompositeRecipe(proposal, stubClient, 3.5);

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Safety test 9: Non-recipe intent → routes to Track A, never composed
// ---------------------------------------------------------------------------

describe("Safety test 9: non-recipe intent routed to Track A (no ad-hoc composition)", () => {
  it("blocks an intent with no compositeRecipeId instead of composing ad-hoc", async () => {
    const txBytes = await validCompositePtb();
    // Proposal claims to be composite but provides no recipeId.
    const proposal = baseCompositeProposal(txBytes, { compositeRecipeId: undefined });

    const result = await checkCompositeRecipe(proposal, stubClient);

    // Blocked — not composed ad-hoc. The caller (prepareTrade) would degrade to Track A.
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/compositeRecipeId/i);
  });

  it("a standard single-action proposal (non-composite) is never routed through checkCompositeRecipe", async () => {
    // A standard swap proposal must not accidentally hit checkCompositeRecipe.
    // The composite gate is only invoked when actionType === "composite".
    const txBytes = await realBytes((tx) => {
      tx.moveCall({
        target: `${NAVI_PKG}::incentive_v3::entry_deposit`,
        arguments: [],
      });
    });
    // baseCompositeProposal sets actionType=composite — use a plain swap instead.
    const swapProposal: TradeProposal = {
      txBytes,
      walletAddress: WALLET,
      actionLabel: "Swap SUI to USDC",
      actionType: "swap",
      coinTypeIn: COIN_TYPES.SUI,
      coinTypeOut: COIN_TYPES.USDC,
      amountInNative: 1_000_000_000n,
      argProvenance: { amount: "user_turn", coinType: "user_turn" },
      dailyUsdSpentSoFar: 0,
      swapSource: "aggregator",
      slippageBps: 50,
    };
    // checkCompositeRecipe should never be called for non-composite proposals.
    // Calling it directly here verifies the gate requires compositeRecipeId.
    const result = await checkCompositeRecipe(swapProposal, stubClient);
    expect(result.ok).toBe(false); // No recipeId → blocked
    expect(result.reason).toMatch(/compositeRecipeId/i);
  });
});

// ---------------------------------------------------------------------------
// Atomicity: dry-run failure → BLOCK (nothing executes)
// ---------------------------------------------------------------------------

describe("Atomicity: dry-run failure aborts the whole composite", () => {
  it("blocks when the composite dry-run throws (fail-closed — nothing executes)", async () => {
    // Use validCompositePtb which passes the multiset check (both legs present),
    // so the dry-run is actually reached and can throw.
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockRejectedValue(new Error("Move abort: NAVI pool check failed"));

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/dry-run failed/i);
  });

  it("a BLOCK result from checkCompositeRecipe means nothing executes (guard contract)", async () => {
    // When BLOCK is returned, the prepareTrade tool never returns txBytes.
    // This test asserts the contract: ok=false → no txBytes in the guardianCheck result.
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes, { compositeRecipeId: "invalid_recipe" });

    const result = await guardianCheck(proposal, stubClient);

    expect(result.ok).toBe(false);
    // No txBytes on block.
    expect("txBytes" in result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Coin-type linkage mismatch → BLOCK
// ---------------------------------------------------------------------------

describe("Coin-type linkage: swap output must match lend input", () => {
  it("blocks when the declared compositeLegs linkage is broken", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes, {
      compositeLegs: [
        // Swap outputs USDC...
        { coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountInNative: 5_000_000_000n },
        // ...but lend leg claims to receive a DIFFERENT coin (broken linkage).
        { coinTypeIn: COIN_TYPES.SUI, amountInNative: 0n, lendingProtocol: "navi" },
      ],
    });

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/linkage|mismatch/i);
  });

  it("blocks when compositeLegs is missing entirely", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes, { compositeLegs: undefined });

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/compositeLegs/i);
  });
});

// ---------------------------------------------------------------------------
// WYSIWYS: approvedDigest is stable over the composite PTB bytes
// ---------------------------------------------------------------------------

describe("WYSIWYS: digest stability for composite PTB", () => {
  it("returns a consistent approvedDigest for the same composite PTB bytes", async () => {
    const txBytes = await validCompositePtb();
    const proposal = baseCompositeProposal(txBytes);
    mockDryRun.mockResolvedValue(cleanDryRun());

    const result1 = await guardianCheck(proposal, stubClient);
    const result2 = await guardianCheck(proposal, stubClient);

    if (!result1.ok || !result2.ok) {
      // If either blocked, log for debugging.
      const r1 = result1 as { gates?: string[]; reasons?: string[] };
      const r2 = result2 as { gates?: string[]; reasons?: string[] };
      throw new Error(`Guardian blocked: ${JSON.stringify({ r1, r2 })}`);
    }

    expect(result1.approvedDigest).toBe(result2.approvedDigest);
    expect(result1.approvedDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// Safety test 10: Single-action regression — composite type addition must not break
// existing action types (guardianCheck still routes correctly for non-composite).
// ---------------------------------------------------------------------------

describe("Safety test 10: single-action regression after adding composite action type", () => {
  it("a lend_deposit proposal still routes through the existing lending gate (not composite)", async () => {
    const txBytes = await realBytes((tx) => {
      tx.moveCall({
        target: `${NAVI_PKG}::incentive_v3::entry_deposit`,
        arguments: [],
      });
    });
    const lendProposal: TradeProposal = {
      txBytes,
      walletAddress: WALLET,
      actionLabel: "Deposit USDC into NAVI",
      actionType: "lend_deposit",
      coinTypeIn: COIN_TYPES.USDC,
      amountInNative: 1_000_000n,
      argProvenance: { amount: "user_turn", coinType: "user_turn" },
      dailyUsdSpentSoFar: 0,
      lendingProtocol: "navi",
    };
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [{ coinType: COIN_TYPES.USDC, amount: -1_000_000n, owner: WALLET }],
      gasCostMist: 1_000_000n,
      objectChanges: [],
    });

    const result = await guardianCheck(lendProposal, stubClient);

    // The lend_deposit proposal should NOT be routed through checkCompositeRecipe.
    // It may pass or block on other gates (lending gate requires lendingProtocol),
    // but must never block on "composite_recipe".
    if (!result.ok) {
      const blockResult = result as { gates: string[]; reasons: string[] };
      expect(blockResult.gates).not.toContain("composite_recipe");
    }
  });

  it("a transfer proposal still routes correctly (no composite gate interference)", async () => {
    const txBytes = await realBytes((tx) => {
      const [coin] = tx.splitCoins(tx.gas, [1_000_000n]);
      tx.transferObjects([coin], WALLET);
    });
    const transferProposal: TradeProposal = {
      txBytes,
      walletAddress: WALLET,
      actionLabel: "Transfer SUI",
      actionType: "transfer",
      coinTypeIn: COIN_TYPES.SUI,
      amountInNative: 1_000_000n,
      recipientAddress: WALLET,
      argProvenance: { amount: "user_turn", recipient: "user_turn", coinType: "user_turn" },
      dailyUsdSpentSoFar: 0,
    };
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [{ coinType: COIN_TYPES.SUI, amount: -1_000_000n, owner: WALLET }],
      gasCostMist: 1_000_000n,
      objectChanges: [],
    });

    const result = await guardianCheck(transferProposal, stubClient);

    // Transfer should not hit composite_recipe gate.
    if (!result.ok) {
      const blockResult = result as { gates: string[]; reasons: string[] };
      expect(blockResult.gates).not.toContain("composite_recipe");
    }
  });
});

// ---------------------------------------------------------------------------
// computeNetOutflowUsd reuse: composite gate reuses existing value machinery
// ---------------------------------------------------------------------------

describe("computeNetOutflowUsd reuse (shared with single-action gate)", () => {
  it("correctly sums the composite outflow (SUI + USDC) for the sender", () => {
    const dryRun = cleanDryRun();
    // SUI outflow: 6_000_000_000 - 1_000_000 gas = 5_999_000_000 MIST × $3.5 / 10^9 ≈ $21
    // USDC outflow: 2_000_000 micro-USDC × $1 / 10^6 = $2
    const result = computeNetOutflowUsd(dryRun, WALLET, 3.5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // $21 SUI + $2 USDC = ~$23 (within floating point tolerance)
      expect(result.usd).toBeGreaterThan(20);
      expect(result.usd).toBeLessThan(30);
    }
  });

  it("returns ok=false (fail-closed) when an outflow coin has no trusted price", () => {
    const dryRun: DryRunResult = {
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [
        { coinType: "0xdeadbeef::scam::SCAM", amount: -1_000_000n, owner: WALLET },
      ],
      gasCostMist: 1_000_000n,
      objectChanges: [],
    };
    const result = computeNetOutflowUsd(dryRun, WALLET, 3.5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/no trusted USD price|fail-closed/i);
    }
  });
});
