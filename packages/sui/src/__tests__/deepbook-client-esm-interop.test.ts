/**
 * Regression: DeepBook SDK ESM/CJS interop unwrap (client.ts resolveDeepBookNamespace).
 *
 * Under the Next/Turbopack server runtime the @mysten/deepbook-v3 CJS build lands its
 * exports under `.default` instead of hoisting them as named exports. The previous code
 * read `mod.DeepBookClient` directly → undefined → "DeepBookClient is not a constructor",
 * which surfaced live as a `bm_resolve_error` (BalanceManager resolution couldn't run).
 *
 * resolveDeepBookNamespace returns whichever namespace actually carries DeepBookClient.
 * Tested as a pure function (vi.mock can't simulate the `.default` shape — its proxy
 * throws on undefined named-export access, unlike a real runtime module namespace).
 */

import { describe, it, expect } from "vitest";
import { resolveDeepBookNamespace } from "../deepbook/client";

class FakeDeepBookClient {}
const OrderType = { POST_ONLY: 3 };

describe("resolveDeepBookNamespace — ESM/CJS interop unwrap", () => {
  it("unwraps a .default-wrapped CJS module (the failing live shape)", () => {
    const wrapped = { default: { DeepBookClient: FakeDeepBookClient, OrderType } };
    const ns = resolveDeepBookNamespace(wrapped);
    expect(ns.DeepBookClient).toBe(FakeDeepBookClient);
    expect(ns.OrderType.POST_ONLY).toBe(3);
  });

  it("passes through a top-level ESM namespace unchanged", () => {
    const flat = { DeepBookClient: FakeDeepBookClient, OrderType };
    const ns = resolveDeepBookNamespace(flat);
    expect(ns.DeepBookClient).toBe(FakeDeepBookClient);
  });

  it("falls back to the module itself when neither shape carries DeepBookClient", () => {
    const empty = {};
    expect(resolveDeepBookNamespace(empty)).toBe(empty);
  });
});
