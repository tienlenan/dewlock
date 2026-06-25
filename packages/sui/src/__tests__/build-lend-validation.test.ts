/**
 * Tests: buildLend input validation (fail-fast before any RPC/build).
 *
 * The fixture build path itself calls tx.build({client}), which needs a real
 * client's gas resolver (unavailable in vitest — same constraint the swap-builder
 * test documents), so the happy-path build is exercised live. Here we lock the
 * validation guards that fire BEFORE any build: bad amount / unknown coin / bad
 * action all throw LendBuildError so the Guardian treats them as BLOCK.
 */

import { describe, it, expect } from "vitest";
import { COIN_TYPES } from "../allowlist";
import { buildLend, LendBuildError, type LendSpec } from "../build-lend";

const client = {} as never;

function spec(over: Partial<LendSpec> = {}): LendSpec {
  return {
    senderAddress: "0x" + "a".repeat(64),
    protocol: "navi",
    action: "deposit",
    coinType: COIN_TYPES.USDC,
    amountNative: 1_000_000n,
    ...over,
  };
}

describe("buildLend validation", () => {
  it("rejects a non-positive amount", async () => {
    await expect(buildLend(client, spec({ amountNative: 0n }))).rejects.toBeInstanceOf(LendBuildError);
    await expect(buildLend(client, spec({ amountNative: -5n }))).rejects.toBeInstanceOf(LendBuildError);
  });

  it("rejects an unknown coin type (fake-coin guard)", async () => {
    await expect(buildLend(client, spec({ coinType: "0xdeadbeef::scam::SCAM" }))).rejects.toThrow(/Unknown coin type/);
  });

  it("rejects a truly unsupported action (not in deposit/repay/borrow/withdraw)", async () => {
    // "borrow" and "withdraw" are now valid LendActions. Only actions outside the four
    // supported verbs throw "Unsupported lend action".
    await expect(
      buildLend(client, spec({ action: "liquidate" as unknown as LendSpec["action"] })),
    ).rejects.toThrow(/Unsupported lend action/);
  });
});
