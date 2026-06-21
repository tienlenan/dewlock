/**
 * Tests: pure preview-format helpers — owner labelling, flow-row derivation
 * (parity: no delta dropped), coinDecimals threading, object grouping.
 */

import { describe, it, expect } from "vitest";
import {
  resolveOwnerLabel,
  deriveFlowRows,
  groupObjectsTouched,
  thirdPartyTransfers,
  formatNative,
  type ContractCallDisplay,
  type ObjectTouchedDisplay,
} from "../tx-preview-format";

const YOU = "0x" + "a".repeat(64);
const RECIPIENT = "0x" + "c".repeat(64);
const STRANGER = "0x" + "e".repeat(64);
const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

const cetus: ContractCallDisplay = {
  target: "0xpkg::pool::swap",
  protocolName: "Cetus",
  category: "dex",
  status: "active",
  allowlistKind: "pinned",
};

describe("resolveOwnerLabel", () => {
  it("labels the sender 'You' (case-insensitive)", () => {
    expect(resolveOwnerLabel(YOU.toUpperCase(), { walletAddress: YOU }).label).toBe("You");
  });
  it("labels the recipient 'Recipient' and keeps the raw 0x", () => {
    const l = resolveOwnerLabel(RECIPIENT, { walletAddress: YOU, recipientAddress: RECIPIENT });
    expect(l.kind).toBe("recipient");
    expect(l.sub).toBe(RECIPIENT);
  });
  it("labels an unknown owner 'Counterparty' with a short 0x (never invents an address)", () => {
    const l = resolveOwnerLabel(STRANGER, { walletAddress: YOU });
    expect(l.label).toBe("Counterparty");
    expect(l.sub).toContain("…");
  });
});

describe("deriveFlowRows", () => {
  it("derives an out + in row for a swap, labelled by the contract counterparty", () => {
    const rows = deriveFlowRows(
      {
        balanceDeltas: [
          { coinType: SUI, amount: "-12500000000", owner: YOU },
          { coinType: USDC, amount: "48200000", owner: YOU },
        ],
        contractsCalled: [cetus],
        coinDecimals: { [SUI]: 9, [USDC]: 6 },
      },
      YOU,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ label: "You", direction: "out", ticker: "SUI", counterparty: "Cetus" });
    expect(rows[1]).toMatchObject({ label: "You", direction: "in", ticker: "USDC", counterparty: "Cetus" });
  });

  it("for a transfer, the counterparty is the Recipient", () => {
    const rows = deriveFlowRows(
      {
        balanceDeltas: [
          { coinType: SUI, amount: "-1000000000", owner: YOU },
          { coinType: SUI, amount: "1000000000", owner: RECIPIENT },
        ],
        recipientAddress: RECIPIENT,
        coinDecimals: { [SUI]: 9 },
      },
      YOU,
    );
    expect(rows[0].counterparty).toBe("Recipient");
    expect(rows[1].label).toBe("Recipient");
  });

  it("PARITY: emits one row per non-zero delta (no delta dropped), incl. unknown owners", () => {
    const deltas = [
      { coinType: SUI, amount: "-5", owner: YOU },
      { coinType: USDC, amount: "9", owner: STRANGER }, // unmatched owner
      { coinType: SUI, amount: "0", owner: YOU }, // zero → skipped
    ];
    const rows = deriveFlowRows({ balanceDeltas: deltas }, YOU);
    const nonZero = deltas.filter((d) => BigInt(d.amount) !== 0n).length;
    expect(rows).toHaveLength(nonZero);
    expect(rows.some((r) => r.label === "Counterparty")).toBe(true);
  });

  it("threads coinDecimals so low-decimal coins format at the right scale", () => {
    const rows = deriveFlowRows(
      { balanceDeltas: [{ coinType: USDC, amount: "-48200000", owner: YOU }], coinDecimals: { [USDC]: 6 } },
      YOU,
    );
    expect(rows[0].amountFormatted).toBe(formatNative("48200000", USDC, { [USDC]: 6 }));
    expect(rows[0].amountFormatted).toBe("48.2");
  });
});

describe("groupObjectsTouched / thirdPartyTransfers", () => {
  const objs: ObjectTouchedDisplay[] = [
    { objectId: "0x1", changeType: "created", objectType: "Coin<USDC>", ownerKind: "you" },
    { objectId: "0x2", changeType: "mutated", objectType: "Pool", ownerKind: "shared" },
    { objectId: "0x3", changeType: "transferred", objectType: "NFT", ownerKind: "third-party" },
  ];
  it("buckets by change type", () => {
    const g = groupObjectsTouched(objs);
    expect(g.created).toHaveLength(1);
    expect(g.mutated).toHaveLength(1);
    expect(g.transferred).toHaveLength(1);
    expect(g.deleted).toEqual([]);
  });
  it("surfaces third-party transfers as the high-signal set", () => {
    expect(thirdPartyTransfers(objs).map((o) => o.objectId)).toEqual(["0x3"]);
  });
  it("does NOT count a to-self transfer (ownerKind 'you') as third-party", () => {
    const selfTransfer: ObjectTouchedDisplay[] = [
      { objectId: "0x9", changeType: "transferred", objectType: "Coin<SUI>", ownerKind: "you" },
    ];
    expect(thirdPartyTransfers(selfTransfer)).toEqual([]);
  });
  it("empty input → all-empty buckets", () => {
    const g = groupObjectsTouched([]);
    expect(Object.values(g).every((b) => b.length === 0)).toBe(true);
  });
});
