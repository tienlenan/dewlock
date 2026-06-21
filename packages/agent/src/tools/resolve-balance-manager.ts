/**
 * resolve-balance-manager.ts — decide the BalanceManager id for a BM action.
 *
 * Pure decision over (server resolution result, client-carried id). Extracted from
 * prepareTrade so it is unit-testable without the full tool/SDK stack.
 *
 * KEY behavior: a freshly created BM is NOT yet indexed by the fullnode (shared-object
 * lag of several seconds), so getBalanceManagerIds returns [] immediately after
 * onboarding. The onboarding flow CARRIES the new BM id client-side (create→deposit→
 * first order); we honor that id during the lag window and block only on a CLEAR
 * mismatch (server sees a different single BM). The authoritative ownership guarantee
 * is on-chain: cancel/withdraw/place require the BM owner-proof so a foreign id fails
 * the dry-run; deposit only ADDS funds and is WYSIWYS-signed. RPC error ≠ "no BM".
 */

import type { BalanceManagerResolution } from "@dewlock/sui/balance-manager";

export type BmResolveOutcome =
  | { ok: true; bmId: string }
  | { ok: false; reasons: string[]; gates: string[] };

export function resolveBalanceManagerForAction(
  resolution: BalanceManagerResolution,
  clientBmId: string | undefined,
): BmResolveOutcome {
  if (resolution.status === "rpc_error") {
    return {
      ok: false,
      reasons: ["Couldn't verify your DeepBook trading account right now (network issue). Please retry."],
      gates: ["bm_resolve_error"],
    };
  }
  if (resolution.ids.length > 1) {
    return {
      ok: false,
      reasons: ["Multiple BalanceManagers found for this wallet — unexpected. Refusing for safety."],
      gates: ["bm_ambiguous"],
    };
  }
  const serverBmId = resolution.ids[0]; // undefined when none OR just-created-not-yet-indexed

  if (clientBmId) {
    // Client carried an id. Block only a clear mismatch with an indexed server BM;
    // otherwise trust it (covers the post-onboarding indexing-lag window).
    if (serverBmId && serverBmId.toLowerCase() !== clientBmId.toLowerCase()) {
      return {
        ok: false,
        reasons: ["The provided BalanceManager id doesn't match your wallet's account. Refusing (fail-closed)."],
        gates: ["bm_ownership"],
      };
    }
    return { ok: true, bmId: clientBmId };
  }

  // No client id → must auto-resolve from the indexed set.
  if (!serverBmId) {
    return {
      ok: false,
      reasons: [
        "You don't have a DeepBook trading account (BalanceManager) yet. " +
          "Set one up (create + fund) to place and manage orders.",
      ],
      gates: ["onboarding_required"],
    };
  }
  return { ok: true, bmId: serverBmId };
}
