/**
 * Test: fail-closed on simulation error.
 *
 * dryRun error → BLOCK. No fail-open path must exist.
 * The DryRunFailedError wrapper must surface as a block in guardianCheck,
 * not be swallowed and converted to a pass.
 *
 * Three failure modes tested:
 *  1. RPC call throws (network error, timeout, parse error).
 *  2. RPC returns response with no effects field.
 *  3. RPC returns effects with status ≠ "success" (on-chain revert).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { dryRunTransaction, DryRunFailedError } from "@dewlock/sui/dry-run";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
// SuiJsonRpcClient is the v2.x successor to SuiClient — same interface for mocking.
type SuiClient = SuiJsonRpcClient;

// Build a mock SuiClient that controls dryRunTransactionBlock behavior
function makeMockClient(
  behavior:
    | { throws: string }
    | { returns: Partial<Awaited<ReturnType<SuiClient["dryRunTransactionBlock"]>>> },
): SuiClient {
  return {
    dryRunTransactionBlock: vi.fn(async () => {
      if ("throws" in behavior) {
        throw new Error(behavior.throws);
      }
      return behavior.returns as Awaited<ReturnType<SuiClient["dryRunTransactionBlock"]>>;
    }),
  } as unknown as SuiClient;
}

describe("dry-run fail-closed wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws DryRunFailedError when RPC call throws (network error)", async () => {
    const client = makeMockClient({ throws: "Connection refused" });

    await expect(
      dryRunTransaction(client, "dummybase64=="),
    ).rejects.toThrow(DryRunFailedError);

    await expect(
      dryRunTransaction(client, "dummybase64=="),
    ).rejects.toThrow("Dry-run RPC call failed");
  });

  it("throws DryRunFailedError when response has no effects field", async () => {
    const client = makeMockClient({
      returns: {
        // effects is missing/undefined — node couldn't simulate
        effects: undefined as unknown as never,
        balanceChanges: [],
      },
    });

    await expect(
      dryRunTransaction(client, "dummybase64=="),
    ).rejects.toThrow(DryRunFailedError);

    await expect(
      dryRunTransaction(client, "dummybase64=="),
    ).rejects.toThrow("no effects");
  });

  it("throws DryRunFailedError when tx would revert on-chain (status ≠ success)", async () => {
    const client = makeMockClient({
      returns: {
        effects: {
          status: { status: "failure", error: "InsufficientGas" },
          gasUsed: { computationCost: "0", storageCost: "0", storageRebate: "0", nonRefundableStorageFee: "0" },
        } as never,
        balanceChanges: [],
      },
    });

    await expect(
      dryRunTransaction(client, "dummybase64=="),
    ).rejects.toThrow(DryRunFailedError);

    await expect(
      dryRunTransaction(client, "dummybase64=="),
    ).rejects.toThrow("InsufficientGas");
  });

  it("returns structured result on successful dry-run (happy path)", async () => {
    const client = makeMockClient({
      returns: {
        effects: {
          status: { status: "success" },
          gasUsed: {
            computationCost: "1000000",
            storageCost: "500000",
            storageRebate: "200000",
            nonRefundableStorageFee: "0",
          },
        } as never,
        balanceChanges: [
          {
            coinType: "0x2::sui::SUI",
            amount: "-1000000000",
            owner: { AddressOwner: "0xabc" },
          },
        ],
      },
    });

    const result = await dryRunTransaction(client, "dummybase64==");
    expect(result.gasCostMist).toBe(1_300_000n); // 1000000 + 500000 - 200000
    expect(result.balanceDeltas).toHaveLength(1);
    expect(result.balanceDeltas[0].amount).toBe(-1_000_000_000n);
  });

  it("DryRunFailedError is an instance of Error (catchable as Error)", async () => {
    const err = new DryRunFailedError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("DryRunFailedError");
  });

  it("never returns undefined — always throws or returns DryRunResult", async () => {
    // Verify the return type guarantee by checking successful path returns defined result
    const client = makeMockClient({
      returns: {
        effects: {
          status: { status: "success" },
          gasUsed: { computationCost: "0", storageCost: "0", storageRebate: "0", nonRefundableStorageFee: "0" },
        } as never,
        balanceChanges: [],
      },
    });

    const result = await dryRunTransaction(client, "dummybase64==");
    expect(result).toBeDefined();
    expect(result.effects).toBeDefined();
    expect(result.balanceDeltas).toBeDefined();
  });
});
