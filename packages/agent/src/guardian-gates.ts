/**
 * Guardian pure gates — extractable, unit-testable, zero external SDK dependencies.
 *
 * WHY separated from guardian.ts: the main guardian.ts imports @mysten/sui/transactions
 * and @cetusprotocol/cetus-sui-clmm-sdk for PTB parsing and quote fetching. Those SDKs
 * have ESM initialisation issues in vitest/Node. The deterministic gate logic (allowlist
 * string matching, provenance check, lookalike detection) is pure TS with zero SDK deps
 * and belongs here so tests can import it without pulling the full SDK chain.
 *
 * guardian.ts imports these pure gates from here (e.g. checkProvenance) and re-exports
 * them, so the public API via index.ts is unchanged and there is a single definition.
 */

import {
  ALLOWED_MOVE_TARGETS,
  normalizeHomoglyphs,
  editDistance,
  LOOKALIKE_EDIT_DISTANCE_THRESHOLD,
} from "./allowlist";
import type { TradeProposal } from "./guardian";

// ---------------------------------------------------------------------------
// Gate 7: Allowlist (pure string check — no Transaction.from needed here)
// ---------------------------------------------------------------------------

export interface GateResult {
  ok: boolean;
  reason: string;
}

/**
 * Check that all Move targets in a decoded command list are on the allowlist.
 * This is the pure version — guardian.ts wraps it with Transaction.from() parsing.
 */
export function isTargetAllowed(target: string): boolean {
  return ALLOWED_MOVE_TARGETS.has(target);
}

// ---------------------------------------------------------------------------
// Gate 6: Injection provenance (pure, no SDK)
// ---------------------------------------------------------------------------

export interface ProvenanceResult {
  requiresConfirm: boolean;
  blocked: boolean;
  reason?: string;
}

export function checkProvenance(proposal: TradeProposal): ProvenanceResult {
  const { argProvenance, amountInNative, recipientAddress, walletAddress } = proposal;

  const hasDerivedArg =
    argProvenance.recipient === "derived" ||
    argProvenance.amount === "derived" ||
    argProvenance.coinType === "derived";

  // Hard block: derived recipient on a value-moving transfer to a third party.
  const untracedRecipientWithValue =
    proposal.actionType === "transfer" &&
    argProvenance.recipient === "derived" &&
    amountInNative > 0n &&
    recipientAddress !== walletAddress;

  if (untracedRecipientWithValue) {
    return {
      requiresConfirm: false,
      blocked: true,
      reason:
        `Transfer recipient "${recipientAddress}" was not provided in the current user message — ` +
        "it appears to come from memory or injected pool data. " +
        "Blocking: injection provenance gate. Please retype the recipient explicitly.",
    };
  }

  // Hard block: borrow/withdraw with a derived amount or coinType.
  // A borrow or withdraw whose amount/coinType came from memory or injected context
  // (not the current user turn) could silently move value the user never authorised.
  // Unlike a transfer where the recipient is the suspicious field, here the
  // amount/coinType are the sensitive args — a derived value on either → hard block.
  const isBorrowOrWithdraw =
    proposal.actionType === "lend_borrow" || proposal.actionType === "lend_withdraw";
  const hasDerivedValueArg =
    argProvenance.amount === "derived" || argProvenance.coinType === "derived";

  if (isBorrowOrWithdraw && hasDerivedValueArg) {
    const which = argProvenance.amount === "derived" ? "amount" : "coinType";
    return {
      requiresConfirm: false,
      blocked: true,
      reason:
        `Lending action "${proposal.actionType}" has a derived ${which} — ` +
        "it appears to come from memory or injected context rather than the current user message. " +
        "Blocking: injection provenance gate. Please retype the amount and coin explicitly.",
    };
  }

  // Hard block: stake/unstake with a derived amount or coinType.
  // A staking action whose amount/coinType came from memory or injected context
  // (not the current user turn) could silently move value the user never authorised.
  // Same invariant as borrow/withdraw: the amount and coin are the sensitive args.
  const isStakeOrUnstake =
    proposal.actionType === "stake" || proposal.actionType === "unstake";

  if (isStakeOrUnstake && hasDerivedValueArg) {
    const which = argProvenance.amount === "derived" ? "amount" : "coinType";
    return {
      requiresConfirm: false,
      blocked: true,
      reason:
        `Staking action "${proposal.actionType}" has a derived ${which} — ` +
        "it appears to come from memory or injected context rather than the current user message. " +
        "Blocking: injection provenance gate. Please retype the amount and coin explicitly.",
    };
  }

  return {
    requiresConfirm: hasDerivedArg,
    blocked: false,
  };
}

// ---------------------------------------------------------------------------
// Gate 8: SuiNS lookalike (pure, no SDK)
// ---------------------------------------------------------------------------

export interface LookalikeResult {
  suspect: boolean;
  similarTo: string | null;
}

export function checkSuiNSLookalike(
  inputName: string,
  verifiedContacts: string[],
): LookalikeResult {
  const normalizedInput = normalizeHomoglyphs(
    inputName.toLowerCase().replace(/\.sui$/, ""),
  );

  for (const contact of verifiedContacts) {
    const normalizedContact = normalizeHomoglyphs(
      contact.toLowerCase().replace(/\.sui$/, ""),
    );
    if (normalizedInput === normalizedContact) continue; // exact match = not lookalike
    const dist = editDistance(normalizedInput, normalizedContact);
    if (dist <= LOOKALIKE_EDIT_DISTANCE_THRESHOLD) {
      return { suspect: true, similarTo: contact };
    }
  }
  return { suspect: false, similarTo: null };
}
