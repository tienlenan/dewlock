/**
 * protocol-constants.ts — leaf module of canonical on-chain constants.
 *
 * WHY this exists separately from allowlist.ts: the protocol registry derives the
 * active Move-target set, and allowlist.ts derives ALLOWED_MOVE_TARGETS *from* the
 * registry. To avoid a cycle (allowlist → registry → registry-data → allowlist), the
 * raw constants both layers need live here, with zero imports of their own.
 *
 * Identity rule: assets are identified by their canonical on-chain type string only —
 * coin symbols are spoofable ("USDC" fakes exist). The curated map bootstraps
 * resolution; unknown types always block downstream.
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
  if (coinType === COIN_TYPES.USDC || coinType === COIN_TYPES.USDT) {
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
// On-chain package IDs (verified mainnet)
// ---------------------------------------------------------------------------

/** Native framework package (0x2) — pay/transfer primitives. */
export const NATIVE_PACKAGE =
  "0x0000000000000000000000000000000000000000000000000000000000000002";

/**
 * Mainnet Cetus CLMM package IDs (both original and upgraded).
 * Source: https://cetus-1.gitbook.io/cetus-developer-docs/developer/sui-clmm/deployed-contract
 */
export const CETUS_CLMM_PACKAGE =
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb";

export const CETUS_CLMM_PACKAGE_V2 =
  "0x3edd55b3c42aefc05e58a2fccbe0cbab3e09a08aee0dc6748de68b2e38f5b78c";

/**
 * Cetus Aggregator mainnet package (the integrate package that wraps each DEX).
 * Aggregator PTBs call `<this>::<dex>::swap` per hop — so allowlisting only the
 * activated DEXs' wrapper functions keeps a route through a non-activated DEX
 * fail-closed. Source: @cetusprotocol/aggregator-sdk AGGREGATOR_V3_CONFIG.
 */
export const CETUS_AGGREGATOR_PACKAGE =
  "0xde5d696a79714ca5cb910b9aed99d41f67353abb00715ceaeb0663d57ee39640";

/**
 * NAVI lending mainnet package (incentive_v3 module — deposit/repay/borrow/withdraw).
 * Source: NAVI config API (open-api.naviprotocol.io/api/navi/config → package).
 * [needs live-env] re-verify before a live demo; NAVI can upgrade its package.
 */
export const NAVI_PACKAGE =
  "0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f";

/**
 * Suilend lending_market mainnet package (deposit/repay/borrow/withdraw).
 * Source: @suilend/sdk default packageAddress.
 * [needs live-env] re-verify before a live demo; Suilend can upgrade its package.
 */
export const SUILEND_PACKAGE =
  "0xd5f3054404ec9275b50985851a5b515728f131a3bdd9c9a5f738a9326b738d53";

/**
 * Wormhole Sui mainnet packages. The Token Bridge (WTT) `complete_transfer` is
 * the only keyless-feasible leg — Dewlock hand-builds the redeem PTB the user
 * signs; the source-chain lock/burn is wallet-driven (Wormhole Connect).
 * Source: Wormhole Sui mainnet deployment (verified in the bridge research).
 * [needs live-env] re-verify package + redeem entry before a live demo.
 */
export const WORMHOLE_CORE_PACKAGE =
  "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c";
export const WORMHOLE_WTT_PACKAGE =
  "0xc57508ee0d4595e5a8728974a4a93a787d38f339757230d441e895422c07aba9";

/** Mainnet SuiNS registry package. */
export const SUINS_PACKAGE =
  "0xd22b24490e0bae52676651b4f56660a5ff8022a2576e0089f79b3c88d44e08f";

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

// ---------------------------------------------------------------------------
// Core infrastructure targets — always permitted (native transfer, object share,
// SuiNS forward resolve). These are framework/name-service primitives, not DeFi
// protocols, so they live outside the protocol registry and are unioned into
// ALLOWED_MOVE_TARGETS unconditionally.
// ---------------------------------------------------------------------------

export const CORE_TARGETS: readonly string[] = [
  // Native SUI coin transfer (package 0x2)
  `${NATIVE_PACKAGE}::pay::split_and_transfer`,
  // Object sharing required by createAndShareBalanceManager
  `${NATIVE_PACKAGE}::transfer::public_share_object`,
  // SuiNS forward resolve (read-only; included so resolving within a PTB is permitted)
  `${SUINS_PACKAGE}::registry::lookup`,
];
