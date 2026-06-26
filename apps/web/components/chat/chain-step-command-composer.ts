/**
 * chain-step-command-composer — ChainStep + resolved amount → complete command string.
 *
 * WHY pure / separate file: unit-testable without any React or Sui SDK deps.
 * The chain sign loop calls this to compose the re-submission text for each step,
 * mirroring the picker-card pattern (lend-options-card, swap-options-card) where
 * a complete NL command is re-submitted via sendMessage → normal intent pipeline.
 *
 * Command composition is fully delegated to the adapter registry in
 * @dewlock/agent/chaining/chain-adapters. This file is the thin web-layer shim
 * that re-exports the helpers the hook + tests depend on, and keeps the interface
 * stable so callers need not import from the agent package directly.
 *
 * To add a new action: register one ChainActionAdapter in chain-adapters.ts.
 * Nothing in this file or use-chain-plan-stepper.ts needs to change.
 */

// Re-export pure helpers that the hook and tests import from this module.
// They are now canonical in chain-adapters; we re-export for backward compat.
export {
  extractDestinationSymbol,
  extractProtocolFromClause,
} from "@dewlock/agent/chaining/chain-adapters";

import { composeChainCommand } from "@dewlock/agent/chaining/chain-adapters";

export interface ChainStepDef {
  category: string;
  clause: string;
  amountFrom: "explicit" | "prev-output";
}

export interface ComposeOptions {
  /**
   * Resolved human-readable amount (e.g. "18.5") for a prev-output step.
   * Required when step.amountFrom === "prev-output".
   */
  resolvedAmountHuman?: string;
  /**
   * Override the coin symbol extracted from the clause (e.g. "USDC").
   * Useful when the caller knows the exact output coin from the prior step.
   */
  symbolOverride?: string;
}

/**
 * Compose a complete command string for a chain step.
 * Delegates to the adapter registry (single source of truth).
 *
 * For a "prev-output" step, resolvedAmountHuman MUST be provided — the caller
 * snapshots it from the on-chain balance delta after step k confirms.
 * For explicit-amount steps, the original clause is re-submitted verbatim.
 */
export function composeChainStepCommand(
  step: ChainStepDef,
  opts: ComposeOptions = {},
): string {
  const { resolvedAmountHuman, symbolOverride } = opts;
  return composeChainCommand(step.category, {
    clause: step.clause,
    resolvedAmountHuman,
    symbol: symbolOverride,
  });
}

/**
 * Format a raw bigint native balance as a human-readable decimal string.
 * Uses the standard decimal places for known coin types.
 * Falls back to 9 decimals (SUI native unit).
 */
export function nativeToHuman(
  nativeAmount: bigint,
  coinTypeOrDecimals: string | number,
): string {
  const decimals =
    typeof coinTypeOrDecimals === "number"
      ? coinTypeOrDecimals
      : COIN_DECIMALS[coinTypeOrDecimals] ?? 9;

  const divisor = 10 ** decimals;
  const human = Number(nativeAmount) / divisor;
  return human.toLocaleString("en-US", { maximumFractionDigits: 6, useGrouping: false });
}

const COIN_DECIMALS: Record<string, number> = {
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI": 9,
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": 6,
  "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT": 6,
  "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP": 6,
  // haSUI: 9 decimals (same as SUI)
  "0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d::hasui::HASUI": 9,
};
