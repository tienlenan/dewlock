/**
 * Dewlock Copilot agent — Mastra Agent wired to Vercel AI Gateway (Gemini).
 * Phase 2: DeFi tools registered — getPortfolio + prepareTrade.
 *
 * Gateway reads AI_GATEWAY_API_KEY from server env (never NEXT_PUBLIC_).
 * Model is configurable via AGENT_MODEL env; defaults to gemini-2.5-flash.
 *
 * Security invariant: the agent holds ZERO user-fund keys.
 * All value-moving paths go through prepareTrade → Guardian → wallet sign.
 */

import { Agent } from "@mastra/core/agent";
import { createGateway } from "@ai-sdk/gateway";
import {
  COPILOT_PERSONA,
  TOOL_USE_RULES,
  SECURITY_RULES,
} from "./copilot-persona";
import { prepareTrade } from "./tools/prepare-trade";
import { getPortfolio } from "./tools/get-portfolio";
import { getDefiPositions } from "./tools/get-defi-positions";
import { listProtocols } from "./tools/list-protocols";
import { getSwapOptions } from "./tools/get-swap-options";
import { getLendOptions } from "./tools/get-lend-options";
import { getSwapForm } from "./tools/get-swap-form";
import { getLimitOrderForm } from "./tools/get-limit-order-form";
import { getReceiveInfo } from "./tools/get-receive-info";
import { getUserStats } from "./tools/get-user-stats";
import { getProtocolMetrics } from "./tools/get-protocol-metrics";
import { getStablecoinYields } from "./tools/get-stablecoin-yields";
import { getTopTvl } from "./tools/get-top-tvl";
import { getTrendingTokens } from "./tools/get-trending-tokens";
import { requestActionForm } from "./tools/request-action-form";
import { requestContactPicker } from "./tools/request-contact-picker";

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const model = gateway(
  process.env.AGENT_MODEL ?? "google/gemini-2.5-flash",
);

export const copilot = new Agent({
  id: "copilot",
  name: "Dewlock Sui DeFi Copilot",
  instructions: `${COPILOT_PERSONA}\n${TOOL_USE_RULES}\n${SECURITY_RULES}`,
  model,
  tools: {
    getPortfolio,
    getDefiPositions,
    prepareTrade,
    listProtocols,
    getSwapOptions,
    getLendOptions,
    getSwapForm,
    getLimitOrderForm,
    getReceiveInfo,
    getUserStats,
    getProtocolMetrics,
    getStablecoinYields,
    getTopTvl,
    getTrendingTokens,
    requestActionForm,
    requestContactPicker,
  },
});
