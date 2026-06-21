/**
 * Tests: dry-run objectChanges extraction + capped-preview shaping.
 *
 * The security-load-bearing guarantees:
 *  - an owner that is NOT positively the sender → "third-party" (never benign)
 *  - the gas / SUI-coin mutation is filtered (already shown as a balance delta)
 *  - third-party transfers are NEVER hidden by the display cap
 *  - a parse miss yields [] rather than throwing
 */

import { describe, it, expect } from "vitest";
import {
  extractObjectChanges,
  capObjectsForPreview,
  type ObjectChange,
} from "../dry-run-object-changes";

const SENDER = "0x" + "a".repeat(64);
const OTHER = "0x" + "c".repeat(64);
const SUI_COIN = "0x2::coin::Coin<0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI>";
const USDC_COIN = "0x2::coin::Coin<0xdba34::usdc::USDC>";

const resp = (objectChanges: unknown) => ({ objectChanges });

describe("extractObjectChanges", () => {
  it("classifies a created coin owned by the sender as 'you'", () => {
    const out = extractObjectChanges(
      resp([{ type: "created", objectId: "0x1", objectType: USDC_COIN, owner: { AddressOwner: SENDER } }]),
      SENDER,
    );
    expect(out).toEqual([
      { objectId: "0x1", changeType: "created", objectType: USDC_COIN, ownerKind: "you" },
    ]);
  });

  it("classifies a transfer to a non-sender address as 'third-party'", () => {
    const out = extractObjectChanges(
      resp([{ type: "transferred", objectId: "0x2", objectType: USDC_COIN, recipient: { AddressOwner: OTHER } }]),
      SENDER,
    );
    expect(out[0].ownerKind).toBe("third-party");
  });

  it("classifies a transfer to the INTENDED recipient as 'recipient' (not the third-party alarm)", () => {
    const out = extractObjectChanges(
      resp([{ type: "transferred", objectId: "0x2r", objectType: USDC_COIN, recipient: { AddressOwner: OTHER } }]),
      SENDER,
      OTHER, // OTHER is the address the user designated for this transfer
    );
    expect(out[0].ownerKind).toBe("recipient");
  });

  it("still flags a transfer to an UNEXPECTED address as 'third-party' even when a recipient is set", () => {
    const UNEXPECTED = "0x" + "e".repeat(64);
    const out = extractObjectChanges(
      resp([{ type: "transferred", objectId: "0x2u", objectType: USDC_COIN, recipient: { AddressOwner: UNEXPECTED } }]),
      SENDER,
      OTHER, // intended recipient is OTHER, but the asset goes to UNEXPECTED → real alarm
    );
    expect(out[0].ownerKind).toBe("third-party");
  });

  it("classifies a shared object (pool) as 'shared'", () => {
    const out = extractObjectChanges(
      resp([{ type: "mutated", objectId: "0x3", objectType: "0xp::pool::Pool", owner: { Shared: { initial_shared_version: 1 } } }]),
      SENDER,
    );
    expect(out[0].ownerKind).toBe("shared");
  });

  it("treats an unrecognized owner shape as 'third-party' (never benign)", () => {
    const out = extractObjectChanges(
      resp([{ type: "transferred", objectId: "0x4", objectType: "0xx::m::T", recipient: { MysteryOwner: 1 } }]),
      SENDER,
    );
    expect(out[0].ownerKind).toBe("third-party");
  });

  it("maps Immutable owner to 'object'", () => {
    const out = extractObjectChanges(
      resp([{ type: "created", objectId: "0x4b", objectType: "0xx::m::T", owner: "Immutable" }]),
      SENDER,
    );
    expect(out[0].ownerKind).toBe("object");
  });

  it("filters the gas / SUI-coin mutation owned by the sender", () => {
    const out = extractObjectChanges(
      resp([
        { type: "mutated", objectId: "0xgas", objectType: SUI_COIN, owner: { AddressOwner: SENDER } },
        { type: "created", objectId: "0xusdc", objectType: USDC_COIN, owner: { AddressOwner: SENDER } },
      ]),
      SENDER,
    );
    expect(out.map((o) => o.objectId)).toEqual(["0xusdc"]);
  });

  it("skips published package changes", () => {
    const out = extractObjectChanges(resp([{ type: "published", packageId: "0xpkg" }]), SENDER);
    expect(out).toEqual([]);
  });

  it("returns [] when objectChanges is absent (no throw)", () => {
    expect(extractObjectChanges({}, SENDER)).toEqual([]);
    expect(extractObjectChanges({ objectChanges: undefined }, SENDER)).toEqual([]);
  });

  it("matches sender case-insensitively (mixed-case wallet vs lowercase owner)", () => {
    const mixedCaseSender = "0x" + "A".repeat(64); // wallet may arrive upper-case
    const out = extractObjectChanges(
      resp([{ type: "created", objectId: "0x6", objectType: USDC_COIN, owner: { AddressOwner: SENDER } }]),
      mixedCaseSender,
    );
    expect(out[0].ownerKind).toBe("you");
  });

  it("without senderAddress, an address owner is never 'you'", () => {
    const out = extractObjectChanges(
      resp([{ type: "created", objectId: "0x5", objectType: USDC_COIN, owner: { AddressOwner: SENDER } }]),
    );
    expect(out[0].ownerKind).toBe("third-party");
  });
});

describe("capObjectsForPreview", () => {
  const mk = (id: string, over: Partial<ObjectChange> = {}): ObjectChange => ({
    objectId: id,
    changeType: "mutated",
    ownerKind: "object",
    ...over,
  });

  it("caps the list and reports the true total", () => {
    const all = Array.from({ length: 10 }, (_, i) => mk(`0x${i}`));
    const { shown, total } = capObjectsForPreview(all, 6);
    expect(shown).toHaveLength(6);
    expect(total).toBe(10);
  });

  it("NEVER truncates third-party transfers even beyond the cap", () => {
    const transfers = Array.from({ length: 8 }, (_, i) => mk(`0xt${i}`, { changeType: "transferred", ownerKind: "third-party" }));
    const fillers = Array.from({ length: 4 }, (_, i) => mk(`0xf${i}`));
    const { shown, total } = capObjectsForPreview([...transfers, ...fillers], 6);
    // all 8 transfers survive (mustShow exceeds cap); fillers all dropped
    expect(shown.filter((o) => o.ownerKind === "third-party")).toHaveLength(8);
    expect(shown.filter((o) => o.ownerKind !== "third-party")).toHaveLength(0);
    expect(total).toBe(12);
  });

  it("fills remaining slots with non-priority changes", () => {
    const transfer = mk("0xt", { changeType: "transferred", ownerKind: "third-party" });
    const fillers = Array.from({ length: 10 }, (_, i) => mk(`0xf${i}`));
    const { shown } = capObjectsForPreview([transfer, ...fillers], 6);
    expect(shown).toHaveLength(6); // 1 must-show + 5 fillers
    expect(shown[0].objectId).toBe("0xt");
  });
});
