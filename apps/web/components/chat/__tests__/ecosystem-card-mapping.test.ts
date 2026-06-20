/**
 * toolResultToCard — ecosystem discovery markers map to the right card type by
 * toolName (the result body is just a { chain: "Sui" } marker). Unrelated tool
 * names → null.
 */

import { describe, it, expect } from "vitest";
import { toolResultToCard } from "../use-copilot-chat";

describe("toolResultToCard — ecosystem markers (by toolName)", () => {
  it("maps each ecosystem tool to its self-fetching card", () => {
    expect(toolResultToCard("getStablecoinYields", { chain: "Sui" })).toEqual({ type: "ecosystem-yields" });
    expect(toolResultToCard("getTopTvl", { chain: "Sui" })).toEqual({ type: "ecosystem-tvl" });
    expect(toolResultToCard("getTrendingTokens", { chain: "Sui" })).toEqual({ type: "ecosystem-tokens" });
  });

  it("returns null for an unrelated tool name", () => {
    expect(toolResultToCard("getSomethingElse", { chain: "Sui" })).toBeNull();
  });

  it("still maps the existing protocol-metrics marker (no regression)", () => {
    expect(
      toolResultToCard("getProtocolMetrics", { supportedProtocols: 7, perProtocol: [] }),
    ).toEqual({ type: "protocol-metrics" });
  });
});
