/**
 * Mock data for the onboarding demo showcase.
 *
 * SAFETY: these builders produce DISPLAY-ONLY props for the real card components.
 * Every card carries `demoFixture: true` (DEMO badge) and is rendered with inert
 * handlers in the showcase overlay — no signing hook is ever instantiated, so nothing
 * here can execute on-chain. Coin types + dry-run deltas reuse the existing fixture
 * layer so the numbers stay internally consistent with the rest of the app.
 */

import { COIN_TYPES } from "@dewlock/agent/allowlist";
import type { TxPreviewData } from "@/components/tx-preview-card";
import type { PortfolioCardProps } from "@/components/portfolio-card";
import type { ChainPlanData } from "@/components/chat/chain-plan-card";
import { getFixtureSwapDryRun } from "@/lib/demo/fixtures";

/** Fallback wallet shown when no real account is connected (format-valid 0x, never signed). */
export const DEMO_WALLET_ADDRESS =
  "0x5adea1f0c7b3e9d24f861a0b5c3e6b2d4f8a1c9e3b5d7f0a2c4e6b8d0f2a74da";

/** Mock portfolio — a few representative holdings with illustrative USD values. */
export function buildDemoPortfolio(walletAddress: string): PortfolioCardProps {
  return {
    walletAddress,
    network: "mainnet",
    demoFixture: true,
    totalEstimatedUsdValue: 625.5,
    balances: [
      {
        coinType: COIN_TYPES.SUI,
        displayTicker: "SUI",
        nativeBalance: "128500000000",
        humanBalance: "128.5",
        estimatedUsdValue: 385.5,
        decimals: 9,
        priceUsd: 3.0,
        verified: true,
      },
      {
        coinType: COIN_TYPES.USDC,
        displayTicker: "USDC",
        nativeBalance: "240000000",
        humanBalance: "240.00",
        estimatedUsdValue: 240.0,
        decimals: 6,
        priceUsd: 1.0,
        verified: true,
      },
    ],
  };
}

/** Mock single-PTB preview — a 1 SUI → USDC swap (reuses the fixture dry-run deltas). */
export function buildDemoSwapPreview(walletAddress: string): TxPreviewData {
  const dry = getFixtureSwapDryRun(walletAddress);
  return {
    actionLabel: "Swap 1 SUI → USDC",
    coinTypeIn: COIN_TYPES.SUI,
    coinTypeOut: COIN_TYPES.USDC,
    amountInNative: "1000000000",
    minAmountOutNative: "2970000",
    slippageBps: 50,
    swapSource: "cetus",
    routeProviders: ["Cetus"],
    estimatedUsdValue: 3.0,
    gasCostMist: dry.gasCostMist,
    balanceDeltas: dry.balanceDeltas,
    contractsCalled: [
      {
        target:
          "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::router::swap",
        protocolName: "Cetus Aggregator",
        category: "swap",
        status: "active",
        allowlistKind: "signature-matched",
      },
    ],
    objectsTouched: [
      {
        objectId:
          "0x9c2e1b8d5f0a7c3e6b2d4f8a1c9e3b5d7f0a2c4e6b8d0f2a4c6e8b0d2f4c6e8b",
        changeType: "mutated",
        objectType: "Coin<SUI>",
        ownerKind: "you",
      },
    ],
    objectsTouchedTotal: 1,
    capsWarning: false,
    requiresProvenanceConfirm: false,
    demoFixture: true,
    approvedDigest: "demo-preview-no-signature",
  };
}

/** Mock multi-intent atomic plan — swap → lend, eligible for the "Run as 1 transaction" toggle. */
export function buildDemoChainPlan(walletAddress: string): ChainPlanData {
  return {
    walletAddress,
    originalText: "swap 10 SUI to USDC then lend the USDC on NAVI",
    steps: [
      { index: 0, category: "swap", clause: "Swap 10 SUI → USDC", amountFrom: "explicit", status: "pending" },
      { index: 1, category: "lend", clause: "Lend USDC on NAVI", amountFrom: "prev-output", status: "pending" },
    ],
  };
}

/**
 * Mock Guardian BLOCK — a near-miss SuiNS look-alike.
 *
 * Reasons are authored to satisfy BlockCard's `parseBlockFields` regexes (You typed /
 * Saved contact / Resolved now / Lookalike). The two 0x addresses differ only at the
 * final character (…a912 vs …a913) — the whole point — and are kept SHORT on purpose:
 * BlockCard caps its width at 440px and renders address rows on one line without
 * wrapping, so a full 66-char address would overflow and clip. These fit cleanly while
 * still showing the last-character diff that makes the look-alike obvious.
 */
export function buildDemoBlock(): { reasons: string[]; gates: string[] } {
  return {
    reasons: [
      `You typed "888.sui" → lookalike destination detected`,
      `Saved contact: 0x3a4f9c2e1b8d5f0a7c3e6b2da912`,
      `SuiNS resolved now to 0x3a4f9c2e1b8d5f0a7c3e6b2da913 — differs from saved contact`,
      `Lookalike: 888-l.sui differs at the final character`,
    ],
    gates: ["suins_lookalike", "min_out"],
  };
}
