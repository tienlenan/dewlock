// @dewlock/agent — public exports
export { copilot } from "./agent";
export {
  guardianCheck,
  checkAllowlist,
  checkActionShape,
  checkCoinTypeOnChain,
  checkProvenance,
  checkSuiNSLookalike,
  checkLendingConstraints,
  computeNetOutflowUsd,
  ACTION_TYPES,
  SWAP_SOURCES,
  LENDING_PROTOCOLS,
} from "./guardian";
export type {
  TradeProposal,
  GuardianResult,
  GuardianPass,
  GuardianBlock,
  TxPreview,
  ActionType,
  SwapSource,
  LendingProtocol,
} from "./guardian";
export { checkBridgeConstraints, getBridgeParams, normalizeSuiAddr } from "./guardian-bridge";
export type { BridgeContext, BridgeResult } from "./guardian-bridge";
export { prepareBridgeRedeem } from "./tools/prepare-bridge-redeem";
export type { BridgeRedeemInput, BridgeRedeemResult } from "./tools/prepare-bridge-redeem";
export {
  COPILOT_PERSONA,
  TOOL_USE_RULES,
  SECURITY_RULES,
} from "./copilot-persona";
export {
  COIN_TYPES,
  COIN_DECIMALS,
  ALLOWED_MOVE_TARGETS,
  getTrustedUsdPrice,
  normalizeHomoglyphs,
  editDistance,
  LOOKALIKE_EDIT_DISTANCE_THRESHOLD,
} from "./allowlist";
export { prepareTrade } from "./tools/prepare-trade";
export { getPortfolio } from "./tools/get-portfolio";
