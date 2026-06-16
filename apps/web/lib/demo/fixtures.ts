/**
 * Demo fixture layer — deterministic data for NEXT_PUBLIC_DEMO_MODE=fixture.
 *
 * Rules (Red-Team hardening #7):
 *  - Toggle is read at REQUEST TIME from env — never auto-flips on error.
 *  - Fixtures back dry-run/preview ONLY. No fixture ever executes on mainnet.
 *  - "DEMO FIXTURE" badge is displayed whenever this data is served.
 *  - Live mode errors THROW — they do not silently fall through to fixture data.
 *    (Auto-flip = fail-open bypass; explicitly forbidden.)
 */

import { COIN_TYPES } from "@dewlock/agent/allowlist";

export type DemoMode = "live" | "fixture";

/** Read the demo mode toggle once at request time. Never auto-flips. */
export function getDemoMode(): DemoMode {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "fixture" ? "fixture" : "live";
}

// ---------------------------------------------------------------------------
// Fixture: swap quote
// ---------------------------------------------------------------------------

export interface FixtureSwapQuote {
  coinTypeIn: string;
  coinTypeOut: string;
  amountIn: string; // bigint as string
  estimatedAmountOut: string;
  minAmountOut: string;
  slippageBps: number;
  poolId: string;
  source: "fixture";
}

/** Returns a deterministic SUI→USDC swap quote for demo mode. */
export function getFixtureSwapQuote(
  coinTypeIn: string = COIN_TYPES.SUI,
  coinTypeOut: string = COIN_TYPES.USDC,
  amountInNative: bigint = 1_000_000_000n, // 1 SUI
  slippageBps: number = 50,
): FixtureSwapQuote {
  // 1 SUI = 3 USDC at 3.0 floor price; USDC has 6 decimals
  const SUI_PER_USDC_RATE = 3_000_000n; // per 1e9 SUI → 3_000_000 micro-USDC

  let estimatedAmountOut: bigint;
  if (coinTypeIn === COIN_TYPES.SUI) {
    estimatedAmountOut = (amountInNative * SUI_PER_USDC_RATE) / 1_000_000_000n;
  } else {
    // USDC → SUI reverse
    estimatedAmountOut = (amountInNative * 1_000_000_000n) / SUI_PER_USDC_RATE;
  }

  const minAmountOut =
    (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;

  return {
    coinTypeIn,
    coinTypeOut,
    amountIn: amountInNative.toString(),
    estimatedAmountOut: estimatedAmountOut.toString(),
    minAmountOut: minAmountOut.toString(),
    slippageBps,
    poolId: "0xfixture_pool_demo_only",
    source: "fixture",
  };
}

// ---------------------------------------------------------------------------
// Fixture: dry-run result (balance deltas for preview card)
// ---------------------------------------------------------------------------

export interface FixtureDryRunResult {
  balanceDeltas: Array<{
    coinType: string;
    amount: string; // bigint as string (signed)
    owner: string;
  }>;
  gasCostMist: string;
  source: "fixture";
}

/** Deterministic dry-run delta for a 1 SUI → USDC swap demo. */
export function getFixtureSwapDryRun(
  walletAddress: string,
  amountInNative: bigint = 1_000_000_000n,
  estimatedOut: bigint = 3_000_000n,
): FixtureDryRunResult {
  return {
    balanceDeltas: [
      {
        coinType: COIN_TYPES.SUI,
        amount: (-amountInNative).toString(),
        owner: walletAddress,
      },
      {
        coinType: COIN_TYPES.USDC,
        amount: estimatedOut.toString(),
        owner: walletAddress,
      },
    ],
    gasCostMist: "2000000", // ~0.002 SUI gas
    source: "fixture",
  };
}

// ---------------------------------------------------------------------------
// Fixture: near-miss BLOCK — lookalike 888-l.sui targeting
// ---------------------------------------------------------------------------

/**
 * Shape returned by the near-miss BLOCK fixture.
 * Mirrors PrepareTradeBlock from use-copilot-chat.ts (ok: false).
 */
export interface FixtureNearMissBlock {
  ok: false;
  reasons: string[];
  gates: string[];
  source: "fixture";
}

/**
 * Deterministic near-miss BLOCK result for the "See the BLOCK" demo action.
 *
 * Reasons are authored to satisfy parseBlockFields regexes in block-card.tsx
 * so the structured mockup grid (You typed / Saved contact / Resolved now / Lookalike)
 * renders deterministically without depending on live SuiNS resolution:
 *
 *  regex typed        → /["']?([^"']+)["']?\s*(?:→|->|to\s)/i
 *  regex savedContact → /(?:saved contact|expected)[:\s]+([^\s,]+)/i
 *  regex resolvedNow  → /resolved[^0x]*(0x[0-9a-fA-F]+)/i
 *  regex lookalike    → /lookalike[:\s]+([^\s.]+)/i
 *
 * Values mirror the landing mockup verbatim (888.sui vs 888-l.sui, addresses
 * differ at last hex character) so demo and landing remain visually identical.
 *
 * BLOCK fixture carries source:"fixture" — no on-chain tx is ever fired.
 * Gated behind getDemoMode() === "fixture".
 */
export function getFixtureNearMissBlock(): FixtureNearMissBlock {
  return {
    ok: false as const,
    reasons: [
      // → fields.typed  (matches /["']?([^"']+)["']?\s*(?:→|->|to\s)/i)
      `You typed "888.sui" → lookalike destination detected`,
      // → fields.savedContact  (matches /(?:saved contact|expected)[:\s]+([^\s,]+)/i)
      `Saved contact: 0x3a4f9c2e1b8d5f0a7c3e6b2d4f8a1c9e3b5d7f0a2c4e6b8d0f2a4c6e8b0d2f4c912`,
      // → fields.resolvedNow   (matches /resolved[^0x]*(0x[0-9a-fA-F]+)/i)
      `SuiNS resolved now to 0x3a4f9c2e1b8d5f0a7c3e6b2d4f8a1c9e3b5d7f0a2c4e6b8d0f2a4c6e8b0d2f4c913 — differs from saved contact`,
      // → fields.lookalike     (matches /lookalike[:\s]+([^\s.]+)/i)
      `Lookalike: 888-l.sui differs at the final character`,
    ],
    gates: ["suins_lookalike", "min_out"],
    source: "fixture" as const,
  };
}

/** Deterministic dry-run delta for a SUI transfer demo. */
export function getFixtureTransferDryRun(
  senderAddress: string,
  recipientAddress: string,
  amountNative: bigint,
  coinType: string = COIN_TYPES.SUI,
): FixtureDryRunResult {
  return {
    balanceDeltas: [
      { coinType, amount: (-amountNative).toString(), owner: senderAddress },
      { coinType, amount: amountNative.toString(), owner: recipientAddress },
    ],
    gasCostMist: "1500000", // ~0.0015 SUI gas
    source: "fixture",
  };
}
