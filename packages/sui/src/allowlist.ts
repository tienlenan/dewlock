/**
 * Dewlock allowlist — the authoritative set of on-chain targets the Guardian permits.
 *
 * WHY a static curated map: coin symbols are spoofable ("USDC" fakes exist).
 * We identify assets by their canonical on-chain type string only.
 * The curated map bootstraps resolution; unknown types always block.
 *
 * WHY {package::module::function} strings: the allowlist enforces that the agent
 * can ONLY build PTBs calling these exact Move functions. Any other call is refused
 * before a PTB is even constructed — allowlist-before-build invariant from docs/03.
 */

// ---------------------------------------------------------------------------
// Canonical mainnet coin types (used for type-identity checks, never symbol)
// ---------------------------------------------------------------------------

/** Canonical on-chain coin types for assets we support. */
export const COIN_TYPES = {
  SUI: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  USDC: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  USDT: "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
  WETH: "0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH",
  wBTC: "0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN",
  // DeepBook native token — 6 decimals, used as limit-order fee currency and base asset
  DEEP: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
} as const;

export type SupportedCoinType = (typeof COIN_TYPES)[keyof typeof COIN_TYPES];

// ---------------------------------------------------------------------------
// Per-type decimals (curated; on-chain CoinMetadata is the authoritative source —
// these are used only as a sanity reference; the guardian re-checks on-chain)
// ---------------------------------------------------------------------------

export const COIN_DECIMALS: Record<string, number> = {
  [COIN_TYPES.SUI]: 9,
  [COIN_TYPES.USDC]: 6,
  [COIN_TYPES.USDT]: 6,
  [COIN_TYPES.WETH]: 8,
  [COIN_TYPES.wBTC]: 8,
  [COIN_TYPES.DEEP]: 6,
};

// ---------------------------------------------------------------------------
// Trusted USD reference prices (manipulation-resistant stable references).
// SUI priced against stablecoins from a known Cetus mainnet pool.
// Stablecoins are always 1.0 USD by definition (accepted within ±2%).
// Unknown types → undefined → guardian blocks.
// ---------------------------------------------------------------------------

/** Returns stable USD reference price per 1 native unit (after decimals). */
export function getTrustedUsdPrice(coinType: string): number | undefined {
  // Stablecoins: always $1 (used as the price anchor, not derived from thin pool)
  if (
    coinType === COIN_TYPES.USDC ||
    coinType === COIN_TYPES.USDT
  ) {
    return 1.0;
  }
  // SUI: use a conservative floor price; real oracle/indexer wires here in production
  // Marked conservative so cap checks fail towards safety, not permissiveness
  if (coinType === COIN_TYPES.SUI) {
    // Resolved from a pinned oracle reference or injected via env; placeholder for tests
    const envPrice = process.env.SUI_USD_PRICE_FLOOR;
    return envPrice ? parseFloat(envPrice) : 3.0; // conservative floor
  }
  // DEEP: conservative floor price for cap math; for DEEP_USDC pool the
  // notional is computed from the quote side (USDC) directly, so this
  // value is only used when DEEP is coinTypeIn on non-USDC pairs.
  if (coinType === COIN_TYPES.DEEP) {
    const envPrice = process.env.DEEP_USD_PRICE_FLOOR;
    return envPrice ? parseFloat(envPrice) : 0.003; // conservative floor (~$0.003/DEEP)
  }
  // WETH / wBTC: no reliable in-process price without an oracle — unknown → block
  return undefined;
}

// ---------------------------------------------------------------------------
// {package::module::function} allowlist — the only Move calls the agent may build
// ---------------------------------------------------------------------------

/**
 * Mainnet Cetus CLMM package IDs (both original and upgraded).
 * Source: https://cetus-1.gitbook.io/cetus-developer-docs/developer/sui-clmm/deployed-contract
 */
export const CETUS_CLMM_PACKAGE =
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb";

export const CETUS_CLMM_PACKAGE_V2 =
  "0x3edd55b3c42aefc05e58a2fccbe0cbab3e09a08aee0dc6748de68b2e38f5b78c";

/** Mainnet SuiNS registry package. */
export const SUINS_PACKAGE =
  "0xd22b24490e0bae52676651b4f56660a5ff8022a2576e0089f79b3c88d44e08f";

// ---------------------------------------------------------------------------
// DeepBook V3 mainnet constants
// Source: @mysten/deepbook-v3 mainnetPackageIds + mainnetPools
// ---------------------------------------------------------------------------

/** DeepBook V3 mainnet package id. */
export const DEEPBOOK_PACKAGE =
  "0x0e735f8c93a95722efd73521aca7a7652c0bb71ed1daf41b26dfd7d1ff71f748";

/** DeepBook V3 registry object id. */
export const DEEPBOOK_REGISTRY =
  "0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d";

/** DeepBook V3 deep-treasury object id. */
export const DEEPBOOK_DEEP_TREASURY =
  "0x032abf8948dda67a271bcc18e776dbbcfb0d58c8d288a700ff0d5521e57a1ffe";

/**
 * Whitelisted DeepBook pool keys → pool object ids.
 * Limit orders are restricted to these pools only (allowlist-before-build invariant).
 */
export const DEEPBOOK_POOLS: Record<string, string> = {
  DEEP_USDC: "0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce",
  SUI_USDC: "0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407",
  DEEP_SUI: "0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22",
};

/**
 * Exact {package::module::function} strings the agent is allowed to call.
 * Anything not in this set is refused before PTB construction begins.
 */
export const ALLOWED_MOVE_TARGETS = new Set<string>([
  // Cetus swap (buy/sell)
  `${CETUS_CLMM_PACKAGE}::pool::swap`,
  `${CETUS_CLMM_PACKAGE_V2}::pool::swap`,
  // Cetus add liquidity
  `${CETUS_CLMM_PACKAGE}::pool::add_liquidity_fix_coin`,
  `${CETUS_CLMM_PACKAGE_V2}::pool::add_liquidity_fix_coin`,
  // SuiNS forward resolve (read-only; included so resolving within a PTB is permitted)
  `${SUINS_PACKAGE}::registry::lookup`,
  // Native SUI coin transfer (package 0x2)
  "0x0000000000000000000000000000000000000000000000000000000000000002::pay::split_and_transfer",
  // DeepBook V3 — limit orders (POST_ONLY only; enforced by Guardian orderbook gate)
  `${DEEPBOOK_PACKAGE}::pool::place_limit_order`,
  `${DEEPBOOK_PACKAGE}::pool::cancel_order`,
  // BalanceManager proof generation (called internally by placeLimitOrder)
  `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_owner`,
  `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_trader`,
  // BalanceManager bootstrap (one-time per-wallet onboarding)
  `${DEEPBOOK_PACKAGE}::balance_manager::new`,
  `${DEEPBOOK_PACKAGE}::balance_manager::deposit`,
  // Object sharing required by createAndShareBalanceManager
  "0x0000000000000000000000000000000000000000000000000000000000000002::transfer::public_share_object",
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
 * Lookalike edit-distance threshold from the spec (Red-Team point #8).
 * Names within this distance of a verified contact are flagged.
 */
export const LOOKALIKE_EDIT_DISTANCE_THRESHOLD = 2;
