/**
 * Tests: buildDynamicComposite builder.
 *
 * Covers (in fixture mode — no live RPC or SDK needed):
 *  1. Rejects 0 legs or >8 legs.
 *  2. Rejects send leg with missing recipient.
 *  3. Rejects non-positive amountInNative on non-send legs.
 *  4. 2-recipient send-only composite builds a valid PTB with compositeLegs carrying
 *     the resolved recipients (Guardian anti-leak gate reads these).
 *  5. Mixed send+swap composite builds both legs; compositeLegs has actionType annotations.
 *  6. Chained swap→lend builds a valid PTB; the lend leg has amountFrom="prev-output".
 *  7. Stake leg (hasui) builds a valid PTB in fixture mode.
 *  8. Fixture mode returns isFixture=true.
 *
 * Live PTB construction (SDK + gRPC) is not tested here — it requires a live chain
 * and is exercised in the e2e / devnet tests (Phase 6).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildDynamicComposite,
  CompositeBuildError,
  type DynamicCompositeLeg,
} from "../build-composite";
import { COIN_TYPES } from "../protocol-constants";

const WALLET = "0x" + "a".repeat(64);
const RECIPIENT_A = "0x" + "b".repeat(64);
const RECIPIENT_B = "0x" + "c".repeat(64);

// A minimal stub client — fixture mode doesn't make any RPC calls,
// but the function signature expects a SuiClient.
const client = {
  getCoins: async () => ({ data: [] }),
} as never;

let originalMode: string | undefined;

beforeEach(() => {
  originalMode = process.env.NEXT_PUBLIC_DEMO_MODE;
  process.env.NEXT_PUBLIC_DEMO_MODE = "fixture";
});

afterEach(() => {
  if (originalMode === undefined) {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
  } else {
    process.env.NEXT_PUBLIC_DEMO_MODE = originalMode;
  }
});

// ---------------------------------------------------------------------------
// Validation guards
// ---------------------------------------------------------------------------

describe("buildDynamicComposite — validation", () => {
  it("rejects 0 legs", async () => {
    await expect(buildDynamicComposite(client, WALLET, [])).rejects.toBeInstanceOf(
      CompositeBuildError,
    );
  });

  it("rejects >8 legs", async () => {
    const legs: DynamicCompositeLeg[] = Array.from({ length: 9 }, () => ({
      actionType: "stake" as const,
      coinTypeIn: COIN_TYPES.SUI,
      amountInNative: 1_000_000_000n,
    }));
    await expect(buildDynamicComposite(client, WALLET, legs)).rejects.toBeInstanceOf(
      CompositeBuildError,
    );
  });

  it("rejects send leg with missing recipient", async () => {
    const legs: DynamicCompositeLeg[] = [
      {
        actionType: "send",
        coinTypeIn: COIN_TYPES.SUI,
        amountInNative: 1_000_000_000n,
        // no recipient
      },
    ];
    await expect(buildDynamicComposite(client, WALLET, legs)).rejects.toBeInstanceOf(
      CompositeBuildError,
    );
  });

  it("rejects non-positive amountInNative on swap leg", async () => {
    const legs: DynamicCompositeLeg[] = [
      {
        actionType: "swap",
        coinTypeIn: COIN_TYPES.SUI,
        coinTypeOut: COIN_TYPES.USDC,
        amountInNative: 0n,
      },
    ];
    await expect(buildDynamicComposite(client, WALLET, legs)).rejects.toBeInstanceOf(
      CompositeBuildError,
    );
  });
});

// ---------------------------------------------------------------------------
// 2-recipient send-only composite
// ---------------------------------------------------------------------------

describe("buildDynamicComposite — send-only (2 recipients)", () => {
  it("builds a valid base64 PTB with isFixture=true", async () => {
    const legs: DynamicCompositeLeg[] = [
      {
        actionType: "send",
        coinTypeIn: COIN_TYPES.SUI,
        amountInNative: 1_000_000_000n, // 1 SUI
        recipient: RECIPIENT_A,
      },
      {
        actionType: "send",
        coinTypeIn: COIN_TYPES.SUI,
        amountInNative: 2_000_000_000n, // 2 SUI
        recipient: RECIPIENT_B,
      },
    ];

    const result = await buildDynamicComposite(client, WALLET, legs);
    expect(result.isFixture).toBe(true);
    expect(typeof result.txBytes).toBe("string");
    expect(result.txBytes.length).toBeGreaterThan(0);
  });

  it("compositeLegs carries both resolved recipients", async () => {
    const legs: DynamicCompositeLeg[] = [
      {
        actionType: "send",
        coinTypeIn: COIN_TYPES.SUI,
        amountInNative: 500_000_000n,
        recipient: RECIPIENT_A,
      },
      {
        actionType: "send",
        coinTypeIn: COIN_TYPES.SUI,
        amountInNative: 700_000_000n,
        recipient: RECIPIENT_B,
      },
    ];

    const result = await buildDynamicComposite(client, WALLET, legs);
    expect(result.compositeLegs).toHaveLength(2);

    const [leg0, leg1] = result.compositeLegs;
    expect(leg0.actionType).toBe("send");
    expect(leg0.recipient).toBe(RECIPIENT_A);
    expect(leg0.coinTypeIn).toBe(COIN_TYPES.SUI);

    expect(leg1.actionType).toBe("send");
    expect(leg1.recipient).toBe(RECIPIENT_B);
    expect(leg1.coinTypeIn).toBe(COIN_TYPES.SUI);
  });
});

// ---------------------------------------------------------------------------
// Mixed send + swap composite
// ---------------------------------------------------------------------------

describe("buildDynamicComposite — mixed send+swap", () => {
  it("builds a valid PTB and compositeLegs has both actionType annotations", async () => {
    const legs: DynamicCompositeLeg[] = [
      {
        actionType: "send",
        coinTypeIn: COIN_TYPES.SUI,
        amountInNative: 1_000_000_000n,
        recipient: RECIPIENT_A,
      },
      {
        actionType: "swap",
        coinTypeIn: COIN_TYPES.SUI,
        coinTypeOut: COIN_TYPES.USDC,
        amountInNative: 2_000_000_000n,
        slippageBps: 50,
      },
    ];

    const result = await buildDynamicComposite(client, WALLET, legs);
    expect(result.isFixture).toBe(true);
    expect(result.txBytes.length).toBeGreaterThan(0);

    expect(result.compositeLegs).toHaveLength(2);
    expect(result.compositeLegs[0].actionType).toBe("send");
    expect(result.compositeLegs[0].recipient).toBe(RECIPIENT_A);
    expect(result.compositeLegs[1].actionType).toBe("swap");
    // swap leg has no recipient
    expect(result.compositeLegs[1].recipient).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Chained swap→lend
// ---------------------------------------------------------------------------

describe("buildDynamicComposite — chained swap→lend", () => {
  it("builds a valid PTB when lend leg has amountFrom=prev-output", async () => {
    const legs: DynamicCompositeLeg[] = [
      {
        actionType: "swap",
        coinTypeIn: COIN_TYPES.SUI,
        coinTypeOut: COIN_TYPES.USDC,
        amountInNative: 5_000_000_000n,
      },
      {
        actionType: "lend_deposit",
        coinTypeIn: COIN_TYPES.USDC,
        amountInNative: 100_000n, // actual value used by lend when chained
        amountFrom: "prev-output",
        lendingProtocol: "navi",
      },
    ];

    const result = await buildDynamicComposite(client, WALLET, legs);
    expect(result.isFixture).toBe(true);
    expect(result.txBytes.length).toBeGreaterThan(0);
    expect(result.compositeLegs).toHaveLength(2);
    expect(result.compositeLegs[0].actionType).toBe("swap");
    expect(result.compositeLegs[1].actionType).toBe("lend_deposit");
  });
});

// ---------------------------------------------------------------------------
// Stake leg
// ---------------------------------------------------------------------------

describe("buildDynamicComposite — stake (hasui) leg", () => {
  it("builds a valid PTB with a hasui stake leg", async () => {
    const legs: DynamicCompositeLeg[] = [
      {
        actionType: "stake",
        coinTypeIn: COIN_TYPES.SUI,
        amountInNative: 2_000_000_000n,
        lstProvider: "hasui",
      },
    ];

    const result = await buildDynamicComposite(client, WALLET, legs);
    expect(result.isFixture).toBe(true);
    expect(result.txBytes.length).toBeGreaterThan(0);
    expect(result.compositeLegs[0].actionType).toBe("stake");
  });
});

// ---------------------------------------------------------------------------
// Max legs boundary
// ---------------------------------------------------------------------------

describe("buildDynamicComposite — max legs", () => {
  it("accepts exactly 8 legs", async () => {
    const legs: DynamicCompositeLeg[] = Array.from({ length: 8 }, (_, i) => ({
      actionType: "send" as const,
      coinTypeIn: COIN_TYPES.SUI,
      amountInNative: 100_000_000n,
      recipient: `0x${"0".repeat(63)}${i + 1}`,
    }));
    const result = await buildDynamicComposite(client, WALLET, legs);
    expect(result.compositeLegs).toHaveLength(8);
  });
});
