/**
 * Tests for the DefiLlama TVL fetcher. fetch is ALWAYS mocked — never hits the
 * live API. Covers: Sui-filter + name-match success (with the Sui chain slice),
 * no-match → unavailable, fetch failure → all unavailable, and the TTL cache.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getProtocolTvls, __clearTvlCache } from "../tvl";

const LLAMA = [
  { name: "Cetus", chains: ["Sui", "Aptos"], tvl: 999, chainTvls: { Sui: 200, Aptos: 799 } },
  { name: "NAVI Lending", chains: ["Sui"], tvl: 150, chainTvls: { Sui: 150 } },
  { name: "Uniswap", chains: ["Ethereum"], tvl: 5000 }, // not Sui — filtered out
];

beforeEach(() => __clearTvlCache());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getProtocolTvls", () => {
  it("matches Sui protocols by name and reads the Sui-chain TVL slice", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, json: () => Promise.resolve(LLAMA) } as Response));
    const out = await getProtocolTvls([
      { id: "cetus", name: "Cetus" },
      { id: "navi", name: "NAVI" },
    ]);
    expect(out.cetus).toMatchObject({ value: 200, source: "DefiLlama" }); // Sui slice, not 999
    expect(out.navi).toMatchObject({ value: 150, source: "DefiLlama" }); // containment match
  });

  it("sums all containment matches when a protocol splits into multiple DefiLlama entries", async () => {
    // Cetus on DefiLlama is two Sui entries (CLMM + DLMM), no exact "Cetus".
    const split = [
      { name: "Cetus CLMM", chains: ["Sui"], tvl: 25, chainTvls: { Sui: 25 } },
      { name: "Cetus DLMM", chains: ["Sui"], tvl: 5, chainTvls: { Sui: 5 } },
    ];
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, json: () => Promise.resolve(split) } as Response));
    const out = await getProtocolTvls([{ id: "cetus", name: "Cetus" }]);
    expect(out.cetus).toMatchObject({ value: 30, source: "DefiLlama" }); // 25 + 5, order-independent
  });

  it("does not false-match short DefiLlama names via the reverse-containment direction", async () => {
    const shorty = [{ name: "Su", chains: ["Sui"], tvl: 999, chainTvls: { Sui: 999 } }];
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, json: () => Promise.resolve(shorty) } as Response));
    const out = await getProtocolTvls([{ id: "suilend", name: "Suilend" }]);
    expect(out.suilend).toHaveProperty("unavailable", true); // "su" (<3 chars) must not match "suilend"
  });

  it("marks unavailable when no Sui protocol matches", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, json: () => Promise.resolve(LLAMA) } as Response));
    const out = await getProtocolTvls([{ id: "nonexistent", name: "Zzzyzx Protocol" }]);
    expect(out.nonexistent).toHaveProperty("unavailable", true);
  });

  it("marks every protocol unavailable when DefiLlama is unreachable", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: false, status: 503 } as Response));
    const out = await getProtocolTvls([{ id: "cetus", name: "Cetus" }]);
    expect(out.cetus).toHaveProperty("unavailable", true);
  });

  it("caches the protocol list (one fetch across calls)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(LLAMA) } as Response));
    vi.stubGlobal("fetch", fetchMock);
    await getProtocolTvls([{ id: "cetus", name: "Cetus" }]);
    await getProtocolTvls([{ id: "navi", name: "NAVI" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
