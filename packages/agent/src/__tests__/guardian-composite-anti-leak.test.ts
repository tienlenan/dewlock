/**
 * Tests: Recipient-aware anti-leak gate for generalized composite transactions.
 *
 * The anti-leak invariant (gate c): every third-party inflow in the dry-run MUST be
 * explained by exactly one declared `send` leg (same recipient, same coinType, same
 * amountMist). Multiset equality to the mist — no extra, no missing, no drift.
 *
 * When declaredSendLegs is empty (e.g. swap_lend_v1), the gate degrades to the
 * current "no third-party inflow" behavior — full backward compatibility.
 *
 * RED tests — each describes the exact attack being blocked:
 *  1. Unlisted recipient (A2): PTB sends to 0xATTACKER not in declared legs → BLOCK.
 *  2. Amount inflation (A3): leg says 0.05 SUI, PTB transfers 5 SUI → BLOCK.
 *  3. Recipient swap (A4): leg says Alice, PTB sends to 0xATTACKER → BLOCK.
 *  4. Dust skim (A5): declared [send 1 to A], PTB also sends 0.001 to ATTACKER → BLOCK.
 *  5. Gas exfil via balance delta (A6): attacker gets a positive SUI delta → BLOCK.
 *  6. Coin-type teleport (A9): leg declares USDC, dry-run shows SUI to recipient → BLOCK.
 *  7. Dropped send leg: legs=[A,B], only A inflow observed → BLOCK.
 *
 * GREEN tests — correct behavior must pass:
 *  8. Exact multi-send: legs=[0.05 SUI→A, 0.05 SUI→B], dry-run shows exactly that → PASS.
 *  9. Backward compat: swap_lend_v1 (no send legs), all returns to sender → PASS.
 * 10. Same friend summing: legs=[0.05→A, 0.05→A], combined 0.10 inflow to A → PASS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { COIN_TYPES, CETUS_CLMM_PACKAGE, NAVI_PACKAGE } from "../allowlist";
import type { DryRunResult } from "@dewlock/sui/dry-run";

// ---------------------------------------------------------------------------
// Mock external dependencies — identical pattern to guardian-composite-recipe.test.ts
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

vi.mock("@dewlock/sui/aggregator-quotes", () => ({
  fetchSuiUsdPrice: vi.fn(async () => 3.5),
  fetchAggregatorQuote: vi.fn(async () => ({ minAmountOut: 1000000n })),
  AGGREGATOR_ACTIVE_PROVIDERS: [],
}));

import { dryRunTransaction } from "@dewlock/sui";
import { checkCompositeRecipe } from "../guardian";
import type { TradeProposal } from "../guardian";

const mockDryRun = dryRunTransaction as unknown as import("vitest").Mock<
  (client: unknown, txBytes: string) => Promise<DryRunResult>
>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALLET = "0x" + "a".repeat(64);
const ALICE = "0x" + "c".repeat(64);
const BOB = "0x" + "e".repeat(64);
const ATTACKER = "0x" + "b".repeat(64);

// 0.05 SUI in MIST
const FIFTY_MILLI_SUI = 50_000_000n;
// 5 SUI in MIST (10× inflation)
const FIVE_SUI = 5_000_000_000n;

// ---------------------------------------------------------------------------
// PTB helpers — build real BCS-serialized bytes
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
 * A minimal "dynamic composite" PTB that has NO MoveCalls (send-only legs emit
 * only TransferObjects commands, which are not MoveCall and are NOT checked by
 * the multiset gate). The only PTB commands are splitCoins + transferObjects.
 *
 * This passes the multiset check because the dynamic recipe's send legs have
 * zero allowedTargets — there is nothing to require in the PTB's MoveCall set.
 */
async function sendOnlyPtb(recipients: string[], amountsMist: bigint[]): Promise<string> {
  return realBytes((tx) => {
    for (let i = 0; i < recipients.length; i++) {
      const [coin] = tx.splitCoins(tx.gas, [amountsMist[i]]);
      tx.transferObjects([coin], recipients[i]);
    }
  });
}

/**
 * A tampered PTB that also adds an extra transfer to ATTACKER (dust skim, A5).
 */
async function sendWithExtraAttackerPtb(
  recipients: string[],
  amountsMist: bigint[],
  extraAmount: bigint,
): Promise<string> {
  return realBytes((tx) => {
    for (let i = 0; i < recipients.length; i++) {
      const [coin] = tx.splitCoins(tx.gas, [amountsMist[i]]);
      tx.transferObjects([coin], recipients[i]);
    }
    // Skim dust to attacker — not in declared legs
    const [dust] = tx.splitCoins(tx.gas, [extraAmount]);
    tx.transferObjects([dust], ATTACKER);
  });
}

// ---------------------------------------------------------------------------
// DryRunResult factories — mirror the shape from guardian-composite-recipe.test.ts
// ---------------------------------------------------------------------------

/** Clean dry-run: only sender deltas, no third-party owner or inflow. */
function cleanSenderOnlyDryRun(): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -1_000_000_000n, owner: WALLET },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Dry-run where ATTACKER has a positive balance delta (unlisted recipient, A2 / A4 / A6).
 */
function attackerBalanceDeltaDryRun(coinType: string, amount: bigint): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -(amount + 1_000_000n), owner: WALLET },
      { coinType, amount, owner: ATTACKER },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Dry-run that correctly matches a declared send: one third-party inflow to `recipient`.
 */
function correctSendDryRun(recipient: string, coinType: string, amount: bigint): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -(amount + 1_000_000n), owner: WALLET },
      { coinType, amount, owner: recipient },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Dry-run for two distinct sends (matched multi-send, A→0.05, B→0.05).
 */
function twoSendDryRun(
  recipientA: string,
  recipientB: string,
  coinType: string,
  amountA: bigint,
  amountB: bigint,
): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -(amountA + amountB + 1_000_000n), owner: WALLET },
      { coinType, amount: amountA, owner: recipientA },
      { coinType, amount: amountB, owner: recipientB },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Dry-run where the SAME friend receives the combined amount (two legs → same friend).
 */
function sameFriendCombinedDryRun(
  recipient: string,
  coinType: string,
  combined: bigint,
): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -(combined + 1_000_000n), owner: WALLET },
      { coinType, amount: combined, owner: recipient },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Dry-run that shows an inflated transfer to the correct recipient (A3).
 * Leg declared 0.05 SUI but dry-run shows 5 SUI to that address.
 */
function inflatedSendDryRun(recipient: string): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -(FIVE_SUI + 1_000_000n), owner: WALLET },
      { coinType: COIN_TYPES.SUI, amount: FIVE_SUI, owner: recipient },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Dry-run showing a coin-type teleport (A9): leg declared USDC, dry-run shows SUI.
 */
function coinTypeTeleportDryRun(recipient: string): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      // Sender loses SUI (teleported from USDC somehow) — this is the teleport attack
      { coinType: COIN_TYPES.SUI, amount: -(FIFTY_MILLI_SUI + 1_000_000n), owner: WALLET },
      // Recipient gains SUI but leg declared USDC → mismatch
      { coinType: COIN_TYPES.SUI, amount: FIFTY_MILLI_SUI, owner: recipient },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Dry-run for a dust-skim attack: declared [send to A], attacker also gets dust.
 */
function dustSkimDryRun(recipient: string, amount: bigint, dustAmount: bigint): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -(amount + dustAmount + 1_000_000n), owner: WALLET },
      { coinType: COIN_TYPES.SUI, amount, owner: recipient },
      { coinType: COIN_TYPES.SUI, amount: dustAmount, owner: ATTACKER },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Dry-run for a dropped-leg attack: legs=[A, B], only A received.
 */
function droppedLegDryRun(recipientA: string, coinType: string, amount: bigint): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -(amount + 1_000_000n), owner: WALLET },
      { coinType, amount, owner: recipientA },
      // B is missing — no delta for BOB
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [],
  };
}

/**
 * Dry-run where ATTACKER has a third-party objectChange (A2 via object path).
 */
function attackerObjectChangeDryRun(): DryRunResult {
  return {
    effects: {} as DryRunResult["effects"],
    balanceDeltas: [
      { coinType: COIN_TYPES.SUI, amount: -1_000_000_000n, owner: WALLET },
    ],
    gasCostMist: 1_000_000n,
    objectChanges: [
      {
        objectId: "0x" + "aa".repeat(32),
        changeType: "transferred",
        ownerKind: "third-party",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Proposal factories
// ---------------------------------------------------------------------------

/**
 * Build a "dynamic" composite proposal with declared send legs.
 * compositeRecipeId = "dynamic" tells the Guardian to use the dynamic-recipe path.
 * compositeLegs carries the send leg declarations with recipient + coinType + amountMist.
 */
function dynamicSendProposal(
  txBytes: string,
  sendLegs: Array<{ recipient: string; coinType: string; amountMist: bigint }>,
  overrides: Partial<TradeProposal> = {},
): TradeProposal {
  return {
    txBytes,
    walletAddress: WALLET,
    actionLabel: "Send SUI to friends",
    actionType: "composite",
    coinTypeIn: COIN_TYPES.SUI,
    amountInNative: sendLegs.reduce((s, l) => s + l.amountMist, 0n),
    argProvenance: { amount: "user_turn", coinType: "user_turn" },
    dailyUsdSpentSoFar: 0,
    // Dynamic recipe path: send-only composite
    compositeRecipeId: "dynamic",
    compositeLegs: sendLegs.map((l) => ({
      coinTypeIn: l.coinType,
      amountInNative: l.amountMist,
      recipient: l.recipient,
      actionType: "send" as const,
    })),
    ...overrides,
  };
}

/**
 * A canonical swap_lend_v1 proposal (no send legs) — for backward-compat tests.
 */
async function validSwapLendPtb(): Promise<string> {
  return realBytes((tx) => {
    tx.moveCall({ target: `${CETUS_CLMM_PACKAGE}::pool::swap`, arguments: [] });
    const [swapOutput] = tx.splitCoins(tx.gas, [1_000_000n]);
    tx.moveCall({ target: `${NAVI_PACKAGE}::incentive_v3::entry_deposit`, arguments: [swapOutput] });
  });
}

function swapLendProposal(txBytes: string): TradeProposal {
  return {
    txBytes,
    walletAddress: WALLET,
    actionLabel: "Swap SUI then deposit into NAVI",
    actionType: "composite",
    coinTypeIn: COIN_TYPES.SUI,
    coinTypeOut: COIN_TYPES.USDC,
    amountInNative: 5_000_000_000n,
    argProvenance: { amount: "user_turn", coinType: "user_turn" },
    dailyUsdSpentSoFar: 0,
    compositeRecipeId: "swap_lend_v1",
    compositeLegs: [
      { coinTypeIn: COIN_TYPES.SUI, coinTypeOut: COIN_TYPES.USDC, amountInNative: 5_000_000_000n },
      { coinTypeIn: COIN_TYPES.USDC, amountInNative: 0n, lendingProtocol: "navi" },
    ],
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
} as unknown as Parameters<typeof checkCompositeRecipe>[1];

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDryRun.mockResolvedValue(cleanSenderOnlyDryRun());
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
// RED Test 1 — A2: Unlisted recipient — PTB sends to ATTACKER not in declared legs
// ---------------------------------------------------------------------------

describe("BlocksUnlistedRecipient (A2): ATTACKER not in any declared send leg", () => {
  it("blocks when ATTACKER receives a positive balance delta not covered by any declared leg", async () => {
    const txBytes = await sendOnlyPtb([ATTACKER], [FIFTY_MILLI_SUI]);
    const proposal = dynamicSendProposal(txBytes, [
      // Only ALICE is declared — ATTACKER is not a declared recipient
      { recipient: ALICE, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
    ]);
    // Dry-run shows ATTACKER received the funds (wrong recipient)
    mockDryRun.mockResolvedValue(attackerBalanceDeltaDryRun(COIN_TYPES.SUI, FIFTY_MILLI_SUI));

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/leak|unlisted|third.party|unexpected|attacker/i);
  });

  it("blocks when ATTACKER appears via objectChange with third-party ownerKind", async () => {
    const txBytes = await sendOnlyPtb([ALICE], [FIFTY_MILLI_SUI]);
    const proposal = dynamicSendProposal(txBytes, [
      { recipient: ALICE, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
    ]);
    mockDryRun.mockResolvedValue(attackerObjectChangeDryRun());

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/leak|unlisted|third.party|unexpected/i);
  });
});

// ---------------------------------------------------------------------------
// RED Test 2 — A3: Amount inflation — leg says 0.05 SUI, PTB transfers 5 SUI
// ---------------------------------------------------------------------------

describe("BlocksAmountInflation (A3): transferred amount exceeds declared amount", () => {
  it("blocks when dry-run inflow to declared recipient is 100× declared amount", async () => {
    const txBytes = await sendOnlyPtb([ALICE], [FIVE_SUI]);
    const proposal = dynamicSendProposal(txBytes, [
      // Declared: 0.05 SUI to Alice
      { recipient: ALICE, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
    ]);
    // Dry-run: 5 SUI actually sent to Alice (inflated)
    mockDryRun.mockResolvedValue(inflatedSendDryRun(ALICE));

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/amount|mismatch|inflation|leak/i);
  });
});

// ---------------------------------------------------------------------------
// RED Test 3 — A4: Recipient swap — leg says Alice, PTB sends to ATTACKER
// ---------------------------------------------------------------------------

describe("BlocksRecipientSwap (A4): PTB sends to ATTACKER instead of declared recipient", () => {
  it("blocks when recipient in dry-run differs from declared recipient", async () => {
    const txBytes = await sendOnlyPtb([ATTACKER], [FIFTY_MILLI_SUI]);
    const proposal = dynamicSendProposal(txBytes, [
      // Declared: ALICE is the recipient
      { recipient: ALICE, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
    ]);
    // Dry-run: ATTACKER received the funds, ALICE did not
    mockDryRun.mockResolvedValue(attackerBalanceDeltaDryRun(COIN_TYPES.SUI, FIFTY_MILLI_SUI));

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/leak|mismatch|unexpected|attacker/i);
  });
});

// ---------------------------------------------------------------------------
// RED Test 4 — A5: Dust skim — declared [1 SUI to Alice], PTB also skims to ATTACKER
// ---------------------------------------------------------------------------

describe("BlocksDustSkim (A5): extra tiny inflow to unlisted address alongside declared send", () => {
  it("blocks when a small extra amount goes to ATTACKER beyond the declared leg", async () => {
    const ONE_SUI = 1_000_000_000n;
    const DUST = 1_000n;
    const txBytes = await sendWithExtraAttackerPtb([ALICE], [ONE_SUI], DUST);
    const proposal = dynamicSendProposal(txBytes, [
      { recipient: ALICE, coinType: COIN_TYPES.SUI, amountMist: ONE_SUI },
    ]);
    mockDryRun.mockResolvedValue(dustSkimDryRun(ALICE, ONE_SUI, DUST));

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/leak|unlisted|extra|unexpected/i);
  });
});

// ---------------------------------------------------------------------------
// RED Test 5 — A6: Gas exfil — over-split gas coin, transfer remainder to ATTACKER
// ---------------------------------------------------------------------------

describe("BlocksGasExfil (A6): gas coin over-split and remainder transferred to ATTACKER", () => {
  it("blocks when dry-run shows a positive SUI delta to ATTACKER (gas exfil)", async () => {
    // PTB sends nothing declared — only gas exfil
    const txBytes = await realBytes((tx) => {
      const [exfil] = tx.splitCoins(tx.gas, [FIVE_SUI]);
      tx.transferObjects([exfil], ATTACKER);
    });
    // No send legs declared — any third-party inflow should block
    const proposal = dynamicSendProposal(txBytes, []);
    mockDryRun.mockResolvedValue(attackerBalanceDeltaDryRun(COIN_TYPES.SUI, FIVE_SUI));

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/leak|third.party|unexpected/i);
  });
});

// ---------------------------------------------------------------------------
// RED Test 6 — A9: Coin-type teleport — leg declares USDC, dry-run shows SUI to recipient
// ---------------------------------------------------------------------------

describe("BlocksCoinTypeTeleport (A9): dry-run coinType differs from declared coinType", () => {
  it("blocks when dry-run shows SUI inflow to recipient but leg declared USDC", async () => {
    const txBytes = await sendOnlyPtb([ALICE], [FIFTY_MILLI_SUI]);
    const proposal = dynamicSendProposal(txBytes, [
      // Leg declares USDC — but dry-run will show SUI
      { recipient: ALICE, coinType: COIN_TYPES.USDC, amountMist: FIFTY_MILLI_SUI },
    ]);
    // Dry-run: SUI sent to ALICE (wrong coin type)
    mockDryRun.mockResolvedValue(coinTypeTeleportDryRun(ALICE));

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/coin.type|teleport|mismatch|leak/i);
  });
});

// ---------------------------------------------------------------------------
// RED Test 7 — Dropped send leg: legs=[A, B], dry-run only shows A received
// ---------------------------------------------------------------------------

describe("BlocksDroppedSendLeg: declared two recipients but only one received funds", () => {
  it("blocks when expected recipient B has no inflow in dry-run", async () => {
    const txBytes = await sendOnlyPtb([ALICE], [FIFTY_MILLI_SUI]);
    const proposal = dynamicSendProposal(txBytes, [
      { recipient: ALICE, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
      // BOB declared but will not appear in dry-run
      { recipient: BOB, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
    ]);
    // Dry-run: only ALICE received funds, BOB missing
    mockDryRun.mockResolvedValue(droppedLegDryRun(ALICE, COIN_TYPES.SUI, FIFTY_MILLI_SUI));

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/missing|dropped|expected|not received|mismatch/i);
  });
});

// ---------------------------------------------------------------------------
// GREEN Test 8 — Exact multi-send: legs=[0.05 SUI→A, 0.05 SUI→B], dry-run matches exactly
// ---------------------------------------------------------------------------

describe("PassesExactMultiSend: two declared recipients, dry-run matches exactly", () => {
  it("passes when both recipients receive exactly the declared amounts", async () => {
    process.env.TX_USD_CAP = "10000";
    process.env.DAILY_USD_CAP = "100000";

    const txBytes = await sendOnlyPtb([ALICE, BOB], [FIFTY_MILLI_SUI, FIFTY_MILLI_SUI]);
    const proposal = dynamicSendProposal(txBytes, [
      { recipient: ALICE, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
      { recipient: BOB, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
    ]);
    mockDryRun.mockResolvedValue(
      twoSendDryRun(ALICE, BOB, COIN_TYPES.SUI, FIFTY_MILLI_SUI, FIFTY_MILLI_SUI),
    );

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GREEN Test 9 — Backward compat: swap_lend_v1 (no send legs), all returns to sender
// ---------------------------------------------------------------------------

describe("PassesSwapLendBackwardCompat: no send legs → degrades to current no-third-party check", () => {
  it("passes for swap_lend_v1 when all dry-run deltas net to sender (unchanged behavior)", async () => {
    const txBytes = await validSwapLendPtb();
    const proposal = swapLendProposal(txBytes);
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [
        { coinType: COIN_TYPES.SUI, amount: -6_000_000_000n, owner: WALLET },
        { coinType: COIN_TYPES.USDC, amount: -2_000_000n, owner: WALLET },
      ],
      gasCostMist: 1_000_000n,
      objectChanges: [
        { objectId: "0x" + "e".repeat(64), changeType: "mutated", ownerKind: "shared" },
        { objectId: "0x" + "f".repeat(64), changeType: "created", ownerKind: "object" },
      ],
    });

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(true);
  });

  it("still blocks for swap_lend_v1 when a third-party inflow appears (no send legs declared)", async () => {
    const txBytes = await validSwapLendPtb();
    const proposal = swapLendProposal(txBytes);
    // Attacker inflow — should still be blocked even though it's a swap_lend_v1 recipe
    mockDryRun.mockResolvedValue({
      effects: {} as DryRunResult["effects"],
      balanceDeltas: [
        { coinType: COIN_TYPES.SUI, amount: -2_000_000_000n, owner: WALLET },
        { coinType: COIN_TYPES.SUI, amount: 500_000_000n, owner: ATTACKER },
      ],
      gasCostMist: 1_000_000n,
      objectChanges: [],
    });

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/leak|third.party|unexpected/i);
  });
});

// ---------------------------------------------------------------------------
// GREEN Test 10 — Same friend summing: legs=[0.05→A, 0.05→A], combined 0.10 inflow to A
// ---------------------------------------------------------------------------

describe("PassesSameFriendSumming: two legs to same recipient, dry-run shows summed inflow", () => {
  it("passes when two declared legs to the same recipient are summed and matched in dry-run", async () => {
    process.env.TX_USD_CAP = "10000";
    process.env.DAILY_USD_CAP = "100000";

    const COMBINED = FIFTY_MILLI_SUI * 2n; // 0.10 SUI
    const txBytes = await sendOnlyPtb([ALICE, ALICE], [FIFTY_MILLI_SUI, FIFTY_MILLI_SUI]);
    const proposal = dynamicSendProposal(txBytes, [
      { recipient: ALICE, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
      { recipient: ALICE, coinType: COIN_TYPES.SUI, amountMist: FIFTY_MILLI_SUI },
    ]);
    // Dry-run consolidates to a single inflow of 0.10 SUI to ALICE
    mockDryRun.mockResolvedValue(sameFriendCombinedDryRun(ALICE, COIN_TYPES.SUI, COMBINED));

    const result = await checkCompositeRecipe(proposal, stubClient);

    expect(result.ok).toBe(true);
  });
});
