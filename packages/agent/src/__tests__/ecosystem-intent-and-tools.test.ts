/**
 * Ecosystem discovery — deterministic intent routing, directive forcing, and the
 * thin marker tools. Includes regression assertions that the new keyword matches
 * never hijack swap / send / portfolio / protocols / stats / lend.
 */

import { describe, it, expect } from "vitest";
import { parseIntent } from "../intent/parse-intent";
import { buildIntentDirective } from "../intent/intent-directive";
import { getStablecoinYields } from "../tools/get-stablecoin-yields";
import { getTopTvl } from "../tools/get-top-tvl";
import { getTrendingTokens } from "../tools/get-trending-tokens";

const run = (t: unknown, input: unknown) =>
  (t as { execute: (i: unknown) => Promise<Record<string, unknown>> }).execute(input);

const WALLET = "0x" + "a".repeat(64);

describe("parseIntent — ecosystem discovery (positive)", () => {
  const cases: Array<[string, string]> = [
    ["best stablecoin yields on sui", "ecosystemYields"],
    ["highest stablecoin apy", "ecosystemYields"],
    ["where can i earn on stablecoins", "ecosystemYields"],
    ["top tvl on sui", "ecosystemTvl"],
    ["biggest protocols on sui", "ecosystemTvl"],
    ["most value locked on sui", "ecosystemTvl"],
    ["memes on sui", "ecosystemTokens"],
    ["trending tokens", "ecosystemTokens"],
    ["hot coins on sui", "ecosystemTokens"],
  ];
  it.each(cases)("%s → %s", (text, action) => {
    expect(parseIntent(text)?.action).toBe(action);
  });
});

describe("parseIntent — regression (value verbs + existing intents unchanged)", () => {
  it("swap stays a swap", () => {
    expect(parseIntent("swap 1 SUI to USDC")?.action).toBe("swap");
  });
  it("send stays a send", () => {
    expect(parseIntent(`send 1 SUI to ${"0x" + "b".repeat(64)}`)?.action).toBe("send");
  });
  it("lend stays a lend", () => {
    expect(parseIntent("lend 1 SUI")?.action).toBe("lend");
  });
  it("portfolio / protocols / stats unchanged", () => {
    expect(parseIntent("portfolio")?.action).toBe("portfolio");
    expect(parseIntent("protocols")?.action).toBe("protocols");
    expect(parseIntent("stats")?.action).toBe("stats");
  });
});

describe("buildIntentDirective — forces exactly one ecosystem tool", () => {
  it("'best stablecoin yields on sui' → only getStablecoinYields", async () => {
    const d = (await buildIntentDirective("best stablecoin yields on sui", WALLET)) ?? "";
    expect(d).toContain("getStablecoinYields");
    expect(d).toContain("Call ONLY");
  });
  it("'top tvl on sui' → only getTopTvl", async () => {
    const d = (await buildIntentDirective("top tvl on sui", WALLET)) ?? "";
    expect(d).toContain("getTopTvl");
  });
  it("'memes on sui' → only getTrendingTokens", async () => {
    const d = (await buildIntentDirective("memes on sui", WALLET)) ?? "";
    expect(d).toContain("getTrendingTokens");
  });
  it("regression: 'show my portfolio' still → getPortfolio", async () => {
    const d = (await buildIntentDirective("portfolio", WALLET)) ?? "";
    expect(d).toContain("getPortfolio");
    expect(d).not.toContain("getTopTvl");
  });
});

describe("ecosystem tools — thin markers (no network I/O)", () => {
  it("each returns the { chain: 'Sui' } marker", async () => {
    expect(await run(getStablecoinYields, {})).toEqual({ chain: "Sui" });
    expect(await run(getTopTvl, {})).toEqual({ chain: "Sui" });
    expect(await run(getTrendingTokens, {})).toEqual({ chain: "Sui" });
  });
});
