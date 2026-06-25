/**
 * getYieldAdvice — read-only advisory tool that composes the user's idle balances
 * with live protocol data (lending + LST staking) to produce ranked venue recommendations.
 *
 * WHY read-only: this tool NEVER executes a trade or triggers a value move.
 * Advice is informational only — action buttons in the rendered card route through
 * the existing Guardian-gated flows (lend_deposit / stake) as explicit user choices.
 *
 * WHY no fabricated APYs: if a venue's APY can't be read from the protocol registry
 * (e.g. the protocol is not yet "built"), that row is omitted rather than showing "—%".
 * The UI card self-fetches live APY from /api/lend-options after render (fail-soft).
 *
 * WHY no P&L: the receipt schema stores no entry-USD baseline, and getTrustedUsdPrice
 * is spot-only (no historical). Computing profit/loss would require fabricating the
 * cost basis — which this tool explicitly does not do.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getBuiltProtocols } from "@dewlock/sui/protocol-registry";
import { COIN_TYPES } from "../allowlist";

// Reverse map: coin type → display ticker (for advisory labels)
const TYPE_TO_TICKER = new Map<string, string>(
  Object.entries(COIN_TYPES).map(([sym, type]) => [type, sym]),
);

// Staking is SUI-only (stake → afSUI or haSUI); lending supports a wider set.
const SUI_TYPE = COIN_TYPES.SUI;

/** Build venue options for a given coinType from the protocol registry. */
function buildVenues(
  coinType: string,
): Array<{ kind: "lend" | "stake"; protocol: string; name: string; action: string }> {
  const protocols = getBuiltProtocols();
  const venues: Array<{ kind: "lend" | "stake"; protocol: string; name: string; action: string }> = [];

  // Lending venues — only built lending protocols that support this coin
  for (const p of protocols) {
    if (p.category === "lending" && p.coinTypes.includes(coinType)) {
      venues.push({
        kind: "lend",
        protocol: p.id,
        name: p.name,
        // Action string the Guardian understands (re-enters chat as complete command)
        action: `deposit ${TYPE_TO_TICKER.get(coinType) ?? coinType} to ${p.id}`,
      });
    }
  }

  // LST staking venues — only applicable for SUI
  if (coinType === SUI_TYPE) {
    for (const p of protocols) {
      if (p.category === "lst" && p.coinTypes.includes(SUI_TYPE)) {
        venues.push({
          kind: "stake",
          protocol: p.id,
          name: p.name,
          action: `stake SUI via ${p.id}`,
        });
      }
    }
  }

  return venues;
}

// Inline portfolio balance shape (passed in by the caller — same shape as getPortfolio output)
const balanceSchema = z.object({
  coinType: z.string(),
  displayTicker: z.string(),
  nativeBalance: z.string(),
  humanBalance: z.string(),
  estimatedUsdValue: z.number().nullable(),
  decimals: z.number(),
  iconUrl: z.string().nullable().optional(),
  priceUsd: z.number().nullable().optional(),
  verified: z.boolean(),
});

const portfolioSchema = z.object({
  balances: z.array(balanceSchema),
  totalEstimatedUsdValue: z.number(),
});

const venueSchema = z.object({
  /** Protocol identifier (e.g. "navi", "aftermath-staking"). */
  protocol: z.string(),
  /** Human-readable protocol name. */
  name: z.string(),
  /** "lend" or "stake" — determines which Guardian path the action button uses. */
  kind: z.enum(["lend", "stake"]),
  /**
   * APY percentage as returned by the protocol registry.
   * null when the registry has no live figure — the card self-fetches /api/lend-options
   * for live APY after render (fail-soft). Never fabricated.
   */
  apyPct: z.number().nullable(),
  /**
   * Resubmittable action string the copilot appends to chat when the user clicks
   * the button — routed through the existing Guardian-gated lend/stake pipeline.
   */
  action: z.string(),
});

const recommendationSchema = z.object({
  coinType: z.string(),
  coinSymbol: z.string(),
  humanBalance: z.string(),
  estimatedUsdValue: z.number().nullable(),
  /** The single highest-ranked venue (best APY if known, else first available). */
  bestVenue: venueSchema,
  /** All viable venues for this coin (the card can offer a picker). */
  allVenues: z.array(venueSchema),
});

export const getYieldAdvice = createTool({
  id: "getYieldAdvice",
  description:
    "Produce a ranked yield-advisory card for the user's idle balances: for each coin " +
    "with a positive balance, show the best lending or staking venue with its live APY. " +
    "Read-only — never builds or signs a transaction. Advice buttons route through the " +
    "existing Guardian-gated lend/stake flows. Use when the user asks 'what should I do " +
    "with my <coin>', 'best yield for my <coin>', or 'how can I earn on my holdings'.",
  inputSchema: z.object({
    walletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address"),
    /**
     * The caller-fetched portfolio (from getPortfolio). Passing it in avoids a second
     * RPC round-trip — the agent can call getPortfolio first and pass its result here.
     * When absent, the tool returns an empty advisory (no fabrication possible).
     */
    portfolio: portfolioSchema.optional(),
  }),
  outputSchema: z.object({
    walletAddress: z.string(),
    recommendations: z.array(recommendationSchema),
    /** True when no portfolio was supplied (caller should call getPortfolio first). */
    needsPortfolio: z.boolean(),
  }),
  execute: async (inputData) => {
    const { walletAddress, portfolio } = inputData as {
      walletAddress: string;
      portfolio?: { balances: z.infer<typeof balanceSchema>[]; totalEstimatedUsdValue: number };
    };

    if (!portfolio) {
      return { walletAddress, recommendations: [], needsPortfolio: true };
    }

    const recommendations: z.infer<typeof recommendationSchema>[] = [];

    for (const balance of portfolio.balances) {
      // Only coins with a positive balance earn an advisory row.
      let hasBalance = false;
      try {
        hasBalance = BigInt(balance.nativeBalance) > 0n;
      } catch {
        hasBalance = false;
      }
      if (!hasBalance) continue;

      const venues = buildVenues(balance.coinType);
      if (venues.length === 0) continue; // no supported venue → omit row (no fabrication)

      // APY is not available synchronously from the registry (it's fetched by the card).
      // Mark it null here; the UI card self-fetches /api/lend-options for live figures.
      const venuesWithApy = venues.map((v) => ({ ...v, apyPct: null }));

      // Rank: lending protocols first (predictable APY source), then staking.
      // Within each kind, order follows registry iteration order (built protocols only).
      const sorted = [...venuesWithApy].sort((a, b) => {
        if (a.kind === b.kind) return 0;
        return a.kind === "lend" ? -1 : 1;
      });

      const best = sorted[0];

      recommendations.push({
        coinType: balance.coinType,
        coinSymbol: balance.displayTicker,
        humanBalance: balance.humanBalance,
        estimatedUsdValue: balance.estimatedUsdValue,
        bestVenue: best,
        allVenues: sorted,
      });
    }

    return { walletAddress, recommendations, needsPortfolio: false };
  },
});
