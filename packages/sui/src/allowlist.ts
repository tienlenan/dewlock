/**
 * Dewlock allowlist — the authoritative set of on-chain targets the Guardian permits.
 *
 * WHY a static curated map: coin symbols are spoofable ("USDC" fakes exist).
 * We identify assets by their canonical on-chain type string only.
 *
 * WHY {package::module::function} strings: the allowlist enforces that the agent
 * can ONLY build PTBs calling these exact Move functions. Any other call is refused
 * before a PTB is even constructed — allowlist-before-build invariant.
 *
 * SINGLE AUTHOR: the active protocol Move-targets come from the protocol registry
 * (getActiveMoveTargets) so the enforced allowlist and the displayed security
 * posture never drift. CORE_TARGETS (native transfer / object share / SuiNS) are
 * framework primitives, always permitted, unioned in here.
 */

// Canonical constants live in protocol-constants.ts (leaf module) to avoid a cycle
// with the registry. Re-exported here so every existing `@dewlock/sui/allowlist`
// import keeps working unchanged.
export {
  COIN_TYPES,
  COIN_DECIMALS,
  getTrustedUsdPrice,
  registerLivePriceProvider,
  normalizeCoinType,
  NATIVE_PACKAGE,
  CETUS_CLMM_PACKAGE,
  CETUS_CLMM_PACKAGE_V2,
  CETUS_AGGREGATOR_PACKAGE,
  CETUS_AGGREGATOR_CETUS_PACKAGE,
  AGGREGATOR_SWAP_CALL_SIGNATURES,
  isAggregatorSwapCall,
  AFTERMATH_ROUTER_UTILS_PACKAGE,
  AFTERMATH_AMM_PACKAGE,
  AFTERMATH_LSD_PACKAGE,
  AFTERMATH_SWAP_CALL_SIGNATURES,
  isAftermathSwapCall,
  NAVI_PACKAGE,
  SUILEND_PACKAGE,
  WORMHOLE_CORE_PACKAGE,
  WORMHOLE_WTT_PACKAGE,
  SUINS_PACKAGE,
  DEEPBOOK_PACKAGE,
  DEEPBOOK_REGISTRY,
  DEEPBOOK_DEEP_TREASURY,
  DEEPBOOK_POOLS,
  CORE_TARGETS,
  HAEDAL_PACKAGE,
  HAEDAL_STAKING_OBJECT,
} from "./protocol-constants";
export type { SupportedCoinType } from "./protocol-constants";

// Registry helpers re-exported so the guardian/tools import them from one place.
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

import { CORE_TARGETS } from "./protocol-constants";
import { getActiveMoveTargets } from "./protocol-registry";

// ---------------------------------------------------------------------------
// {package::module::function} allowlist — derived, single-authored
// ---------------------------------------------------------------------------

/**
 * Exact {package::module::function} strings the agent is allowed to call.
 * Anything not in this set is refused before PTB construction begins.
 *
 * Derived = CORE_TARGETS ∪ (Move targets of active+built protocols). Excluded,
 * hacked, and not-yet-built protocols contribute nothing.
 */
export const ALLOWED_MOVE_TARGETS = new Set<string>([
  ...CORE_TARGETS,
  ...getActiveMoveTargets(),
]);

// ---------------------------------------------------------------------------
// Homoglyph normalizer + lookalike detection
// ---------------------------------------------------------------------------

/**
 * Map of visually-similar characters to their canonical ASCII equivalents.
 * Used to detect domain-lookalike attacks in SuiNS names.
 * WHY: "888-l.sui" vs "888.sui", "0" vs "o", Cyrillic lookalikes, etc.
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  "0": "o",
  "1": "l",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "@": "a",
  "а": "a", // Cyrillic а
  "е": "e", // Cyrillic е
  "о": "o", // Cyrillic о
  "р": "p", // Cyrillic р
  "с": "c", // Cyrillic с
  "у": "y", // Cyrillic у
  "х": "x", // Cyrillic х
  "і": "i", // Cyrillic і
  "ӏ": "l", // Cyrillic ӏ
  "ᴜ": "u", // Phonetic u
  "ᴡ": "w", // Phonetic w
};

/** Normalize a SuiNS label to canonical ASCII for comparison. */
export function normalizeHomoglyphs(label: string): string {
  return label
    .toLowerCase()
    .split("")
    .map((ch) => HOMOGLYPH_MAP[ch] ?? ch)
    .join("");
}

/**
 * Levenshtein edit distance between two strings.
 * Used to detect typosquat/lookalike names (threshold ≤2 from spec).
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Lookalike edit-distance threshold from the spec.
 * Names within this distance of a verified contact are flagged.
 */
export const LOOKALIKE_EDIT_DISTANCE_THRESHOLD = 2;
