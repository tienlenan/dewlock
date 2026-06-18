// @dewlock/sui — public API surface.
//
// Root import intentionally omits Cetus-SDK-dependent modules (build-swap,
// quotes-source) to keep the root bundle free of bn.js and Cetus SDK imports.
// Import those via their dedicated subpath exports when needed:
//   @dewlock/sui/build-swap
//   @dewlock/sui/quotes-source
//
// sign.ts: client-side only ("use client" directive) — do not import in server code.
// client.ts: server-side only — do not import in client bundles.
export {
  COIN_TYPES,
  COIN_DECIMALS,
  ALLOWED_MOVE_TARGETS,
  CETUS_CLMM_PACKAGE,
  CETUS_CLMM_PACKAGE_V2,
  SUINS_PACKAGE,
  getTrustedUsdPrice,
  registerLivePriceProvider,
  normalizeHomoglyphs,
  editDistance,
  LOOKALIKE_EDIT_DISTANCE_THRESHOLD,
} from "./allowlist";
// Live-price oracle (CoinGecko) — importing this registers the live-price provider
// into getTrustedUsdPrice (side effect). Server-only (uses fetch).
export { refreshUsdPrices, getCachedUsdPrice } from "./price-oracle";
export type { SupportedCoinType } from "./allowlist";
// Protocol registry — single source of truth for protocol posture + active targets.
export {
  getProtocols,
  getProtocol,
  getActiveProtocols,
  getExcludedProtocols,
  getBuiltProtocols,
  getActiveMoveTargets,
  getProtocolByTarget,
  isTargetActive,
  assertProtocolActive,
} from "./protocol-registry";
export type {
  ProtocolEntry,
  ProtocolCategory,
  ProtocolStatus,
  ProtocolBuildState,
  ProtocolIncident,
  ProtocolGateResult,
} from "./protocol-registry";
export { stableJson, sha256Hex, sha256HexBytes, WysiwysError } from "./sign";
export { getSuiMainnetClient, getSuiDevnetClient } from "./client";
export { dryRunTransaction, DryRunFailedError } from "./dry-run";
export type { DryRunResult, BalanceDelta } from "./dry-run";
export { buildTransfer, TransferBuildError } from "./build-transfer";
export type { TransferSpec, TransferBuildResult } from "./build-transfer";
// NOTE: build-swap and quotes-source are NOT re-exported here — they pull in
// @cetusprotocol/cetus-sui-clmm-sdk which is server-runtime-only.
// Use @dewlock/sui/build-swap and @dewlock/sui/quotes-source subpath imports.
export { resolveSuiNSName, SuiNSResolveError } from "./suins-resolver";
export type { SuiNSResolutionResult } from "./suins-resolver";
export {
  anchorReceiptHead,
  getKnownHeadObjectId,
  type AnchorResult,
  type AnchorStatus,
} from "./publish-receipt-anchor";
