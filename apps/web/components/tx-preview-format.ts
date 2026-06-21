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

export interface FlowPreviewInput {
  balanceDeltas: BalanceDeltaDisplay[];
  recipientAddress?: string;
  contractsCalled?: ContractCallDisplay[];
  coinDecimals?: Record<string, number>;
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
