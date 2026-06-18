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
  NATIVE_PACKAGE,
  CETUS_CLMM_PACKAGE,
  CETUS_CLMM_PACKAGE_V2,
  CETUS_AGGREGATOR_PACKAGE,
  CETUS_AGGREGATOR_CETUS_PACKAGE,
  AGGREGATOR_SWAP_CALL_SIGNATURES,
  isAggregatorSwapCall,
  AFTERMATH_ROUTER_UTILS_PACKAGE,
  AFTERMATH_AMM_PACKAGE,
  AFTERMATH_SWAP_CALL_SIGNATURES,
  isAftermathSwapCall,
  NAVI_PACKAGE,
  SUILEND_PACKAGE,
  WORMHOLE_CORE_PACKAGE,
  WORMHOLE_WTT_PACKAGE,
  SUINS_PACKAGE,
  DEEPBOOK_PACKAGE,
  DEEPBOOK_REGISTRY,
  DEEPBOOK_POOLS,
  getTrustedUsdPrice,
  normalizeCoinType,
  normalizeHomoglyphs,
  editDistance,
  LOOKALIKE_EDIT_DISTANCE_THRESHOLD,
  // Protocol registry helpers (single-authored allowlist + status-aware routing)
  getProtocols,
  getProtocol,
  getActiveProtocols,
  getExcludedProtocols,
  getActiveMoveTargets,
  getProtocolByTarget,
  isTargetActive,
  assertProtocolActive,
} from "@dewlock/sui/allowlist";
export type {
  SupportedCoinType,
  ProtocolEntry,
  ProtocolCategory,
  ProtocolStatus,
  ProtocolBuildState,
  ProtocolIncident,
  ProtocolGateResult,
} from "@dewlock/sui/allowlist";
