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
export { listProtocols } from "./tools/list-protocols";
export { getSwapOptions } from "./tools/get-swap-options";
export { getLendOptions } from "./tools/get-lend-options";
export { getStakeOptions } from "./tools/get-stake-options";
export { getSwapForm } from "./tools/get-swap-form";
export { getReceiveInfo } from "./tools/get-receive-info";
export { getUserStats } from "./tools/get-user-stats";
export { getProtocolMetrics } from "./tools/get-protocol-metrics";
export { requestContactPicker } from "./tools/request-contact-picker";
export { matchContacts } from "./memory/contacts";
export type { StoredContact } from "./memory/contacts";
export { detectMultiAction, isChainableSequence, parseChainSteps } from "./intent/detect-multi-action";
export type { MultiActionResult, ChainStep } from "./intent/detect-multi-action";
export { PlanStepper, resolveStepDelta, waitForObjectVersions } from "./chaining/plan-stepper";
export type { StepState, StepStatus, StepConfirmOptions } from "./chaining/plan-stepper";
export { recordSpendAtSignTime } from "./tools/prepare-trade";
export { decomposeIntent } from "./tools/decompose-intent";
export { buildChainDecomposeDirective } from "./intent/chain-decompose-directive";
