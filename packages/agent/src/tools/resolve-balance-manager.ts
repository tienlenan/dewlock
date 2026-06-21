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
  // resolution.ids is OLDEST-first; ids[0] is the canonical account. A wallet may hold
  // more than one BM (accidental pre-fix duplicate); we do NOT hard-block on that — we
  // pick the canonical one, and a client-carried id can disambiguate explicitly.
  const ids = resolution.ids;

  if (clientBmId) {
    // Client carried an id. If the wallet has known BMs and this isn't one of them, it's
    // a clear mismatch (fail-closed). If none are indexed yet (just-created lag), trust it.
    const lc = clientBmId.toLowerCase();
    if (ids.length > 0 && !ids.some((id) => id.toLowerCase() === lc)) {
      return {
        ok: false,
        reasons: ["The provided BalanceManager id doesn't match your wallet's account. Refusing (fail-closed)."],
        gates: ["bm_ownership"],
      };
    }
    return { ok: true, bmId: clientBmId };
  }

  // No client id → auto-resolve. None → onboarding; otherwise the canonical (oldest) BM.
  if (ids.length === 0) {
    return {
      ok: false,
      reasons: [
        "You don't have a DeepBook trading account (BalanceManager) yet. " +
          "Set one up (create + fund) to place and manage orders.",
      ],
      gates: ["onboarding_required"],
    };
  }
  return { ok: true, bmId: ids[0] };
}
