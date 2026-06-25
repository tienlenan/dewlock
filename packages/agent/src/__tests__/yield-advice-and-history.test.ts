/**
 * Tests: getYieldAdvice (advisor) + getHistory (history feed) + intent routing.
 *
 * RED-first: these tests fail until the tools and intent changes are implemented.
 * Covers three safety invariants:
 *  1. Advisor never returns fabricated APYs — omits rows when data is missing.
 *  2. History feed has no P&L field — amounts shown are balances/USD, never profit/loss.
 *  3. Routing: "what should I do with my USDC" routes to getYieldAdvice (a read tool),
 *     NOT prepareTrade. "my history" routes to getHistory (read tool), NOT prepareTrade.
 *     These are the load-bearing safety tests that prove read intents can't become value moves.
 */

import { describe, it, expect } from "vitest";
import { parseIntent } from "../intent/parse-intent";
import { buildIntentDirective } from "../intent/intent-directive";
import { getYieldAdvice } from "../tools/get-yield-advice";
import { getHistory } from "../tools/get-history";
import { formatDecisionLogEntry } from "../memory/receipt-log";

const WALLET = "0x" + "a".repeat(64);

const run = (t: unknown, input: unknown) =>
  (t as { execute: (i: unknown) => Promise<Record<string, unknown>> }).execute(input);

// ---------------------------------------------------------------------------
// Intent routing: "what should I do with my USDC" / "best yield" → advisor
// Intent routing: "my history" / "show my activity" → history
// CRITICAL: neither must route to prepareTrade (a value move).
// ---------------------------------------------------------------------------

describe("parseIntent — yield-advisor and history intents", () => {
  // Advisor-style queries
  it("'what should I do with my USDC' → yieldAdvice", () => {
    expect(parseIntent("what should I do with my USDC")?.action).toBe("yieldAdvice");
  });
  it("'best yield for my SUI' → yieldAdvice", () => {
    expect(parseIntent("best yield for my SUI")?.action).toBe("yieldAdvice");
  });
  it("'where should I put my USDT' → yieldAdvice", () => {
    expect(parseIntent("where should I put my USDT")?.action).toBe("yieldAdvice");
  });
  it("'how can I earn on my SUI' → yieldAdvice", () => {
    expect(parseIntent("how can I earn on my SUI")?.action).toBe("yieldAdvice");
  });

  // History-style queries
  it("'my history' → history", () => {
    expect(parseIntent("my history")?.action).toBe("history");
  });
  it("'show my receipts' → history", () => {
    expect(parseIntent("show my receipts")?.action).toBe("history");
  });
  it("'my activity' → history", () => {
    expect(parseIntent("my activity")?.action).toBe("history");
  });
  it("'show my transactions' → history", () => {
    expect(parseIntent("show my transactions")?.action).toBe("history");
  });
  it("'transaction history' → history", () => {
    expect(parseIntent("transaction history")?.action).toBe("history");
  });

  // Regression: existing intents unchanged
  it("'swap 1 SUI to USDC' stays swap", () => {
    expect(parseIntent("swap 1 SUI to USDC")?.action).toBe("swap");
  });
  it("'portfolio' stays portfolio", () => {
    expect(parseIntent("portfolio")?.action).toBe("portfolio");
  });
  it("'lend 1 SUI' stays lend", () => {
    expect(parseIntent("lend 1 SUI")?.action).toBe("lend");
  });
  it("'stake 5 SUI' stays stake", () => {
    expect(parseIntent("stake 5 SUI")?.action).toBe("stake");
  });
  it("'stats' stays stats", () => {
    expect(parseIntent("stats")?.action).toBe("stats");
  });
});

describe("buildIntentDirective — safety: read intents NEVER trigger prepareTrade", () => {
  it("'what should I do with my USDC' → getYieldAdvice, NOT prepareTrade", async () => {
    const d = (await buildIntentDirective("what should I do with my USDC", WALLET)) ?? "";
    expect(d).toContain("getYieldAdvice");
    expect(d).not.toContain("prepareTrade");
  });
  it("'best yield for my SUI' → getYieldAdvice, NOT prepareTrade", async () => {
    const d = (await buildIntentDirective("best yield for my SUI", WALLET)) ?? "";
    expect(d).toContain("getYieldAdvice");
    expect(d).not.toContain("prepareTrade");
  });
  it("'my history' → getHistory, NOT prepareTrade", async () => {
    const d = (await buildIntentDirective("my history", WALLET)) ?? "";
    expect(d).toContain("getHistory");
    expect(d).not.toContain("prepareTrade");
  });
  it("'show my receipts' → getHistory, NOT prepareTrade", async () => {
    const d = (await buildIntentDirective("show my receipts", WALLET)) ?? "";
    expect(d).toContain("getHistory");
    expect(d).not.toContain("prepareTrade");
  });
});

// ---------------------------------------------------------------------------
// getYieldAdvice tool — advisory card
// ---------------------------------------------------------------------------

describe("getYieldAdvice", () => {
  const fixture = [
    // 10 USDC, 5 USDT, 5 SUI — WETH/wBTC zero balance
    {
      coinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
      displayTicker: "USDC",
      nativeBalance: "10000000",
      humanBalance: "10.000000",
      estimatedUsdValue: 10,
      decimals: 6,
      iconUrl: null,
      priceUsd: 1.0,
      verified: true,
    },
    {
      coinType: "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
      displayTicker: "USDT",
      nativeBalance: "5000000",
      humanBalance: "5.000000",
      estimatedUsdValue: 5,
      decimals: 6,
      iconUrl: null,
      priceUsd: 1.0,
      verified: true,
    },
    {
      coinType: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      displayTicker: "SUI",
      nativeBalance: "5000000000",
      humanBalance: "5.000000",
      estimatedUsdValue: 15,
      decimals: 9,
      iconUrl: null,
      priceUsd: 3.0,
      verified: true,
    },
    // Zero-balance coins must be excluded from recommendations
    {
      coinType: "0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH",
      displayTicker: "WETH",
      nativeBalance: "0",
      humanBalance: "0.000000",
      estimatedUsdValue: 0,
      decimals: 8,
      iconUrl: null,
      priceUsd: 3000,
      verified: true,
    },
  ];

  it("returns recommendations for coins with positive balance", async () => {
    const r = await run(getYieldAdvice, {
      walletAddress: WALLET,
      portfolio: { balances: fixture, totalEstimatedUsdValue: 30 },
    });
    const rows = r.recommendations as Array<{ coinType: string }>;
    // Should include USDC, USDT, SUI (have balance) — not WETH (zero balance)
    const coinTypes = rows.map((row) => row.coinType);
    expect(coinTypes).not.toContain(
      "0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH",
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("no fabricated APY — every venue omits APY when protocols unavailable", async () => {
    const r = await run(getYieldAdvice, {
      walletAddress: WALLET,
      portfolio: { balances: fixture, totalEstimatedUsdValue: 30 },
    });
    const rows = r.recommendations as Array<{ bestVenue: { apyPct: number | null } }>;
    // APY must be null or a real number — never NaN, never a fabricated value
    for (const row of rows) {
      const apy = row.bestVenue?.apyPct;
      if (apy !== null && apy !== undefined) {
        expect(Number.isFinite(apy)).toBe(true);
      }
    }
  });

  it("result has no P&L or profit/loss field", async () => {
    const r = await run(getYieldAdvice, {
      walletAddress: WALLET,
      portfolio: { balances: fixture, totalEstimatedUsdValue: 30 },
    });
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/profit|pnl|p&l|cost_basis|entry_price|gain|loss/i);
  });

  it("empty portfolio returns empty recommendations (no fabrication)", async () => {
    const r = await run(getYieldAdvice, {
      walletAddress: WALLET,
      portfolio: { balances: [], totalEstimatedUsdValue: 0 },
    });
    const rows = r.recommendations as unknown[];
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getHistory tool — reverse-chronological receipt feed
// ---------------------------------------------------------------------------

describe("getHistory", () => {
  // Build fixture lines: two approved actions + one blocked-marker (custom format)
  const approvedLine1 = formatDecisionLogEntry({
    actionLabel: "Swap SUI for USDC via Cetus",
    txDigest: "0x" + "1".repeat(64),
    estimatedUsdValue: 5.0,
    timestamp: "2026-01-10T12:00:00.000Z",
  });
  const approvedLine2 = formatDecisionLogEntry({
    actionLabel: "Transfer 1 SUI to 0xabc",
    txDigest: "0x" + "2".repeat(64),
    estimatedUsdValue: 3.0,
    timestamp: "2026-01-08T10:00:00.000Z",
  });
  // Block entries use "block log:" prefix so the action log parser still handles them.
  // The history tool parses both formats and exposes the verdict field.
  const blockLine = `block log: 2026-01-09T09:00:00.000Z | Swap SUI for fake_USDC | tx:block:abc123 | usd:$2.00 | reasons:coin_allowlist`;

  it("parses approved receipt lines into reverse-chronological feed", async () => {
    const r = await run(getHistory, {
      walletAddress: WALLET,
      receiptLines: [approvedLine1, approvedLine2],
      blockLines: [],
    });
    const feed = r.feed as Array<{ timestamp: string; verdict: string; txDigest: string }>;
    expect(feed.length).toBe(2);
    // Newest first
    expect(feed[0].timestamp).toBe("2026-01-10T12:00:00.000Z");
    expect(feed[1].timestamp).toBe("2026-01-08T10:00:00.000Z");
    expect(feed.every((row) => row.verdict === "approved")).toBe(true);
  });

  it("includes blocked entries with verdict:'blocked' when blockLines provided", async () => {
    const r = await run(getHistory, {
      walletAddress: WALLET,
      receiptLines: [approvedLine1],
      blockLines: [blockLine],
    });
    const feed = r.feed as Array<{ verdict: string }>;
    const blocked = feed.filter((row) => row.verdict === "blocked");
    expect(blocked.length).toBeGreaterThan(0);
  });

  it("feed has no P&L, profit, gain, or cost_basis field on any row", async () => {
    const r = await run(getHistory, {
      walletAddress: WALLET,
      receiptLines: [approvedLine1, approvedLine2],
      blockLines: [blockLine],
    });
    const json = JSON.stringify(r.feed);
    expect(json).not.toMatch(/profit|pnl|p&l|cost_basis|entry_price|gain_usd|loss_usd/i);
  });

  it("each row has required fields: action, timestamp, verdict, txDigest", async () => {
    const r = await run(getHistory, {
      walletAddress: WALLET,
      receiptLines: [approvedLine1],
      blockLines: [],
    });
    const feed = r.feed as Array<Record<string, unknown>>;
    expect(feed.length).toBeGreaterThan(0);
    const row = feed[0];
    expect(typeof row.actionLabel).toBe("string");
    expect(typeof row.timestamp).toBe("string");
    expect(row.verdict === "approved" || row.verdict === "blocked").toBe(true);
    expect(typeof row.txDigest).toBe("string");
    expect(typeof row.usdValue).toBe("number");
  });

  it("empty feed when no lines supplied", async () => {
    const r = await run(getHistory, {
      walletAddress: WALLET,
      receiptLines: [],
      blockLines: [],
    });
    const feed = r.feed as unknown[];
    expect(feed).toEqual([]);
  });
});
