import { describe, it, expect } from "vitest";
import { isAftermathSwapCall } from "../protocol-constants";

/**
 * The Aftermath router emits combinatorial, route-shaped function families on an
 * upgradeable `router` package, so the Guardian matches them by module::function
 * (package-agnostic). A SUI→USDC route emits `router::redeem_w1` (a route-internal
 * balance redeem) — this regression locks that family in so the swap isn't false-blocked.
 */
describe("isAftermathSwapCall — router function families", () => {
  it("accepts the redeem_w<N> family (was false-blocked)", () => {
    expect(isAftermathSwapCall("router", "redeem_w1")).toBe(true);
    expect(isAftermathSwapCall("router", "redeem_w2")).toBe(true);
  });

  it("accepts the existing route families", () => {
    expect(isAftermathSwapCall("router", "begin_router_tx_r1_w1_varied_in")).toBe(true);
    expect(isAftermathSwapCall("router", "initiate_path_by_percent_w1")).toBe(true);
    expect(isAftermathSwapCall("router", "swap_a_to_b_w1")).toBe(true);
    expect(isAftermathSwapCall("router", "end_router_tx_r1_w1")).toBe(true);
    expect(isAftermathSwapCall("router", "assert_expected_out")).toBe(true);
  });

  it("accepts legacy swap_cap scaffolding", () => {
    expect(isAftermathSwapCall("swap_cap", "obtain_router_cap")).toBe(true);
  });

  it("rejects non-route functions + non-router modules", () => {
    expect(isAftermathSwapCall("router", "withdraw_all")).toBe(false);
    expect(isAftermathSwapCall("router", "borrow")).toBe(false);
    expect(isAftermathSwapCall("lending_market", "redeem_w1")).toBe(false);
  });
});
