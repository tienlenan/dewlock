/**
 * Tests: pure preview-format helpers — owner labelling, flow-row derivation
 * (parity: no delta dropped), coinDecimals threading, object grouping.
 */

import { describe, it, expect } from "vitest";
import {
  resolveOwnerLabel,
  deriveFlowRows,
  deriveCompositeFlow,
  groupObjectsTouched,
  groupContractsByProtocol,
  thirdPartyTransfers,
  formatNative,
  type ContractCallDisplay,
  type ObjectTouchedDisplay,
  type CompositeFlowLeg,
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

describe("groupContractsByProtocol", () => {
  const call = (target: string, protocolName: string, allowlistKind: "pinned" | "signature-matched" | "none"): ContractCallDisplay => ({
    target, protocolName, category: "aggregator", status: "active", allowlistKind,
  });

  it("collapses a multi-step route into ONE protocol entry with all its calls", () => {
    const groups = groupContractsByProtocol([
      call("0xrtr::router::begin_router_tx_r1_w1", "Aftermath Router (route)", "signature-matched"),
      call("0xrtr::router::swap_b_to_a_w1", "Aftermath Router (route)", "signature-matched"),
      call("0xrtr::router::end_router_tx_r1_w1", "Aftermath Router (route)", "signature-matched"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].protocolName).toBe("Aftermath Router (route)");
    expect(groups[0].targets).toHaveLength(3);
  });

  it("keeps distinct protocols separate", () => {
    const groups = groupContractsByProtocol([
      call("0xc::pool::swap", "Cetus", "pinned"),
      call("0xd::pool::place_limit_order", "DeepBook V3", "pinned"),
    ]);
    expect(groups.map((g) => g.protocolName)).toEqual(["Cetus", "DeepBook V3"]);
  });

  it("downgrades the group to the WEAKEST allowlistKind (no over-claimed ✓)", () => {
    const groups = groupContractsByProtocol([
      call("0xa::cetus::confirm", "Cetus Aggregator (route)", "pinned"),
      call("0xb::cetus::swap", "Cetus Aggregator (route)", "signature-matched"),
    ]);
    expect(groups[0].allowlistKind).toBe("signature-matched");
  });
});

describe("deriveCompositeFlow", () => {
  const swapLeg: CompositeFlowLeg = {
    actionType: "swap",
    coinTypeIn: SUI,
    coinTypeOut: USDC,
    amountInNative: "1000000000", // 1 SUI
  };
  const lendLeg: CompositeFlowLeg = {
    actionType: "lend_deposit",
    coinTypeIn: USDC,
    amountInNative: "0", // placeholder — deposits the swap output
    lendingProtocol: "navi",
  };

  it("renders BOTH legs of a swap→lend composite (the lend leg is never hidden)", () => {
    const steps = deriveCompositeFlow([swapLeg, lendLeg]);
    expect(steps).toHaveLength(2);

    // Leg 0: the swap — funds leave the wallet (outflow), labelled with the input coin.
    expect(steps[0].nodeLabel).toBe("Cetus Aggregator");
    expect(steps[0].nodeSub).toBe("Swap → USDC");
    expect(steps[0].edgeLabel).toBe("1 SUI");
    expect(steps[0].isOutflow).toBe(true);
    expect(steps[0].logoId).toBe("cetus-aggregator");

    // Leg 1: the lend deposit — the swap output coin flows into the lending protocol.
    expect(steps[1].nodeLabel).toBe("NAVI");
    expect(steps[1].nodeSub).toBe("Lending · deposit");
    expect(steps[1].edgeLabel).toBe("USDC");
    expect(steps[1].isOutflow).toBe(false);
    expect(steps[1].logoId).toBe("navi");
  });

  it("threads coinDecimals into the swap-leg amount", () => {
    const steps = deriveCompositeFlow([{ ...swapLeg, amountInNative: "2500000" }], { [SUI]: 6 });
    expect(steps[0].edgeLabel).toBe("2.5 SUI");
  });

  it("only the first leg is an outflow (later legs move between protocols)", () => {
    const steps = deriveCompositeFlow([swapLeg, lendLeg]);
    expect(steps.filter((s) => s.isOutflow)).toHaveLength(1);
  });
});
