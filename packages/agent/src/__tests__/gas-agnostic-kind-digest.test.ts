/**
 * Gas-agnostic WYSIWYS relies on one invariant: the digest is taken over the
 * TransactionKind (inputs + commands), and that kind is byte-stable across a
 * Transaction.fromKind() round-trip. The Guardian hashes kind bytes server-side; the
 * sign hook re-derives the kind from the wallet-built bytes and must arrive at the SAME
 * digest (the wallet only adds gas/sender, never touches the kind). If this determinism
 * ever broke, every signature would fail the WYSIWYS check — so lock it with a test.
 */

import { describe, it, expect } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { createHash } from "node:crypto";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const SENDER = "0x" + "a".repeat(64);
const RECIP = "0x" + "b".repeat(64);

function sampleKindTx(): Transaction {
  const tx = new Transaction();
  tx.setSender(SENDER);
  const [c] = tx.splitCoins(tx.gas, [tx.pure.u64(123n)]);
  tx.transferObjects([c], tx.pure.address(RECIP));
  return tx;
}

describe("gas-agnostic WYSIWYS — TransactionKind digest determinism", () => {
  it("fromKind round-trips: kind bytes + digest are identical after reconstruction", async () => {
    const kindA = await sampleKindTx().build({ onlyTransactionKind: true });
    const rebuilt = Transaction.fromKind(kindA);
    const kindB = await rebuilt.build({ onlyTransactionKind: true });
    expect(toBase64(kindB)).toEqual(toBase64(kindA));
    expect(sha(kindB)).toEqual(sha(kindA));
  });

  it("two reconstructions of the same kind yield the same digest (stable hashing)", async () => {
    const kind = await sampleKindTx().build({ onlyTransactionKind: true });
    const a = await Transaction.fromKind(kind).build({ onlyTransactionKind: true });
    const b = await Transaction.fromKind(kind).build({ onlyTransactionKind: true });
    expect(sha(a)).toEqual(sha(b));
    expect(sha(a)).toEqual(sha(kind));
  });
});
