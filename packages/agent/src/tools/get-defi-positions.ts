/**
 * getDefiPositions — Mastra read tool returning the user's live, actionable DeFi
 * positions: open DeepBook orders, withdrawable BalanceManager balances, and NAVI
 * lending (supplied + health). Suilend is deep-link only (its SDK reads are broken
 * on @mysten/sui 2.18 — we never fabricate a number; "unknown → exclude").
 *
 * Resilience: EVERY source read is wrapped in its own Promise.allSettled element and
 * null/empty-degrades per section, so one throttled DeepBook devInspect or a NAVI
 * outage can never blank the whole tool. Mirrors getPortfolio's fail-soft contract.
 *
 * Read-only: returns no PTBs. The positions feed the actionable portfolio UI, whose
 * buttons POST a fully-specified action to /api/prepare-trade (Guardian + sign).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSuiMainnetClient } from "@dewlock/sui";
import { getExistingBalanceManagers } from "@dewlock/sui/balance-manager";
import { getOpenOrders, getSettledBalances, WHITELISTED_POOL_KEYS } from "@dewlock/sui/account-orders";
import { readNaviLending } from "@dewlock/sui/lending-positions";

const SUILEND_MANAGE_URL = "https://suilend.fi";

export const getDefiPositions = createTool({
  id: "getDefiPositions",
  description:
    "Fetch the user's actionable DeFi positions: open DeepBook orders (cancelable), " +
    "settled BalanceManager balances (withdrawable), and NAVI lending (supplied + health). " +
    "Suilend is a deep-link only. Call this alongside getPortfolio for portfolio/positions questions.",

  inputSchema: z.object({
    walletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address")
      .describe("The user's wallet address to query positions for"),
  }),

  outputSchema: z.object({
    walletAddress: z.string(),
    deepbook: z.object({
      balanceManagerId: z.string().nullable(),
      openOrders: z.array(
        z.object({
          orderId: z.string(),
          poolKey: z.string(),
          side: z.enum(["BUY", "SELL"]),
          price: z.number(),
          quantity: z.number(),
          filledPct: z.number(),
          expireTimestampMs: z.number(),
        }),
      ),
      settledBalances: z.array(
        z.object({ coinType: z.string(), coinKey: z.string(), balance: z.number() }),
      ),
    }),
    lending: z.object({
      navi: z.object({
        supplied: z.array(
          z.object({
            coinType: z.string(),
            symbol: z.string(),
            amount: z.number(),
            valueUsd: z.number(),
          }),
        ),
        healthFactor: z.number().nullable(),
      }),
      suilend: z.object({
        supplied: z.null(),
        manageUrl: z.string(),
      }),
    }),
    demoFixture: z.boolean(),
  }),

  execute: async (inputData) => {
    const { walletAddress } = inputData;
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "fixture") {
      return buildFixturePositions(walletAddress);
    }

    const suiClient = getSuiMainnetClient();

    // Resolve the BM id (single + ok only). RPC error or none → no DeepBook section,
    // never a thrown error (read-only tool).
    let balanceManagerId: string | null = null;
    try {
      const res = await getExistingBalanceManagers(suiClient, walletAddress);
      if (res.status === "ok" && res.ids.length === 1) balanceManagerId = res.ids[0];
    } catch {
      balanceManagerId = null;
    }

    // Each section reads independently; a rejection degrades only that section.
    const [ordersRes, settledRes, naviRes] = await Promise.allSettled([
      balanceManagerId
        ? getOpenOrders(suiClient, walletAddress, balanceManagerId, WHITELISTED_POOL_KEYS)
        : Promise.resolve([]),
      balanceManagerId
        ? getSettledBalances(suiClient, walletAddress, balanceManagerId)
        : Promise.resolve([]),
      readNaviLending(walletAddress),
    ]);

    const openOrders = ordersRes.status === "fulfilled" ? ordersRes.value : [];
    const settledBalances = settledRes.status === "fulfilled" ? settledRes.value : [];
    const navi =
      naviRes.status === "fulfilled" ? naviRes.value : { supplied: [], healthFactor: null };

    return {
      walletAddress,
      deepbook: { balanceManagerId, openOrders, settledBalances },
      lending: {
        navi,
        suilend: { supplied: null, manageUrl: SUILEND_MANAGE_URL },
      },
      demoFixture: false,
    };
  },
});

// ---------------------------------------------------------------------------
// Fixture positions — deterministic demo data (mirrors get-portfolio fixture)
// ---------------------------------------------------------------------------

function buildFixturePositions(walletAddress: string) {
  return {
    walletAddress,
    deepbook: {
      balanceManagerId: "0x" + "ab".repeat(32),
      openOrders: [
        {
          orderId: "0x" + "11".repeat(16),
          poolKey: "SUI_USDC",
          side: "BUY" as const,
          price: 2.8,
          quantity: 10,
          filledPct: 0,
          expireTimestampMs: 4102444800000, // 2100-01-01, far future
        },
      ],
      settledBalances: [{ coinType: "USDC", coinKey: "USDC", balance: 12.5 }],
    },
    lending: {
      navi: {
        supplied: [
          { coinType: "SUI", symbol: "SUI", amount: 25, valueUsd: 70 },
        ],
        healthFactor: 2.4,
      },
      suilend: { supplied: null, manageUrl: SUILEND_MANAGE_URL },
    },
    demoFixture: true,
  };
}
