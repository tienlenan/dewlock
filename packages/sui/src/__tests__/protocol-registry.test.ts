/**
 * Tests: protocol registry — single-authored allowlist, posture, status-aware routing.
 *
 * Proves:
 *  - ALLOWED_MOVE_TARGETS is derived only from active+built protocols (+ CORE),
 *    preserving the exact enforced set (no drift between registry and allowlist).
 *  - Active targets are recognized; unknown/excluded targets are inactive.
 *  - assertProtocolActive refuses hacked / off-model / deferred / unknown protocols
 *    BEFORE any PTB is built, with a status-aware reason (allowlist-before-build).
 */

import { describe, it, expect } from "vitest";
import {
  CETUS_CLMM_PACKAGE,
  DEEPBOOK_PACKAGE,
  CORE_TARGETS,
  ALLOWED_MOVE_TARGETS,
} from "../allowlist";
import {
  getProtocols,
  getProtocol,
  getActiveProtocols,
  getExcludedProtocols,
  getBuiltProtocols,
  getActiveMoveTargets,
  getProtocolByTarget,
  isTargetActive,
  assertProtocolActive,
} from "../protocol-registry";

describe("protocol registry — posture", () => {
  it("lists active and excluded protocols (Cetus active, Nemo hacked, Bluefin off-model)", () => {
    expect(getProtocol("cetus")?.status).toBe("active");
    expect(getProtocol("nemo")?.status).toBe("hacked");
    expect(getProtocol("bluefin")?.status).toBe("listed-excluded");
    // Hacked entries carry incident metadata for the status-aware block reason.
    expect(getProtocol("nemo")?.lastIncident?.date).toBe("2025-09-07");
    expect(getProtocol("aftermath-perp")?.lastIncident?.date).toBe("2026-04-29");
  });

  it("every protocol is either active or excluded (partition is total)", () => {
    const all = getProtocols().length;
    expect(getActiveProtocols().length + getExcludedProtocols().length).toBe(all);
    expect(all).toBeGreaterThan(10);
  });

  it("only active+built protocols contribute Move targets", () => {
    const built = getBuiltProtocols().map((p) => p.id).sort();
    // Built adapters: Aftermath (aggregator) + Cetus + DeepBook + Cetus aggregator (swap) + NAVI/Suilend (lending) + Wormhole (bridge).
    expect(built).toEqual(["aftermath", "cetus", "cetus-aggregator", "deepbook", "navi", "suilend", "wormhole"]);
    // NAVI is built with deposit/repay targets; borrow/withdraw are NOT allowlisted.
    expect(getProtocol("navi")?.allowlistedTargets.some((t) => t.includes("entry_deposit"))).toBe(true);
    expect(getProtocol("navi")?.allowlistedTargets.some((t) => t.includes("borrow"))).toBe(false);
    // A deferred-but-active protocol (e.g. Scallop) still contributes no targets.
    expect(getProtocol("scallop")?.status).toBe("active");
    expect(getProtocol("scallop")?.allowlistedTargets).toEqual([]);
  });
});

describe("protocol registry — single-authored allowlist", () => {
  it("ALLOWED_MOVE_TARGETS = CORE_TARGETS ∪ active-built targets (exact, no drift)", () => {
    const expected = new Set([...CORE_TARGETS, ...getActiveMoveTargets()]);
    expect(ALLOWED_MOVE_TARGETS).toEqual(expected);
    // Backstop on the exact size: 8 core (pay::split_and_transfer, transfer::
    // public_share_object, coin::destroy_zero, coin::from_balance, balance::join,
    // balance::split, coin::into_balance, registry::lookup) + 4 Cetus + 8 DeepBook
    // (place_limit_order, cancel_order, proof_as_owner, proof_as_trader, bm::new,
    // bm::deposit, bm::withdraw, bm::withdraw_all) + 6 aggregator (3 router scaffolding
    // calls + cetus::swap under the verified integration pkg and the default pkg +
    // deepbookv3::swap) + 3 NAVI (entry_deposit, entry_repay, pool::refresh_stake)
    // + 5 Suilend (create_obligation, deposit×2, rebalance_staker, repay) + 1 Wormhole
    // (complete_transfer) + 3 Aftermath (swap_cap::obtain_router_cap, initiate_path,
    // return_router_cap_already_payed_fee) = 38.
    expect(ALLOWED_MOVE_TARGETS.size).toBe(38);
  });

  it("isTargetActive: active Cetus/DeepBook targets + core targets are active", () => {
    expect(isTargetActive(`${CETUS_CLMM_PACKAGE}::pool::swap`)).toBe(true);
    expect(isTargetActive(`${DEEPBOOK_PACKAGE}::pool::place_limit_order`)).toBe(true);
    for (const t of CORE_TARGETS) expect(isTargetActive(t)).toBe(true);
  });

  it("isTargetActive: unknown / non-active targets are inactive (fail-closed)", () => {
    expect(isTargetActive("0xdeadbeef::drain::steal")).toBe(false);
    expect(isTargetActive(`${CETUS_CLMM_PACKAGE}::pool::rug_pull`)).toBe(false);
    expect(isTargetActive("")).toBe(false);
  });

  it("getProtocolByTarget maps a built target back to its protocol", () => {
    expect(getProtocolByTarget(`${CETUS_CLMM_PACKAGE}::pool::swap`)?.id).toBe("cetus");
    expect(getProtocolByTarget(`${DEEPBOOK_PACKAGE}::pool::cancel_order`)?.id).toBe("deepbook");
    expect(getProtocolByTarget("0xnope::x::y")).toBeUndefined();
  });
});

describe("protocol registry — assertProtocolActive (allowlist-before-build gate)", () => {
  it("active+built protocol passes", () => {
    expect(assertProtocolActive("cetus").ok).toBe(true);
    expect(assertProtocolActive("deepbook").ok).toBe(true);
  });

  it("hacked protocol is refused with a status-aware reason (id + incident date)", () => {
    const r = assertProtocolActive("nemo");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Nemo");
    expect(r.reason).toContain("hacked");
    expect(r.reason).toContain("2025-09-07");
  });

  it("off-model (listed-excluded) protocol is refused", () => {
    const r = assertProtocolActive("bluefin");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("listed but excluded");
  });

  it("active-but-deferred protocol (no adapter yet) is refused", () => {
    const r = assertProtocolActive("scallop"); // active, audit-clean, but no adapter
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("no Dewlock adapter is built yet");
  });

  it("unknown protocol id is refused (fail-closed)", () => {
    const r = assertProtocolActive("totally-made-up");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Unknown protocol");
  });
});
