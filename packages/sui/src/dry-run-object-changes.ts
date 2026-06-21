/**
 * Extract per-object changes from a dry-run response for the pre-sign permissions UI.
 *
 * This is the "what state changes" half of the preview (the coin-value half comes
 * from balanceChanges → balanceDeltas). objectChanges variants carry DIFFERENT owner
 * shapes than balanceChanges, so this is NOT a copy of extractBalanceDeltas — each
 * change type (created/mutated/transferred/deleted/wrapped) is handled explicitly.
 *
 * SECURITY RULE: an owner the parser cannot positively classify as the sender is
 * treated as "third-party" (never benign), so a real outbound transfer can never be
 * mislabeled into a bucket that the display cap might hide.
 */

/**
 * Who ends up holding / controlling the object:
 *  - "you":         an address owner equal to the tx sender.
 *  - "recipient":   the address the user INTENTIONALLY chose for a transfer (== the
 *                   action's recipientAddress). Expected by definition, so it must NOT
 *                   raise the "unexpected outflow" alarm — only neutral "verify the address".
 *  - "shared":      a shared object (e.g. a DEX pool).
 *  - "object":      owned by another object (dynamic field / wrapped) or Immutable.
 *  - "third-party": an address owner that is NEITHER the sender NOR the intended recipient,
 *                   OR an owner shape the parser could not classify (fail-loud, never hidden).
 *                   This is the genuine security signal — an asset leaving to an address the
 *                   user did not designate (e.g. a malicious swap rerouting funds).
 */
export type ObjectOwnerKind = "you" | "recipient" | "shared" | "object" | "third-party";

/** A single object change surfaced to the permissions UI. */
export interface ObjectChange {
  objectId: string;
  changeType: "created" | "mutated" | "transferred" | "deleted" | "wrapped";
  /** Move type of the object (e.g. 0x2::coin::Coin<…::usdc::USDC>), when present. */
  objectType?: string;
  ownerKind: ObjectOwnerKind;
}

type RawChange = Record<string, unknown>;

/** Classify the owner-of-interest of a change relative to the sender + intended recipient. */
function classifyOwner(owner: unknown, sender?: string, recipient?: string): ObjectChange["ownerKind"] {
  // Address comparison is case-insensitive: the wallet address may arrive mixed-case
  // while the RPC emits lowercase owners — matching the lowercase-both convention used
  // by the outflow / price-impact gates. A case-sensitive miss would mislabel the
  // user's own objects as "third-party" and raise false security alarms.
  const senderNorm = sender?.toLowerCase();
  const recipientNorm = recipient?.toLowerCase();
  // An address owner → "you" (sender), "recipient" (the address the user designated for
  // this transfer), else "third-party" (the real alarm: an address the user never chose).
  const classifyAddr = (addr?: string): ObjectChange["ownerKind"] => {
    const a = addr?.toLowerCase();
    if (senderNorm && a === senderNorm) return "you";
    if (recipientNorm && a === recipientNorm) return "recipient";
    return "third-party";
  };
  if (owner === "Immutable") return "object";
  if (owner && typeof owner === "object") {
    if ("AddressOwner" in owner) return classifyAddr((owner as { AddressOwner: string }).AddressOwner);
    if ("Shared" in owner) return "shared";
    if ("ObjectOwner" in owner) return "object";
    if ("ConsensusAddressOwner" in owner) {
      return classifyAddr((owner as { ConsensusAddressOwner: { owner?: string } }).ConsensusAddressOwner?.owner);
    }
  }
  // Unrecognized owner shape → never assume benign.
  return "third-party";
}

/** True for a Coin<…::sui::SUI> object type (the gas / SUI plumbing coin). */
function isSuiCoin(objectType?: string): boolean {
  return !!objectType && /::coin::Coin<[^<>]*::sui::SUI>/.test(objectType);
}

/**
 * Parse `response.objectChanges` into display-ready ObjectChange rows.
 *
 * Filtering: the universal gas-coin mutation (a Coin<SUI> mutated and still owned by
 * the sender) is dropped — its value is already reflected in balanceDeltas, and it
 * appears in every transaction. Created coins, pool mutations, deletes/wraps, and
 * (always) transfers are kept. `published` package changes are skipped (not user assets).
 *
 * Defensive: reads fields by name and never throws — a parse miss yields [], matching
 * the fail-soft posture of extractBalanceDeltas.
 */
export function extractObjectChanges(
  response: { objectChanges?: unknown },
  senderAddress?: string,
  recipientAddress?: string,
): ObjectChange[] {
  const changes = (response.objectChanges ?? []) as RawChange[];
  const out: ObjectChange[] = [];
  for (const c of changes) {
    const type = c.type as string | undefined;
    if (!type || type === "published") continue;

    let ownerKind: ObjectChange["ownerKind"];
    if (type === "transferred") ownerKind = classifyOwner(c.recipient, senderAddress, recipientAddress);
    else if (type === "created" || type === "mutated") ownerKind = classifyOwner(c.owner, senderAddress, recipientAddress);
    else ownerKind = "object"; // deleted | wrapped — no destination owner

    const objectType = typeof c.objectType === "string" ? c.objectType : undefined;

    // Drop gas / SUI-coin plumbing the user already sees as a balance delta.
    if (type === "mutated" && ownerKind === "you" && isSuiCoin(objectType)) continue;

    out.push({
      objectId: typeof c.objectId === "string" ? c.objectId : String(c.objectId ?? ""),
      changeType: type as ObjectChange["changeType"],
      objectType,
      ownerKind,
    });
  }
  return out;
}

/**
 * Shape an object-change list for the capped preview. Third-party transfers and any
 * change whose owner could not be classified as the sender are ALWAYS shown (the
 * highest-signal security items — never hidden behind the cap); remaining slots up to
 * `cap` are filled with the rest. `total` is the true count so the UI can render a
 * "+K more" affordance without silently truncating.
 */
export function capObjectsForPreview(
  all: ObjectChange[],
  cap: number,
): { shown: ObjectChange[]; total: number } {
  const mustShow = all.filter((o) => o.changeType === "transferred" || o.ownerKind === "third-party");
  const rest = all.filter((o) => !(o.changeType === "transferred" || o.ownerKind === "third-party"));
  return {
    shown: [...mustShow, ...rest.slice(0, Math.max(0, cap - mustShow.length))],
    total: all.length,
  };
}
