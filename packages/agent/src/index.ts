// @dewlock/agent — public exports
export { copilot } from "./agent";
export {
  guardianCheck,
  checkAllowlist,
  checkCoinTypeOnChain,
  checkProvenance,
  checkSuiNSLookalike,
} from "./guardian";
export type {
  TradeProposal,
  GuardianResult,
  GuardianPass,
  GuardianBlock,
  TxPreview,
} from "./guardian";
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
