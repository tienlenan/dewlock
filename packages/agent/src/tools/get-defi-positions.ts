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
import {
  getOpenOrders,
  getSettledBalances,
  getPoolTiedBalances,
  WHITELISTED_POOL_KEYS,
} from "@dewlock/sui/account-orders";
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
      // ALL BalanceManagers the wallet owns (funded-first). Usually one; a wallet may
      // carry an accidental extra. Each is independently actionable (Withdraw/Cancel).
      balanceManagers: z.array(
        z.object({
          balanceManagerId: z.string(),
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
          // Funds tied to pools — not in checkManagerBalance. `locked` = in resting orders;
          // `settled` = filled/owed, claimable back to the BM. Surfaces a "funded" BM that
          // would otherwise read 0 (all its funds committed to the order book).
          poolTied: z.array(
            z.object({
              coinType: z.string(),
              coinKey: z.string(),
              locked: z.number(),
              settled: z.number(),
            }),
          ),
        }),
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

    // Resolve ALL the wallet's BalanceManagers (funded-first). Read-only tool: any error
    // degrades to an empty list, never throws.
    let bmIds: string[] = [];
    try {
      const res = await getExistingBalanceManagers(suiClient, walletAddress);
      if (res.status === "ok") bmIds = res.ids;
    } catch {
      bmIds = [];
    }

    // NAVI runs in parallel; per-BM DeepBook reads run SEQUENTIALLY to avoid a burst of
    // concurrent devInspect calls (3 pools + 3 coins per BM) that trips RPC rate limits
    // (429) and blanks balances. Each read is allSettled so one failure degrades only its
    // own section, never the rest.
    const naviPromise = readNaviLending(walletAddress).catch(() => ({
      supplied: [] as never[],
      healthFactor: null,
    }));

    const balanceManagers: Array<{
      balanceManagerId: string;
      openOrders: Awaited<ReturnType<typeof getOpenOrders>>;
      settledBalances: Awaited<ReturnType<typeof getSettledBalances>>;
      poolTied: Awaited<ReturnType<typeof getPoolTiedBalances>>;
    }> = [];
    for (const bmId of bmIds) {
      const [ordersRes, settledRes, poolTiedRes] = await Promise.allSettled([
        getOpenOrders(suiClient, walletAddress, bmId, WHITELISTED_POOL_KEYS),
        getSettledBalances(suiClient, walletAddress, bmId),
        getPoolTiedBalances(suiClient, walletAddress, bmId),
      ]);
      balanceManagers.push({
        balanceManagerId: bmId,
        openOrders: ordersRes.status === "fulfilled" ? ordersRes.value : [],
        settledBalances: settledRes.status === "fulfilled" ? settledRes.value : [],
        poolTied: poolTiedRes.status === "fulfilled" ? poolTiedRes.value : [],
      });
    }

    const navi = await naviPromise;

    return {
      walletAddress,
      deepbook: { balanceManagers },
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
      balanceManagers: [
        {
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
          // The resting BUY 10 SUI @ 2.8 locks ~28 USDC in the order book (not in the BM).
          poolTied: [
            { coinType: "USDC", coinKey: "USDC", locked: 28, settled: 0 },
            { coinType: "SUI", coinKey: "SUI", locked: 0, settled: 4.2 },
          ],
        },
        {
          // A second (empty) BM — demonstrates the multi-account list + per-BM actions.
          balanceManagerId: "0x" + "cd".repeat(32),
          openOrders: [],
          settledBalances: [],
          poolTied: [],
        },
      ],
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
