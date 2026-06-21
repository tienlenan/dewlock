/**
 * Tests: PTB introspection → contractsCalled labelling + allowlist provenance.
 *
 * Covers the security-load-bearing distinction the preview must NEVER blur:
 *  - "pinned"            → exact-package allowlisted, owned by a named protocol (green ✓ in UI)
 *  - "signature-matched" → aggregator/aftermath route hop, package not individually pinned (NO ✓)
 *  - native primitives   → no contract row at all
 *
 * Real BCS bytes are built with manual gas config so tx.build() needs no client.
 */

import { describe, it, expect } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import {
  CETUS_CLMM_PACKAGE,
  DEEPBOOK_PACKAGE,
  NATIVE_PACKAGE,
  COIN_TYPES,
} from "../allowlist";
import {
  extractMoveTargets,
  classifyTarget,
  buildContractsCalled,
} from "../tx-introspection";

const WALLET = "0x" + "a".repeat(64);

// A package id that is NOT in any registry — stands in for the live, upgradeable
// aggregator/aftermath integration package that can only be matched by signature.
const UNPINNED_PKG = "0x" + "9".repeat(64);

async function realBytes(populate: (tx: Transaction) => void): Promise<string> {
  const tx = new Transaction();
  tx.setSender(WALLET);
  tx.setGasBudget(50_000_000n);
  tx.setGasPrice(1000n);
  tx.setGasPayment([{ objectId: "0x" + "d".repeat(64), version: "1", digest: "1".repeat(32) }]);
  populate(tx);
  const bytes = await tx.build();
  return Buffer.from(bytes).toString("base64");
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

describe("extractMoveTargets", () => {
  it("returns parsed package/module/function for each MoveCall", async () => {
    const bytes = await ptbWithCalls([`${CETUS_CLMM_PACKAGE}::pool::swap`]);
    const calls = extractMoveTargets(bytes);
    expect(calls).toHaveLength(1);
    expect(calls[0].target).toBe(`${CETUS_CLMM_PACKAGE}::pool::swap`);
    expect(calls[0].module).toBe("pool");
    expect(calls[0].function).toBe("swap");
  });

  it("returns [] for a PTB with no MoveCalls (pure native transfer shape)", async () => {
    const bytes = await realBytes((tx) => {
      const [c] = tx.splitCoins(tx.gas, [tx.pure.u64(1n)]);
      tx.transferObjects([c], tx.pure.address(WALLET));
    });
    expect(extractMoveTargets(bytes)).toEqual([]);
  });
});

describe("classifyTarget", () => {
  it("pinned for an exact-package allowlisted protocol target", () => {
    expect(classifyTarget(`${CETUS_CLMM_PACKAGE}::pool::swap`, "pool", "swap")).toBe("pinned");
  });

  it("signature-matched for an aggregator route call on an unpinned package", () => {
    expect(classifyTarget(`${UNPINNED_PKG}::cetus::swap`, "cetus", "swap")).toBe("signature-matched");
  });

  it("signature-matched for an aftermath router hop on an unpinned package", () => {
    expect(classifyTarget(`${UNPINNED_PKG}::router::swap_a_to_b_w1`, "router", "swap_a_to_b_w1")).toBe(
      "signature-matched",
    );
  });

  it("none for an off-allowlist target", () => {
    expect(classifyTarget(`${UNPINNED_PKG}::evil::drain`, "evil", "drain")).toBe("none");
  });
});

describe("buildContractsCalled", () => {
  it("labels a pinned protocol target with its registry name + pinned kind", () => {
    const rows = buildContractsCalled([
      { target: `${DEEPBOOK_PACKAGE}::pool::place_limit_order`, package: DEEPBOOK_PACKAGE, module: "pool", function: "place_limit_order" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].protocolName).toBe("DeepBook V3");
    expect(rows[0].allowlistKind).toBe("pinned");
  });

  it("labels an unpinned aggregator route hop as signature-matched (NOT pinned)", () => {
    const rows = buildContractsCalled([
      { target: `${UNPINNED_PKG}::cetus::swap`, package: UNPINNED_PKG, module: "cetus", function: "swap" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].allowlistKind).toBe("signature-matched");
    expect(rows[0].protocolName).toMatch(/Aggregator|Router/);
  });

  it("emits no row for native framework primitives", () => {
    const rows = buildContractsCalled([
      { target: `${NATIVE_PACKAGE}::coin::from_balance`, package: NATIVE_PACKAGE, module: "coin", function: "from_balance" },
    ]);
    expect(rows).toEqual([]);
  });

  it("dedupes repeated targets", () => {
    const call = { target: `${CETUS_CLMM_PACKAGE}::pool::swap`, package: CETUS_CLMM_PACKAGE, module: "pool", function: "swap" };
    expect(buildContractsCalled([call, call])).toHaveLength(1);
  });
});
