/**
 * Tests: OB-3 POST_ONLY gate reads the orderType argument by POSITION.
 *
 * The PTB layout below mirrors @mysten/deepbook-v3's
 * `DeepBookContract.placeLimitOrder` exactly:
 *   [pool, balanceManager, tradeProof, clientOrderId(u64), orderType(u8),
 *    selfMatchingOption(u8), price(u64), quantity(u64), isBid(bool),
 *    payWithDeep(bool), expiration(u64), clock]
 * Built with the real @mysten/sui Transaction builder (manual gas + shared-object
 * refs so it serializes offline — a live SDK build can't resolve mainnet shared
 * objects in vitest, the repo's [needs live-env] constraint).
 *
 * Regression: the previous gate scanned EVERY 1-byte Pure for value 3 and
 * rejected any 0/1/2. A real POST_ONLY order carries selfMatchingOption=1
 * (CANCEL_TAKER) and isBid/payWithDeep bools (0/1) — so the old logic
 * false-rejected every genuine order. The fix binds to orderType at arg index 4.
 */

import { describe, it, expect } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { checkPostOnlyInPtb } from "../guardian";
import { DEEPBOOK_PACKAGE } from "../allowlist";

const WALLET = "0x" + "a".repeat(64);

/** Build a real place_limit_order PTB with DeepBook's exact arg layout. */
async function buildOrderPtb(orderType: number, selfMatchingOption = 1, isBid = true): Promise<string> {
  const tx = new Transaction();
  tx.setSender(WALLET);
  tx.setGasBudget(50_000_000n);
  tx.setGasPrice(1000n);
  tx.setGasPayment([{ objectId: "0x" + "d".repeat(64), version: "1", digest: "1".repeat(32) }]);
  const pool = tx.sharedObjectRef({ objectId: "0x" + "1".repeat(64), initialSharedVersion: 1, mutable: true });
  const bm = tx.sharedObjectRef({ objectId: "0x" + "2".repeat(64), initialSharedVersion: 1, mutable: true });
  const clock = tx.sharedObjectRef({
    objectId: "0x0000000000000000000000000000000000000000000000000000000000000006",
    initialSharedVersion: 1,
    mutable: false,
  });
  const proof = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_owner`,
    arguments: [bm],
  });
  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE}::pool::place_limit_order`,
    typeArguments: ["0x2::sui::SUI", "0x2::sui::SUI"],
    arguments: [
      pool, bm, proof,
      tx.pure.u64(1n),                    // clientOrderId
      tx.pure.u8(orderType),              // orderType  (index 4)
      tx.pure.u8(selfMatchingOption),     // selfMatchingOption (index 5)
      tx.pure.u64(100n),                  // price
      tx.pure.u64(200n),                  // quantity
      tx.pure.bool(isBid),                // isBid
      tx.pure.bool(false),                // payWithDeep
      tx.pure.u64(999n),                  // expiration
      clock,
    ],
  });
  return Buffer.from(await tx.build()).toString("base64");
}

describe("OB-3 POST_ONLY — positional orderType check", () => {
  it("PASSES a genuine POST_ONLY order (orderType=3) with selfMatchingOption=1 + bools", async () => {
    // This is the exact shape the old all-u8-scan false-rejected.
    const res = checkPostOnlyInPtb(await buildOrderPtb(3, 1, true));
    expect(res.ok).toBe(true);
  });

  it("PASSES POST_ONLY even when selfMatchingOption=2 (a value the old scan flagged as taker)", async () => {
    const res = checkPostOnlyInPtb(await buildOrderPtb(3, 2, false));
    expect(res.ok).toBe(true);
  });

  it("REJECTS market (orderType=0)", async () => {
    const res = checkPostOnlyInPtb(await buildOrderPtb(0));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("not POST_ONLY");
  });

  it("REJECTS immediate-or-cancel (orderType=1)", async () => {
    const res = checkPostOnlyInPtb(await buildOrderPtb(1));
    expect(res.ok).toBe(false);
  });

  it("REJECTS fill-or-kill (orderType=2)", async () => {
    const res = checkPostOnlyInPtb(await buildOrderPtb(2));
    expect(res.ok).toBe(false);
  });

  it("does not false-pass: orderType=0 with a stray selfMatchingOption=3 still BLOCKs", async () => {
    // The old scan would have seen a `3` (from selfMatchingOption) and passed.
    const res = checkPostOnlyInPtb(await buildOrderPtb(0, 3, true));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("not POST_ONLY");
  });

  it("ignores PTBs with no place_limit_order call", async () => {
    const tx = new Transaction();
    tx.setSender(WALLET);
    tx.setGasBudget(50_000_000n);
    tx.setGasPrice(1000n);
    tx.setGasPayment([{ objectId: "0x" + "d".repeat(64), version: "1", digest: "1".repeat(32) }]);
    const b64 = Buffer.from(await tx.build()).toString("base64");
    expect(checkPostOnlyInPtb(b64).ok).toBe(true);
  });
});
