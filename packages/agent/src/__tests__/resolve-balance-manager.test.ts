/**
 * Tests: BalanceManager resolution decision (resolve-balance-manager.ts).
 *
 * Regression for the live onboarding bug: funding a JUST-created BM returned
 * `onboarding_required` because the fullnode hadn't indexed the new shared object yet
 * (getBalanceManagerIds → []). The fix honors the client-carried id during that lag
 * window, blocking only on a clear mismatch.
 */

import { describe, it, expect } from "vitest";
import { resolveBalanceManagerForAction } from "../tools/resolve-balance-manager";
import type { BalanceManagerResolution } from "@dewlock/sui/balance-manager";

const BM = "0x" + "6".repeat(64);
const OTHER = "0x" + "9".repeat(64);
const ok = (ids: string[]): BalanceManagerResolution => ({ status: "ok", ids });
const rpcErr: BalanceManagerResolution = { status: "rpc_error", ids: [] };

describe("resolveBalanceManagerForAction", () => {
  it("honors a client-carried id when the BM is not yet indexed (post-onboarding lag)", () => {
    // The exact live bug: server returns [] (lag), client carries the just-created id.
    const r = resolveBalanceManagerForAction(ok([]), BM);
    expect(r).toEqual({ ok: true, bmId: BM });
  });

  it("uses the client id when it matches the indexed server BM", () => {
    expect(resolveBalanceManagerForAction(ok([BM]), BM)).toEqual({ ok: true, bmId: BM });
  });

  it("blocks a clear mismatch (server sees a different single BM)", () => {
    const r = resolveBalanceManagerForAction(ok([BM]), OTHER);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gates).toContain("bm_ownership");
  });

  it("auto-resolves the server BM when no client id is supplied", () => {
    expect(resolveBalanceManagerForAction(ok([BM]), undefined)).toEqual({ ok: true, bmId: BM });
  });

  it("returns onboarding_required when no client id and no indexed BM", () => {
    const r = resolveBalanceManagerForAction(ok([]), undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gates).toContain("onboarding_required");
  });

  it("blocks (not 'no BM') on an RPC error — never mints a duplicate", () => {
    const r = resolveBalanceManagerForAction(rpcErr, undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gates).toContain("bm_resolve_error");
  });

  it("picks the canonical (oldest, ids[0]) BM when the wallet has duplicates and no client id", () => {
    // ids are oldest-first; BM is the canonical account, OTHER an accidental later dup.
    expect(resolveBalanceManagerForAction(ok([BM, OTHER]), undefined)).toEqual({ ok: true, bmId: BM });
  });

  it("lets a client-carried id disambiguate among multiple BMs", () => {
    expect(resolveBalanceManagerForAction(ok([BM, OTHER]), OTHER)).toEqual({ ok: true, bmId: OTHER });
  });

  it("blocks a client id that is not among the wallet's BMs", () => {
    const foreign = "0x" + "1".repeat(64);
    const r = resolveBalanceManagerForAction(ok([BM, OTHER]), foreign);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gates).toContain("bm_ownership");
  });
});
