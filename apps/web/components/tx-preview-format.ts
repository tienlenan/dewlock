/**
 * Pure formatting + derivation helpers for the transaction preview card.
 *
 * Kept React-free and side-effect-free so the regression-critical logic — amount
 * scaling, semantic owner labelling, flow-row derivation, object grouping — is unit
 * testable. The card and its sub-components render whatever these return.
 */

// ---------------------------------------------------------------------------
// Display types — mirror the agent preview payload (display-only)
// ---------------------------------------------------------------------------

export type AllowlistKind = "pinned" | "signature-matched" | "none";

export interface ContractCallDisplay {
  target: string;
  protocolName: string;
  category: string;
  status: string;
  allowlistKind: AllowlistKind;
}

export type ObjectOwnerKind = "you" | "recipient" | "shared" | "object" | "third-party";

export interface ObjectTouchedDisplay {
  objectId: string;
  changeType: "created" | "mutated" | "transferred" | "deleted" | "wrapped";
  objectType?: string;
  ownerKind: ObjectOwnerKind;
}

export interface BalanceDeltaDisplay {
  coinType: string;
  /** Signed bigint as string (negative = outflow). */
  amount: string;
  owner: string;
}

// ---------------------------------------------------------------------------
// Amount / type formatting
// ---------------------------------------------------------------------------

export function shortCoinType(coinType: string): string {
  const parts = coinType.split("::");
  return parts[parts.length - 1] ?? coinType;
}

// Last-resort decimals — only used when the server didn't supply coinDecimals
// (legacy payloads / fixtures). The server-resolved map is authoritative.
const FALLBACK_DECIMALS: Record<string, number> = {
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI": 9,
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": 6,
  "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT": 6,
};

export function formatNative(native: string, coinType: string, coinDecimals?: Record<string, number>): string {
  const decimals = coinDecimals?.[coinType] ?? FALLBACK_DECIMALS[coinType] ?? 9;
  const value = Number(BigInt(native)) / 10 ** decimals;
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function formatMist(mist: string): string {
  const sui = Number(BigInt(mist)) / 1e9;
  return `${sui.toFixed(4)} SUI`;
}

export function formatUsd(usd: number): string {
  return usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export function short0x(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

// ---------------------------------------------------------------------------
// Owner labelling — maps a raw address to a semantic label. Never invents an
// address; an unknown owner is "Counterparty" + the raw short 0x (anti-spoof).
// ---------------------------------------------------------------------------

export interface OwnerCtx {
  walletAddress?: string;
  recipientAddress?: string;
  contractsCalled?: ContractCallDisplay[];
}

export interface OwnerLabel {
  kind: "you" | "recipient" | "counterparty";
  label: string;
  /** Raw 0x kept for anti-spoof display when the label isn't "You". */
  sub?: string;
}

export function resolveOwnerLabel(owner: string, ctx: OwnerCtx): OwnerLabel {
  const o = owner.toLowerCase();
  if (ctx.walletAddress && o === ctx.walletAddress.toLowerCase()) return { kind: "you", label: "You" };
  if (ctx.recipientAddress && o === ctx.recipientAddress.toLowerCase()) {
    return { kind: "recipient", label: "Recipient", sub: owner };
  }
  return { kind: "counterparty", label: "Counterparty", sub: short0x(owner) };
}

/** The other side of the user's flows — recipient (transfer) or primary contract (swap). */
export function primaryCounterpartyLabel(ctx: OwnerCtx): string {
  if (ctx.recipientAddress) return "Recipient";
  const c = ctx.contractsCalled?.find((x) => x.allowlistKind !== "none");
  return c?.protocolName ?? "Counterparty";
}

// ---------------------------------------------------------------------------
// Flow-row derivation — ONE row per non-zero balance delta (no delta dropped),
// each labelled with direction + semantic from/to for the Rows / Map views.
// ---------------------------------------------------------------------------

/** One leg of an atomic composite (e.g. swap→lend), as surfaced on the preview. */
export interface CompositeFlowLeg {
  actionType: string; // "swap" | "lend_deposit" | "send" | "stake"
  coinTypeIn: string;
  coinTypeOut?: string;
  amountInNative: string;
  lendingProtocol?: string;
  /** Send leg: the resolved 0x recipient — shown as the flow node label. */
  recipient?: string;
  /** Swap leg: estimated output in native units of coinTypeOut (live route estimate). */
  estimatedOutNative?: string;
  /** Swap leg: guaranteed-minimum output in native units (slippage floor). */
  minOutNative?: string;
}

export interface FlowPreviewInput {
  balanceDeltas: BalanceDeltaDisplay[];
  recipientAddress?: string;
  contractsCalled?: ContractCallDisplay[];
  coinDecimals?: Record<string, number>;
  /** Present for atomic composites — drives an explicit multi-leg flow (see deriveCompositeFlow). */
  compositeFlow?: CompositeFlowLeg[];
}

/** A rendered hop in a composite flow: a protocol node + the coin flowing INTO it. */
export interface CompositeFlowStep {
  /** Protocol/step node label, e.g. "Cetus Aggregator" / "NAVI". */
  nodeLabel: string;
  /** Category sub-line, e.g. "Swap → USDC" / "Lending · deposit". */
  nodeSub: string;
  /** Coin flowing into this node from the previous node, e.g. "1 SUI" / "USDC". */
  edgeLabel: string;
  /** True for the first hop (funds leaving the wallet) → rendered as an outflow. */
  isOutflow: boolean;
  /** ProtocolLogo id for this node's brand mark (e.g. "cetus-aggregator", "navi"). */
  logoId?: string;
}

/**
 * Turn composite legs into an ordered You → leg0 → leg1 … chain for the flow map.
 *
 * WHY a dedicated path (not deriveFlowRows): a composite's intermediate coin (e.g. the
 * swap-output USDC that is immediately deposited) nets to ~0 at the wallet, so it never
 * appears in balanceDeltas — the lend leg would be invisible. These legs come straight
 * from the declared recipe, so every hop is shown explicitly and accurately.
 */
export function deriveCompositeFlow(
  legs: CompositeFlowLeg[],
  coinDecimals?: Record<string, number>,
): CompositeFlowStep[] {
  // Format a leg's estimated output as "≈ <amt> <TICKER>" (or the bare ticker when no estimate).
  const outLabel = (leg: CompositeFlowLeg): string | null => {
    if (!leg.coinTypeOut) return null;
    const ticker = shortCoinType(leg.coinTypeOut);
    return leg.estimatedOutNative
      ? `≈ ${formatNative(leg.estimatedOutNative, leg.coinTypeOut, coinDecimals)} ${ticker}`
      : ticker;
  };

  return legs.map((leg, i) => {
    if (leg.actionType === "swap") {
      const amtIn = formatNative(leg.amountInNative, leg.coinTypeIn, coinDecimals);
      const out = outLabel(leg);
      return {
        nodeLabel: "Cetus Aggregator",
        // Show the swap's estimated OUTPUT on the node (in = the incoming edge below).
        nodeSub: out ? `Swap → ${out}` : "Swap",
        edgeLabel: `${amtIn} ${shortCoinType(leg.coinTypeIn)}`,
        isOutflow: i === 0,
        logoId: "cetus-aggregator",
      };
    }
    if (leg.actionType === "lend_deposit") {
      // The deposited coin = this leg's input = the prior (swap) leg's estimated output.
      const prev = legs[i - 1];
      const incoming = prev ? outLabel(prev) : null;
      return {
        nodeLabel: (leg.lendingProtocol ?? "lending").toUpperCase(),
        nodeSub: "Lending · deposit",
        edgeLabel: incoming ?? shortCoinType(leg.coinTypeIn),
        isOutflow: false,
        logoId: leg.lendingProtocol, // "navi" | "suilend"
      };
    }
    if (leg.actionType === "send") {
      // A send leg moves funds OUT of the wallet to the recipient — its own outflow node.
      const amtIn = formatNative(leg.amountInNative, leg.coinTypeIn, coinDecimals);
      const to = leg.recipient
        ? `${leg.recipient.slice(0, 6)}…${leg.recipient.slice(-4)}`
        : "recipient";
      return {
        nodeLabel: to,
        nodeSub: "Send",
        edgeLabel: `${amtIn} ${shortCoinType(leg.coinTypeIn)}`,
        isOutflow: true,
      };
    }
    if (leg.actionType === "stake") {
      const amtIn = formatNative(leg.amountInNative, leg.coinTypeIn, coinDecimals);
      return {
        nodeLabel: "Haedal",
        nodeSub: "Stake → haSUI",
        edgeLabel: `${amtIn} ${shortCoinType(leg.coinTypeIn)}`,
        isOutflow: i === 0,
        logoId: "haedal",
      };
    }
    return {
      nodeLabel: leg.actionType,
      nodeSub: "Step",
      edgeLabel: shortCoinType(leg.coinTypeIn),
      isOutflow: i === 0,
    };
  });
}

export interface FlowRow {
  /** Semantic label of the delta owner (You / Recipient / Counterparty). */
  label: string;
  sub?: string;
  amountFormatted: string;
  ticker: string;
  direction: "out" | "in";
  /** The other side, for arrow rendering. */
  counterparty: string;
}

export function deriveFlowRows(preview: FlowPreviewInput, walletAddress?: string): FlowRow[] {
  const ctx: OwnerCtx = {
    walletAddress,
    recipientAddress: preview.recipientAddress,
    contractsCalled: preview.contractsCalled,
  };
  const counterparty = primaryCounterpartyLabel(ctx);
  const rows: FlowRow[] = [];
  for (const d of preview.balanceDeltas) {
    const amt = BigInt(d.amount);
    if (amt === 0n) continue;
    const owner = resolveOwnerLabel(d.owner, ctx);
    rows.push({
      label: owner.label,
      sub: owner.sub,
      amountFormatted: formatNative((amt < 0n ? -amt : amt).toString(), d.coinType, preview.coinDecimals),
      ticker: shortCoinType(d.coinType),
      direction: amt < 0n ? "out" : "in",
      counterparty,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Object grouping — buckets objectsTouched by change type for the permissions UI.
// ---------------------------------------------------------------------------

export type GroupedObjects = Record<ObjectTouchedDisplay["changeType"], ObjectTouchedDisplay[]>;

export function groupObjectsTouched(objects: ObjectTouchedDisplay[]): GroupedObjects {
  const grouped: GroupedObjects = { created: [], mutated: [], transferred: [], deleted: [], wrapped: [] };
  for (const o of objects) grouped[o.changeType].push(o);
  return grouped;
}

/**
 * Objects genuinely leaving the wallet to a third party — the highest-signal security
 * item. A `transferred` object that returns to the sender (ownerKind "you", e.g. a
 * to-self TransferObjects) is NOT a third-party transfer and must not raise the alarm;
 * a real outbound transfer always classifies as ownerKind "third-party" upstream.
 */
export function thirdPartyTransfers(objects: ObjectTouchedDisplay[]): ObjectTouchedDisplay[] {
  return objects.filter((o) => o.ownerKind === "third-party");
}

// ---------------------------------------------------------------------------
// Contract grouping — collapse an N-step route into one protocol entry.
// ---------------------------------------------------------------------------

/** One protocol the PTB invokes, with the individual Move calls it made. */
export interface ContractGroup {
  protocolName: string;
  category: string;
  allowlistKind: AllowlistKind;
  /** Every package::module::function this protocol contributed, in first-seen order. */
  targets: string[];
}

const KIND_RANK: Record<AllowlistKind, number> = { pinned: 2, "signature-matched": 1, none: 0 };

/**
 * Group raw contract calls by protocol so a multi-step aggregator route (begin_router_tx,
 * initiate_path, swap_*, redeem, end_router_tx, …) shows as ONE "Aftermath Router" entry
 * with its calls listed — not N redundant rows. The group's allowlistKind is the WEAKEST
 * of its calls, so a ✓ chip can never over-claim for a protocol that also has unpinned hops.
 */
export function groupContractsByProtocol(contracts: ContractCallDisplay[]): ContractGroup[] {
  const map = new Map<string, ContractGroup>();
  for (const c of contracts) {
    const g = map.get(c.protocolName);
    if (g) {
      g.targets.push(c.target);
      if (KIND_RANK[c.allowlistKind] < KIND_RANK[g.allowlistKind]) g.allowlistKind = c.allowlistKind;
    } else {
      map.set(c.protocolName, { protocolName: c.protocolName, category: c.category, allowlistKind: c.allowlistKind, targets: [c.target] });
    }
  }
  return [...map.values()];
}
