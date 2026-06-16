/**
 * allowlist.ts — re-exports the canonical coin-type/allowlist data from @dewlock/sui.
 *
 * Coin types, package IDs, homoglyph tables, and edit-distance utilities live in
 * @dewlock/sui/allowlist because they are blockchain-level data used by both the
 * sui builders and the guardian. This file is a thin re-export for agent-internal
 * backward compatibility.
 *
 * WHY subpath not root: the @dewlock/sui root pulls in client.ts and other
 * server-only modules. Using the allowlist subpath keeps this file importable
 * in any context (server, browser, test) without side-effects.
 */
export {
  COIN_TYPES,
  COIN_DECIMALS,
  ALLOWED_MOVE_TARGETS,
  CETUS_CLMM_PACKAGE,
  CETUS_CLMM_PACKAGE_V2,
  SUINS_PACKAGE,
  DEEPBOOK_PACKAGE,
  DEEPBOOK_REGISTRY,
  DEEPBOOK_POOLS,
  getTrustedUsdPrice,
  normalizeHomoglyphs,
  editDistance,
  LOOKALIKE_EDIT_DISTANCE_THRESHOLD,
} from "@dewlock/sui/allowlist";
export type { SupportedCoinType } from "@dewlock/sui/allowlist";
