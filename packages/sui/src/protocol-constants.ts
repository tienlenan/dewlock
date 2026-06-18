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
  // Sui-ecosystem tokens — on-chain CoinMetadata verified, have a Pyth USD feed, and
  // route to USDC through the Cetus aggregator (all three checked before promotion).
  CETUS: "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
  WAL: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
  NS: "0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS",
  BLUE: "0xe1b45a0e641b9955a20aa0ad1c1f4ad86aad8afb07296d4085e349a50e90bdca::blue::BLUE",
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
  [COIN_TYPES.CETUS]: 9,
  [COIN_TYPES.WAL]: 9,
  [COIN_TYPES.NS]: 6,
  [COIN_TYPES.BLUE]: 9,
};

// ---------------------------------------------------------------------------
// Trusted USD reference prices (manipulation-resistant stable references).
// SUI priced against stablecoins from a known Cetus mainnet pool.
// Stablecoins are always 1.0 USD by definition (accepted within ±2%).
// Unknown types → undefined → guardian blocks.
// ---------------------------------------------------------------------------

/**
 * Normalize a coin type's address to the canonical 32-byte (0x + 64 hex) form so
 * short forms from on-chain data (e.g. dry-run balance changes return "0x2::sui::SUI")
 * match the curated full-length keys ("0x0000…0002::sui::SUI"). Module + struct name
 * are preserved verbatim (case-sensitive). Non-`addr::mod::name` strings pass through.
 */
export function normalizeCoinType(coinType: string): string {
  const parts = coinType.split("::");
  if (parts.length !== 3 || !parts[0].startsWith("0x")) return coinType;
  const addr = parts[0].slice(2).toLowerCase().padStart(64, "0");
  return `0x${addr}::${parts[1]}::${parts[2]}`;
}

/**
 * Optional live-price provider (CoinGecko oracle), registered at RUNTIME to avoid a
 * static import cycle — price-oracle.ts imports COIN_TYPES from here, so this file must
 * not import it back. `null` until price-oracle is loaded (e.g. by the agent route
 * warmer) → callers fall back to the conservative floors below. Never throws.
 */
let livePriceProvider: ((coinType: string) => number | undefined) | null = null;
export function registerLivePriceProvider(fn: (coinType: string) => number | undefined): void {
  livePriceProvider = fn;
}
function livePrice(coinType: string): number | undefined {
  try {
    const v = livePriceProvider?.(coinType);
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Trusted USD price for the Guardian cap (and the portfolio RPC fallback).
 *
 * SAFETY: the value feeds the per-tx/per-day outflow cap, where UNDER-valuing is the
 * dangerous direction (it would let a larger amount pass). So for an asset with both a
 * live feed and a floor we return `max(live, floor)` — a glitch-low/stale feed can only
 * clamp UP to the floor (tighter), never down. A coin with no feed and no floor stays
 * `undefined` → the Guardian blocks it (fail-closed).
 */
export function getTrustedUsdPrice(coinTypeRaw: string): number | undefined {
  // Canonicalize first — on-chain data uses short addresses (0x2) that won't ===
  // the full-length COIN_TYPES keys otherwise.
  const coinType = normalizeCoinType(coinTypeRaw);
  // Stablecoins: always $1 (used as the price anchor, not derived from thin pool)
  if (coinType === COIN_TYPES.USDC || coinType === COIN_TYPES.USDT) {
    return 1.0;
  }
  // SUI: kept on its existing conservative floor here; the Guardian cap already prefers
  // the live SUI/USD from fetchSuiUsdPrice (resolveUsdPrice), so SUI is not split-brained.
  if (coinType === COIN_TYPES.SUI) {
    const envPrice = process.env.SUI_USD_PRICE_FLOOR;
    return envPrice ? parseFloat(envPrice) : 3.0; // conservative floor
  }
  // DEEP: live Pyth (DEEP/USD) clamped up to a conservative floor.
  if (coinType === COIN_TYPES.DEEP) {
    const floor = process.env.DEEP_USD_PRICE_FLOOR ? parseFloat(process.env.DEEP_USD_PRICE_FLOOR) : 0.003;
    return Math.max(livePrice(coinType) ?? 0, floor);
  }
  // WETH / wBTC: live Pyth (ETH/BTC) when warm, clamped UP to a conservative floor so a
  // cold cache or a glitch-low feed never under-values them. This is what makes them
  // actually swappable (previously undefined → always blocked).
  if (coinType === COIN_TYPES.WETH) {
    const floor = process.env.WETH_USD_PRICE_FLOOR ? parseFloat(process.env.WETH_USD_PRICE_FLOOR) : 800;
    return Math.max(livePrice(coinType) ?? 0, floor);
  }
  if (coinType === COIN_TYPES.wBTC) {
    const floor = process.env.WBTC_USD_PRICE_FLOOR ? parseFloat(process.env.WBTC_USD_PRICE_FLOOR) : 15000;
    return Math.max(livePrice(coinType) ?? 0, floor);
  }
  // Any other coin: a live feed if one exists (future coins), else unknown → block.
  return livePrice(coinType);
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
 * Cetus Aggregator DEFAULT published package (AGGREGATOR_V3_CONFIG.DEFAULT_PUBLISHED_AT
 * on Mainnet). NOTE: this is NOT the package that actually appears in a swap PTB —
 * the SDK emits `<route.path.publishedAt>::<dex>::swap`, and the router returns a
 * per-DEX integration package (see CETUS_AGGREGATOR_CETUS_PACKAGE). Kept for the
 * deepbookv3 wrapper allowlist until that DEX's live integration package is verified.
 */
export const CETUS_AGGREGATOR_PACKAGE =
  "0xde5d696a79714ca5cb910b9aed99d41f67353abb00715ceaeb0663d57ee39640";

/**
 * Cetus Aggregator per-DEX integration package the live router emits for CETUS hops
 * (`<this>::cetus::swap`). Verified against the live router_v3 (path.publishedAt for
 * CETUS routes, both directions). This — not DEFAULT_PUBLISHED_AT — is what a real
 * aggregator PTB calls, so the Guardian allowlist must match it.
 * [needs live-env] re-verify before a live demo; Cetus can upgrade this package.
 */
export const CETUS_AGGREGATOR_CETUS_PACKAGE =
  "0x721d950e57259cd97d41010887ab502ee7753b0a3deb4b6a80099aad0c833928";

/**
 * Cetus Aggregator router_v3 swap-PTB call signatures as bare "module::function"
 * (NO package). A swap PTB is exactly the router scaffolding plus one
 * `<dex>::swap` per hop; these signatures enumerate that fixed shape.
 *
 * WHY package-agnostic: the live router returns a per-DEX integration package PER
 * ROUTE — CETUS hops emit one package, DeepBook hops a different one, and the same
 * DEX's package can be upgraded by Cetus at any time. These packages are NOT
 * statically enumerable from the SDK (verified: the live cetus::swap package is
 * absent from the SDK's published-address set), so an exact-package allowlist
 * cannot cover a multi-venue route and falsely blocks legitimate swaps (e.g. a
 * DeepBook leg in "sell all USDC").
 *
 * Safe because the value gates remain authoritative and independent of this set:
 *  - providers are constrained to activated venues (CETUS + DEEPBOOK) at quote time,
 *  - the net-outflow USD cap (from dry-run) bounds actual value leaving the wallet,
 *  - the source-aware min-out re-derive ensures the output is within slippage,
 *  - the coin in/out types must be on the coin allowlist.
 * A swap can therefore only ever be the declared swap, bounded in value, no matter
 * which integration package the aggregator routes through.
 */
export const AGGREGATOR_SWAP_CALL_SIGNATURES: ReadonlySet<string> = new Set([
  "router::new_swap_context",
  "router::confirm_swap",
  "router::transfer_or_destroy_coin",
  "cetus::swap",
  "deepbookv3::swap",
]);

/** True when a MoveCall's module::function is an aggregator swap-route call (any package). */
export function isAggregatorSwapCall(moduleName: string, functionName: string): boolean {
  return AGGREGATOR_SWAP_CALL_SIGNATURES.has(`${moduleName}::${functionName}`);
}

/**
 * Aftermath Router utils package — provides swap_cap::{obtain_router_cap, initiate_path,
 * return_router_cap_already_payed_fee}. These are the static scaffolding calls that
 * appear in EVERY Aftermath swap PTB regardless of which AMM pools are routed through.
 * Source: af.getAddresses().router.packages.utils (verified via SDK introspection).
 * Per-DEX swap calls (router::swap_a_b, router::swap_b_a, router::add_swap_exact_in_to_route)
 * are matched by module::function signature (AFTERMATH_SWAP_CALL_SIGNATURES) because the
 * integration package changes per route (upgradeable, like the Cetus aggregator pattern).
 * [needs live-env] re-verify before a live demo; Aftermath can upgrade this package.
 */
export const AFTERMATH_ROUTER_UTILS_PACKAGE =
  "0xdc15721baa82ba64822d585a7349a1508f76d94ae80e899b06e48369c257750e";

/**
 * Aftermath AMM pool package — used for non-router direct AMM calls.
 * Currently only the router path is supported; kept for completeness.
 */
export const AFTERMATH_AMM_PACKAGE =
  "0xc4049b2d1cc0f6e017fda8260e4377cecd236bd7f56a54fee120816e72e2e0dd";

/**
 * Aftermath router MoveCall families (bare "module::function", NO package).
 *
 * The live router builds a swap PTB from these `router` module function families:
 *   - router::begin_router_tx*        opens the routing context (entry scaffolding)
 *   - router::initiate_path*          records each route path / split
 *   - router::swap_*                  per-DEX pool hops (swap_<c1>_to_<c2>, coords a/b or x/y, + _by_<c>/_w<N>)
 *   - router::end_router_tx*          finalises + enforces the path's expected output
 *   - router::update_path_metadata*   route bookkeeping (moves no value)
 *   - router::assert_expected_*       output assertions (moves no value)
 * plus the legacy `swap_cap::*` scaffolding emitted by an older router version.
 *
 * WHY package-agnostic + function-FAMILY (prefix) matching: Aftermath's server returns
 * a transaction whose scaffolding package is the LATEST router upgrade and whose per-DEX
 * hop packages vary per pool (both upgradeable) — neither can be statically pinned. The
 * function names are combinatorially generated by route shape (#routes r<N>, #ways w<M>,
 * swap direction, fixed-in vs -out), so exact names are unstable; the stable invariant is
 * the module + name family. The value gates (net-outflow USD cap from dry-run deltas,
 * re-derived min-out, provider constraint) bound the swap regardless of which packages /
 * variants route it — identical defense-in-depth to the Cetus aggregator matching.
 *
 * Discovery: enumerated 0x7de5de8d…::router on-chain (sui_getNormalizedMoveModule) and
 * decoded a live r1_w1 swap whose MoveCalls were begin_router_tx_r1_w1_varied_in →
 * initiate_path_by_percent_w1 → 3× swap_*_w1 → end_router_tx_r1_w1 → coin::from_balance.
 * Re-verify before a live demo; Aftermath can upgrade these packages.
 */
export const AFTERMATH_SWAP_CALL_SIGNATURES: ReadonlySet<string> = new Set([
  // Representative current-router members. The matcher below is prefix-based; this
  // set documents canonical signatures but is NOT the exhaustive gate.
  "router::begin_router_tx_r1_w1_varied_in",
  "router::initiate_path_by_percent_w1",
  "router::swap_a_to_b_w1",
  "router::swap_b_to_a_by_b_w1",
  "router::swap_a_to_b_by_a_w1",
  "router::end_router_tx_r1_w1",
  // Legacy router-cap scaffolding (older router version)
  "swap_cap::obtain_router_cap",
  "swap_cap::initiate_path",
  "swap_cap::return_router_cap_already_payed_fee",
]);

/**
 * True when a MoveCall's module::function is an Aftermath router call (any package).
 * Matches the router module's combinatorial function families by prefix plus the
 * legacy swap_cap scaffolding (see the AFTERMATH_SWAP_CALL_SIGNATURES doc).
 */
export function isAftermathSwapCall(moduleName: string, functionName: string): boolean {
  if (moduleName === "swap_cap") {
    return (
      functionName === "obtain_router_cap" ||
      functionName === "initiate_path" ||
      functionName === "return_router_cap_already_payed_fee"
    );
  }
  if (moduleName === "router") {
    return (
      functionName.startsWith("begin_router_tx") ||
      functionName.startsWith("end_router_tx") ||
      functionName.startsWith("initiate_path") ||
      functionName.startsWith("update_path_metadata") ||
      functionName.startsWith("assert_expected_") ||
      // per-DEX pool hops: swap_<c1>_to_<c2>[_by_<c>][_w<N>] where the coordinate
      // letters (a/b, x/y, …) depend on the pool's type-param ordering — and the
      // legacy swap_a_b / swap_b_a names. All begin with "swap_".
      functionName.startsWith("swap_") ||
      functionName === "add_swap_exact_in_to_route"
    );
  }
  return false;
}

/**
 * NAVI lending mainnet package (incentive_v3 module — deposit/repay/borrow/withdraw).
 * This is the LATEST upgrade the official @naviprotocol/lending SDK targets when it
 * builds a deposit/repay PTB — verified on-chain (sui_getNormalizedMoveModule shows
 * incentive_v3 with entry_deposit + entry_repay; original publish 0xd899cf7d…). NAVI's
 * config API still reports an older lineage address (0x81c4…); the SDK calls this one.
 * [needs live-env] re-verify before a live demo — NAVI can upgrade again (new address).
 */
export const NAVI_PACKAGE =
  "0x1e4a13a0494d5facdbe8473e74127b838c2d446ecec0ce262e2eddafa77259cb";

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
  // Destroy a provably-zero coin — the aggregator's buildTransactionBytes emits this
  // to clean up the emptied input coin after a full-balance ("swap all") swap. The
  // Move fn aborts unless the coin's balance is 0, so it can never move value.
  `${NATIVE_PACKAGE}::coin::destroy_zero`,
  // Wrap a swap-output Balance into a Coin for return to the user — the Aftermath
  // router emits this on the output leg. The Balance is an intermediate swap result,
  // so wrapping it creates no value and can never increase wallet outflow.
  `${NATIVE_PACKAGE}::coin::from_balance`,
  // SuiNS forward resolve (read-only; included so resolving within a PTB is permitted)
  `${SUINS_PACKAGE}::registry::lookup`,
];
