/**
 * Composite recipe registry — the CLOSED allowlist of pre-declared multi-leg intents.
 *
 * WHY closed: an arbitrary LLM-composed multi-call PTB reopens the smuggling hole the
 * one-action invariant closes. The ONLY safe path is a registry of pre-declared recipes
 * whose leg MoveCall multiset + linkage are known ahead of time and verified by the
 * Guardian before any signature is requested.
 *
 * v1 recipe set: single `swap→lend` (swap USDC/SUI, then deposit the output into NAVI).
 * `swap→stake` and further recipes are additive later — never compose ad-hoc.
 *
 * Recipe structure:
 *  - id:       stable string key — used to index the registry.
 *  - legs:     ordered list of action types + the MoveCall targets each may emit.
 *  - linkage:  how leg-1's output coin feeds leg-2's input (structural invariant).
 *  - coinTypes: the declared input/output coin types per leg (for provenance check).
 */

import {
  NAVI_PACKAGE,
  SUILEND_PACKAGE,
  CETUS_AGGREGATOR_PACKAGE,
  CETUS_AGGREGATOR_CETUS_PACKAGE,
  CETUS_CLMM_PACKAGE,
  CETUS_CLMM_PACKAGE_V2,
  AFTERMATH_ROUTER_UTILS_PACKAGE,
} from "../allowlist";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single leg in a composite recipe. */
export interface RecipeLeg {
  /** Declared action type (maps to the guardian's ActionType). */
  actionType: "swap" | "lend_deposit";
  /**
   * The exact MoveCall target multiset this leg may emit.
   * Aggregator/aftermath route calls are additionally admitted by module::function
   * signature (because the per-route package is upgradeable) — they do not need to
   * be listed here for those matchers. The multiset check is the structural control;
   * delta/owner walk is the authoritative value/leak control.
   */
  allowedTargets: ReadonlySet<string>;
  /** Whether this leg's MoveCall set can also match by module::function signature. */
  allowSignatureMatch: boolean;
}

/** How the output of leg N feeds into the input of leg N+1. */
export interface RecipeLinkage {
  /** Index of the leg that produces the output coin. */
  fromLeg: number;
  /** Index of the leg that consumes it as input. */
  toLeg: number;
  /**
   * Description of the coin type contract between legs (for provenance validation).
   * The composite builder and Guardian both assert this is satisfied.
   */
  outputCoinTypeOf: "swap_output"; // only shape in v1
}

/** A fully-declared composite recipe. */
export interface CompositeRecipe {
  id: string;
  description: string;
  legs: readonly RecipeLeg[];
  linkages: readonly RecipeLinkage[];
}

// ---------------------------------------------------------------------------
// v1 Recipe: swap→lend (deposit)
// ---------------------------------------------------------------------------

/**
 * Swap any priced coin to a lending-eligible coin, then deposit that coin into NAVI.
 * Leg 1: aggregator swap (output coin = lend input).
 * Leg 2: NAVI deposit of the swap output (no new wallet coin selection — uses PTB result).
 *
 * The linkage enforces: leg-0 output coin (PTBResult) = leg-1 lend input.
 * No wallet settle between legs — single PTB, single sig.
 */
const SWAP_LEND_RECIPE: CompositeRecipe = {
  id: "swap_lend_v1",
  description: "Swap a coin then deposit the output into NAVI lending in one atomic PTB.",
  legs: [
    {
      actionType: "swap",
      // Aggregator scaffolding targets (swap leg). Per-route packages are admitted via
      // module::function signature match (allowSignatureMatch: true), so we list only
      // the static anchors here for defense-in-depth.
      allowedTargets: new Set([
        `${CETUS_AGGREGATOR_PACKAGE}::router::new_swap_context`,
        `${CETUS_AGGREGATOR_PACKAGE}::router::confirm_swap`,
        `${CETUS_AGGREGATOR_PACKAGE}::router::transfer_or_destroy_coin`,
        `${CETUS_AGGREGATOR_CETUS_PACKAGE}::cetus::swap`,
        `${CETUS_AGGREGATOR_PACKAGE}::cetus::swap`,
        `${CETUS_AGGREGATOR_PACKAGE}::deepbookv3::swap`,
        // Direct Cetus CLMM (alternative swap path in fixture / test).
        `${CETUS_CLMM_PACKAGE}::pool::swap`,
        `${CETUS_CLMM_PACKAGE_V2}::pool::swap`,
        // Aftermath swap scaffolding
        `${AFTERMATH_ROUTER_UTILS_PACKAGE}::swap_cap::obtain_router_cap`,
        `${AFTERMATH_ROUTER_UTILS_PACKAGE}::swap_cap::initiate_path`,
        `${AFTERMATH_ROUTER_UTILS_PACKAGE}::swap_cap::return_router_cap_already_payed_fee`,
      ]),
      // Aggregator/aftermath per-DEX calls are also admitted by signature.
      allowSignatureMatch: true,
    },
    {
      actionType: "lend_deposit",
      // NAVI deposit: incentive_v3::entry_deposit + optional pool::refresh_stake.
      // Suilend not included — compositing with Suilend requires an obligation object
      // that cannot be cleanly wired in the same PTB without additional complexity
      // (the obligation object must be pre-existing or created and transferred in the
      // same PTB). NAVI does not require a pre-existing obligation for deposit.
      allowedTargets: new Set([
        `${NAVI_PACKAGE}::incentive_v3::entry_deposit`,
        `${NAVI_PACKAGE}::pool::refresh_stake`,
        // Suilend first-deposit shape (kept for completeness; only NAVI is wired in v1).
        `${SUILEND_PACKAGE}::lending_market::create_obligation`,
        `${SUILEND_PACKAGE}::lending_market::deposit_liquidity_and_mint_ctokens`,
        `${SUILEND_PACKAGE}::lending_market::deposit_ctokens_into_obligation`,
        `${SUILEND_PACKAGE}::lending_market::rebalance_staker`,
      ]),
      allowSignatureMatch: false,
    },
  ],
  linkages: [{ fromLeg: 0, toLeg: 1, outputCoinTypeOf: "swap_output" }],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All declared recipes, keyed by id. The Guardian's multiset check uses this. */
const RECIPE_REGISTRY = new Map<string, CompositeRecipe>([[SWAP_LEND_RECIPE.id, SWAP_LEND_RECIPE]]);

/** Look up a recipe by id. Returns undefined when not in the registry. */
export function getRecipe(id: string): CompositeRecipe | undefined {
  return RECIPE_REGISTRY.get(id);
}

/** All declared recipe ids. */
export function getRecipeIds(): string[] {
  return [...RECIPE_REGISTRY.keys()];
}

export { SWAP_LEND_RECIPE };
