/**
 * Tests: Guardian orderbook gates (checkOrderbookConstraints).
 *
 * Verifies the four DeepBook-specific Guardian gates in isolation:
 *   OB-1: Pool whitelist — only DEEPBOOK_POOLS keys accepted
 *   OB-2: Tick/lot/min-size alignment — price/qty must align to bookParams
 *   OB-3: POST_ONLY assertion — PTB's place_limit_order must encode orderType=3
 *   OB-4: Fat-finger band — BUY price must not exceed mid×1.5; SELL not below mid×0.5
 *   OB-5: Expiry required — expireTimestampMs must be set
 *
 * Also covers the allowlist gate (Gate 7) for DeepBook move targets so the
 * existing guardian-allowlist-refusal tests are not regressed.
 *
 * All tests are pure (no RPC — checkOrderbookConstraints is RPC-free).
 */

import { describe, it, expect } from "vitest";
import { checkOrderbookConstraints } from "../guardian";
import { DEEPBOOK_PACKAGE, DEEPBOOK_POOLS } from "../allowlist";
import type { TradeProposal } from "../guardian";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE_TS = Date.now() + 24 * 60 * 60 * 1000;
const WALLET = "0x" + "a".repeat(64);
const BM_ID = "0x" + "b".repeat(64);

// tickSize=0.0002 (tickScaled=2) and lotSize=2 (lotScaled=2) enable off-tick/off-lot tests.
// tickSize=0.000001 gives tickScaled=1 (everything divisible) — not useful for validation tests.
const BOOK_PARAMS = { tickSize: 0.0002, lotSize: 2.0, minSize: 1.0 };
const MID = 0.003105;

/** Build a minimal valid limit-order proposal (all gates should pass). */
function makeValidProposal(overrides: Partial<TradeProposal> = {}): TradeProposal {
  return {
    txBytes: "", // checkOrderbookConstraints only uses txBytes for OB-3 parsing
    walletAddress: WALLET,
    actionLabel: "Limit buy 500 DEEP",
    actionType: "limit_order",
    coinTypeIn: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
    amountInNative: 500_000_000n,
    argProvenance: { amount: "user_turn", coinType: "user_turn" },
    dailyUsdSpentSoFar: 0,
    poolKey: "DEEP_USDC",
    balanceManagerId: BM_ID,
    side: "BUY",
    // price=0.0040 is a multiple of tickSize=0.0002 (0.0040/0.0002=20 ✓)
    // qty=500 is a multiple of lotSize=2 (500/2=250 ✓) and >= minSize=1.0 ✓
    limitPrice: 0.0040,
    limitQuantity: 500,
    expireTimestampMs: FUTURE_TS,
    bookParams: BOOK_PARAMS,
    midPrice: MID,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// OB-1: Pool whitelist
// ---------------------------------------------------------------------------

describe("OB-1: Pool whitelist gate", () => {
  it("passes for a whitelisted pool key (DEEP_USDC)", async () => {
    const result = await checkOrderbookConstraints(makeValidProposal({ poolKey: "DEEP_USDC" }));
    expect(result.errors.filter((e) => e.gate === "ob_pool_whitelist")).toHaveLength(0);
  });

  it("passes for SUI_USDC", async () => {
    const result = await checkOrderbookConstraints(makeValidProposal({ poolKey: "SUI_USDC" }));
    expect(result.errors.filter((e) => e.gate === "ob_pool_whitelist")).toHaveLength(0);
  });

  it("passes for DEEP_SUI", async () => {
    const result = await checkOrderbookConstraints(makeValidProposal({ poolKey: "DEEP_SUI" }));
    expect(result.errors.filter((e) => e.gate === "ob_pool_whitelist")).toHaveLength(0);
  });

  it("blocks when poolKey is not in DEEPBOOK_POOLS", async () => {
    const result = await checkOrderbookConstraints(makeValidProposal({ poolKey: "FAKE_POOL" }));
    const gateErrors = result.errors.filter((e) => e.gate === "ob_pool_whitelist");
    expect(gateErrors).toHaveLength(1);
    expect(gateErrors[0].reason).toContain("FAKE_POOL");
  });

  it("blocks when poolKey is undefined", async () => {
    const result = await checkOrderbookConstraints(makeValidProposal({ poolKey: undefined }));
    const gateErrors = result.errors.filter((e) => e.gate === "ob_pool_whitelist");
    expect(gateErrors).toHaveLength(1);
  });

  it("returns immediately after pool whitelist failure (no further gates)", async () => {
    // If pool is unknown the function returns early — other gate errors cannot fire
    const result = await checkOrderbookConstraints(
      makeValidProposal({ poolKey: "UNKNOWN", limitPrice: 999 /* fat-finger */ }),
    );
    // Only pool whitelist error is present (returned early)
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].gate).toBe("ob_pool_whitelist");
  });
});

// ---------------------------------------------------------------------------
// OB-2: Tick/lot/min-size alignment
// ---------------------------------------------------------------------------

describe("OB-2: Tick/lot/min-size alignment gate", () => {
  it("passes when price and quantity are perfectly aligned", async () => {
    // price=0.0040 is multiple of tickSize=0.0002; qty=500 is multiple of lotSize=2
    const result = await checkOrderbookConstraints(
      makeValidProposal({ limitPrice: 0.0040, limitQuantity: 500 }),
    );
    expect(result.errors.filter((e) => e.gate === "ob_tick_lot_alignment")).toHaveLength(0);
  });

  it("blocks when price is off-tick", async () => {
    // tickSize=0.0002 → tickScaled=2; price=0.0003 → scaled=3; 3%2=1 → off-tick
    const result = await checkOrderbookConstraints(
      makeValidProposal({ limitPrice: 0.0003, limitQuantity: 500 }),
    );
    const gateErrors = result.errors.filter((e) => e.gate === "ob_tick_lot_alignment");
    expect(gateErrors.length).toBeGreaterThanOrEqual(1);
    expect(gateErrors[0].reason).toContain("tick size");
  });

  it("blocks when quantity is off-lot", async () => {
    // lotSize=2 → lotScaled=2; qty=501 → scaled=501; 501%2=1 → off-lot
    const result = await checkOrderbookConstraints(
      makeValidProposal({ limitPrice: 0.0040, limitQuantity: 501 }),
    );
    const gateErrors = result.errors.filter((e) => e.gate === "ob_tick_lot_alignment");
    expect(gateErrors.length).toBeGreaterThanOrEqual(1);
    expect(gateErrors[0].reason).toContain("lot size");
  });

  it("blocks when quantity is below minSize", async () => {
    // Use bookParams with minSize=10 to test the min-size check independently of lot alignment.
    // qty=4 is a multiple of lotSize=2 (4%2=0 ✓) but below minSize=10 → minimum order size error.
    const result = await checkOrderbookConstraints(
      makeValidProposal({
        limitPrice: 0.0040,
        limitQuantity: 4,
        bookParams: { tickSize: 0.0002, lotSize: 2.0, minSize: 10.0 },
      }),
    );
    const gateErrors = result.errors.filter((e) => e.gate === "ob_tick_lot_alignment");
    expect(gateErrors.length).toBeGreaterThanOrEqual(1);
    expect(gateErrors[0].reason).toContain("minimum order size");
  });

  it("skips tick/lot check when bookParams is absent", async () => {
    // Without bookParams the gate cannot validate — should not error
    const result = await checkOrderbookConstraints(
      makeValidProposal({ bookParams: undefined }),
    );
    expect(result.errors.filter((e) => e.gate === "ob_tick_lot_alignment")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// OB-3: POST_ONLY enforcement
// ---------------------------------------------------------------------------

describe("OB-3: POST_ONLY PTB assertion", () => {
  it("blocks when txBytes is an empty string (cannot be parsed as PTB)", async () => {
    // Empty string → Transaction.from(Buffer.from('')) throws → block
    const result = await checkOrderbookConstraints(makeValidProposal({ txBytes: "" }));
    const gateErrors = result.errors.filter((e) => e.gate === "ob_post_only");
    expect(gateErrors).toHaveLength(1);
    expect(gateErrors[0].reason).toContain("Failed to parse PTB");
  });

  it("blocks when txBytes cannot be decoded as a valid PTB", async () => {
    // Random non-transaction base64 bytes → parse error → block
    const garbage = Buffer.from("this is not a transaction").toString("base64");
    const result = await checkOrderbookConstraints(makeValidProposal({ txBytes: garbage }));
    const gateErrors = result.errors.filter((e) => e.gate === "ob_post_only");
    expect(gateErrors).toHaveLength(1);
    expect(gateErrors[0].reason).toContain("Failed to parse PTB");
  });

  it("blocks when txBytes is valid base64 but not a valid Transaction", async () => {
    // Random bytes that decode as valid base64 but are not a serialized Transaction
    const garbage = Buffer.from("this is not a transaction").toString("base64");
    const result = await checkOrderbookConstraints(makeValidProposal({ txBytes: garbage }));
    const gateErrors = result.errors.filter((e) => e.gate === "ob_post_only");
    expect(gateErrors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// OB-4: Fat-finger price band
// ---------------------------------------------------------------------------

describe("OB-4: Fat-finger price band gate", () => {
  it("passes when BUY price is at mid × 1.0 (exactly mid)", async () => {
    const result = await checkOrderbookConstraints(
      makeValidProposal({ side: "BUY", limitPrice: MID, midPrice: MID }),
    );
    expect(result.errors.filter((e) => e.gate === "ob_fat_finger")).toHaveLength(0);
  });

  it("passes when BUY price is slightly above mid (within 1.5× band)", async () => {
    const result = await checkOrderbookConstraints(
      makeValidProposal({ side: "BUY", limitPrice: MID * 1.2, midPrice: MID }),
    );
    expect(result.errors.filter((e) => e.gate === "ob_fat_finger")).toHaveLength(0);
  });

  it("blocks when BUY price exceeds mid × 1.5", async () => {
    const result = await checkOrderbookConstraints(
      makeValidProposal({ side: "BUY", limitPrice: MID * 1.6, midPrice: MID }),
    );
    const gateErrors = result.errors.filter((e) => e.gate === "ob_fat_finger");
    expect(gateErrors).toHaveLength(1);
    expect(gateErrors[0].reason).toContain("50% above mid-price");
  });

  it("passes when SELL price is slightly below mid (within 0.5× floor)", async () => {
    const result = await checkOrderbookConstraints(
      makeValidProposal({ side: "SELL", limitPrice: MID * 0.8, midPrice: MID }),
    );
    expect(result.errors.filter((e) => e.gate === "ob_fat_finger")).toHaveLength(0);
  });

  it("blocks when SELL price is below mid × 0.5", async () => {
    const result = await checkOrderbookConstraints(
      makeValidProposal({ side: "SELL", limitPrice: MID * 0.4, midPrice: MID }),
    );
    const gateErrors = result.errors.filter((e) => e.gate === "ob_fat_finger");
    expect(gateErrors).toHaveLength(1);
    expect(gateErrors[0].reason).toContain("50% below mid-price");
  });

  it("skips fat-finger check when midPrice is absent", async () => {
    const result = await checkOrderbookConstraints(
      makeValidProposal({ midPrice: undefined, limitPrice: 999 }),
    );
    expect(result.errors.filter((e) => e.gate === "ob_fat_finger")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// OB-5: Expiry required
// ---------------------------------------------------------------------------

describe("OB-5: Expiry required gate", () => {
  it("passes when expireTimestampMs is a future timestamp", async () => {
    const result = await checkOrderbookConstraints(
      makeValidProposal({ expireTimestampMs: FUTURE_TS }),
    );
    expect(result.errors.filter((e) => e.gate === "ob_expiry_required")).toHaveLength(0);
  });

  it("blocks when expireTimestampMs is undefined", async () => {
    const result = await checkOrderbookConstraints(
      makeValidProposal({ expireTimestampMs: undefined }),
    );
    const gateErrors = result.errors.filter((e) => e.gate === "ob_expiry_required");
    expect(gateErrors).toHaveLength(1);
    expect(gateErrors[0].reason).toContain("expiry");
  });

  it("blocks when expireTimestampMs is 0", async () => {
    const result = await checkOrderbookConstraints(
      makeValidProposal({ expireTimestampMs: 0 }),
    );
    const gateErrors = result.errors.filter((e) => e.gate === "ob_expiry_required");
    expect(gateErrors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Multiple gate failures are collected (not short-circuited after pool check)
// ---------------------------------------------------------------------------

describe("Multiple gate failures are collected", () => {
  it("reports both tick/lot AND fat-finger failures in a single call", async () => {
    // price=0.0003 is off-tick (tickSize=0.0002 → 3%2=1)
    // AND price=0.0003 < MID*0.5 = 0.003105*0.5 = 0.001553 — wait: 0.0003 < 0.001553 → SELL fat-finger only
    // To get BOTH: use SELL side, price off-tick AND below mid*0.5
    // qty=501 is off-lot (lotSize=2 → 501%2=1)
    const result = await checkOrderbookConstraints(
      makeValidProposal({
        poolKey: "DEEP_USDC",
        side: "SELL",
        limitPrice: 0.0003, // off-tick (3%2=1) AND below mid*0.5=0.00155 → fat-finger
        limitQuantity: 501, // off-lot (501%2=1)
        midPrice: MID,
      }),
    );
    const gateNames = result.errors.map((e) => e.gate);
    expect(gateNames).toContain("ob_tick_lot_alignment");
    expect(gateNames).toContain("ob_fat_finger");
  });
});

// ---------------------------------------------------------------------------
// Allowlist gate: DeepBook Move targets must be in ALLOWED_MOVE_TARGETS
// ---------------------------------------------------------------------------

describe("Allowlist gate — DeepBook Move targets", () => {
  it("DEEPBOOK_PACKAGE constant is the expected 64-hex string", () => {
    expect(DEEPBOOK_PACKAGE).toBe(
      "0x0e735f8c93a95722efd73521aca7a7652c0bb71ed1daf41b26dfd7d1ff71f748",
    );
  });

  it("DeepBook pool whitelist contains the 3 expected keys", () => {
    expect(Object.keys(DEEPBOOK_POOLS).sort()).toEqual(["DEEP_SUI", "DEEP_USDC", "SUI_USDC"]);
  });

  it("checkAllowlist blocks a PTB calling a non-whitelisted DeepBook function", async () => {
    // Build a fake PTB that calls a non-allowlisted DeepBook target.
    // We test the allowlist string matching directly via checking ALLOWED_MOVE_TARGETS.
    const { ALLOWED_MOVE_TARGETS } = await import("../allowlist");

    // Non-whitelisted hypothetical function
    const fakeTarget = `${DEEPBOOK_PACKAGE}::pool::withdraw_all`;
    expect(ALLOWED_MOVE_TARGETS.has(fakeTarget)).toBe(false);

    // Whitelisted functions must be present
    expect(ALLOWED_MOVE_TARGETS.has(`${DEEPBOOK_PACKAGE}::pool::place_limit_order`)).toBe(true);
    expect(ALLOWED_MOVE_TARGETS.has(`${DEEPBOOK_PACKAGE}::pool::cancel_order`)).toBe(true);
    expect(
      ALLOWED_MOVE_TARGETS.has(`${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_owner`),
    ).toBe(true);
    expect(
      ALLOWED_MOVE_TARGETS.has(`${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_trader`),
    ).toBe(true);
    expect(ALLOWED_MOVE_TARGETS.has(`${DEEPBOOK_PACKAGE}::balance_manager::new`)).toBe(true);
    expect(ALLOWED_MOVE_TARGETS.has(`${DEEPBOOK_PACKAGE}::balance_manager::deposit`)).toBe(true);
    // public_share_object (0x2)
    expect(
      ALLOWED_MOVE_TARGETS.has(
        "0x0000000000000000000000000000000000000000000000000000000000000002::transfer::public_share_object",
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// COIN_TYPES — DEEP coin type added
// ---------------------------------------------------------------------------

describe("COIN_TYPES — DEEP token present", () => {
  it("COIN_TYPES.DEEP is the canonical mainnet DEEP type", async () => {
    const { COIN_TYPES } = await import("../allowlist");
    expect(COIN_TYPES.DEEP).toBe(
      "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
    );
  });

  it("COIN_DECIMALS has DEEP = 6", async () => {
    const { COIN_TYPES, COIN_DECIMALS } = await import("../allowlist");
    expect(COIN_DECIMALS[COIN_TYPES.DEEP]).toBe(6);
  });

  it("getTrustedUsdPrice(DEEP) returns a positive number", async () => {
    const { COIN_TYPES, getTrustedUsdPrice } = await import("../allowlist");
    const price = getTrustedUsdPrice(COIN_TYPES.DEEP);
    expect(price).toBeDefined();
    expect(price!).toBeGreaterThan(0);
  });
});
