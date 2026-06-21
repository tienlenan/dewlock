/**
 * protocol-registry-data.ts — seed data for the Sui DeFi protocol registry.
 *
 * Security posture sourced from the incident research (Cetus 2025-05, Nemo 2025-09,
 * Volo 2025-03, Aftermath-PERP 2026-04, Wormhole 2022-02). SDK buildability sourced
 * from the live @mysten/sui peer-dep preflight (repo pins 2.18.0):
 *  - Cetus aggregator (^2.16.3) + NAVI (>=1.25.0) are v2-native → buildable.
 *  - Suilend peers 2.17.0 exactly → buildable via a pnpm override.
 *  - 7K stable peers v1 (v2 only on beta) and Turbos peers v1 → build-deferred.
 *  - Wormhole's Sui SDK hard-deps v1 → built SDK-free (hand-built redeem PTB).
 *
 * `allowlistedTargets` is populated only for protocols with a built adapter; an
 * active-but-deferred protocol carries an empty target list until its phase wires
 * the real targets from the installed SDK's mainnet config.
 */

import {
  COIN_TYPES,
  CETUS_CLMM_PACKAGE,
  CETUS_CLMM_PACKAGE_V2,
  CETUS_AGGREGATOR_PACKAGE,
  CETUS_AGGREGATOR_CETUS_PACKAGE,
  DEEPBOOK_PACKAGE,
  NAVI_PACKAGE,
  SUILEND_PACKAGE,
  WORMHOLE_WTT_PACKAGE,
  AFTERMATH_ROUTER_UTILS_PACKAGE,
} from "./protocol-constants";
import type { ProtocolEntry } from "./protocol-registry";

const { SUI, USDC, USDT, WETH, wBTC, DEEP } = COIN_TYPES;

export const PROTOCOLS: ProtocolEntry[] = [
  // -------------------------------------------------------------------------
  // Active + BUILT (their targets are enforced in ALLOWED_MOVE_TARGETS)
  // -------------------------------------------------------------------------
  {
    id: "cetus",
    name: "Cetus",
    category: "dex",
    sdkPackage: "@cetusprotocol/cetus-sui-clmm-sdk",
    status: "active",
    buildState: "built",
    lastIncident: {
      date: "2025-05-22",
      amountUsd: 223_000_000,
      rootCauseClass: "integer-overflow",
      summary:
        "checked_shlw() fixed-point overflow drained reserves; ~72% recovered, relaunched + re-audited (MoveBit/OtterSec/Zellic).",
    },
    allowlistedTargets: [
      `${CETUS_CLMM_PACKAGE}::pool::swap`,
      `${CETUS_CLMM_PACKAGE_V2}::pool::swap`,
      `${CETUS_CLMM_PACKAGE}::pool::add_liquidity_fix_coin`,
      `${CETUS_CLMM_PACKAGE_V2}::pool::add_liquidity_fix_coin`,
    ],
    coinTypes: [SUI, USDC, USDT],
    guardianNotes:
      "Kept active post-incident: the overflow class is exactly what the independent min-out re-derive defends against.",
  },
  {
    id: "deepbook",
    name: "DeepBook V3",
    category: "dex",
    sdkPackage: "@mysten/deepbook-v3",
    status: "active",
    buildState: "built",
    allowlistedTargets: [
      `${DEEPBOOK_PACKAGE}::pool::place_limit_order`,
      `${DEEPBOOK_PACKAGE}::pool::cancel_order`,
      `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_owner`,
      `${DEEPBOOK_PACKAGE}::balance_manager::generate_proof_as_trader`,
      `${DEEPBOOK_PACKAGE}::balance_manager::new`,
      `${DEEPBOOK_PACKAGE}::balance_manager::deposit`,
      // Settled-balance withdrawal back to the owner. The SDK emits `withdraw` for a
      // partial amount and `withdraw_all` for the full balance — both are needed; the
      // recipient is a TransferObjects command pinned to the sender (Guardian re-asserts).
      `${DEEPBOOK_PACKAGE}::balance_manager::withdraw`,
      `${DEEPBOOK_PACKAGE}::balance_manager::withdraw_all`,
    ],
    coinTypes: [DEEP, SUI, USDC],
    guardianNotes:
      "On-chain CLOB; limit orders restricted to POST_ONLY by the orderbook gates. " +
      "Full order lifecycle: onboard (new+deposit), place, cancel, withdraw settled (recipient=owner).",
  },

  // -------------------------------------------------------------------------
  // Active + DEFERRED (recognized, security-clean; adapter wired in its phase)
  // -------------------------------------------------------------------------
  {
    id: "cetus-aggregator",
    name: "Cetus Aggregator",
    category: "aggregator",
    sdkPackage: "@cetusprotocol/aggregator-sdk",
    status: "active",
    buildState: "built",
    // Only the per-DEX wrapper functions for ACTIVATED venues are allowlisted.
    // A route that touches a non-activated DEX calls `<AGG>::<dex>::swap` for a
    // module that is NOT here → the allowlist gate fail-closes the whole route.
    allowlistedTargets: [
      // A real aggregator swap PTB (verified against the live router_v3 + a built PTB)
      // contains exactly: the router scaffolding in the DEFAULT package + one per-DEX
      // `<integration>::<dex>::swap` per hop. All four are allowlisted exactly — no
      // package-wildcard — so a route through a non-activated DEX (its own integration
      // package + module) still fails the gate.
      `${CETUS_AGGREGATOR_PACKAGE}::router::new_swap_context`,
      `${CETUS_AGGREGATOR_PACKAGE}::router::confirm_swap`,
      `${CETUS_AGGREGATOR_PACKAGE}::router::transfer_or_destroy_coin`,
      // CETUS hop: the live router emits the per-DEX integration package, not the
      // aggregator DEFAULT package. Allow both so the gate matches real PTBs.
      `${CETUS_AGGREGATOR_CETUS_PACKAGE}::cetus::swap`,
      `${CETUS_AGGREGATOR_PACKAGE}::cetus::swap`,
      // DEEPBOOK hop wrapper. [needs live-env] confirm DeepBook's integration package
      // (it did not route for the demo pairs during verification — SUI/USDC is Cetus-only).
      `${CETUS_AGGREGATOR_PACKAGE}::deepbookv3::swap`,
    ],
    coinTypes: [SUI, USDC, USDT],
    guardianNotes:
      "v2-native aggregator (@mysten/sui ^2.16.3). Best-execution across activated venues (Cetus + DeepBook); routes through non-activated DEXs are refused at the allowlist gate.",
  },
  {
    id: "navi",
    name: "NAVI",
    category: "lending",
    sdkPackage: "@naviprotocol/lending",
    status: "active",
    buildState: "built",
    // Only the health-IMPROVING verbs are allowlisted. borrow/withdraw
    // (incentive_v3::borrow/withdraw) are deliberately absent → refused at the
    // allowlist gate until a guarded post-tx health-factor follow-up.
    allowlistedTargets: [
      `${NAVI_PACKAGE}::incentive_v3::entry_deposit`,
      `${NAVI_PACKAGE}::incentive_v3::entry_repay`,
      // The SDK's deposit PTB also refreshes reward/stake state before depositing.
      `${NAVI_PACKAGE}::pool::refresh_stake`,
    ],
    coinTypes: [SUI, USDC, USDT, wBTC],
    guardianNotes: "v2-native (@naviprotocol/lending 2.x, @mysten/sui v2). Deposit/repay only; borrow/withdraw gated off.",
  },
  {
    id: "suilend",
    name: "Suilend",
    category: "lending",
    sdkPackage: "@suilend/sdk",
    status: "active",
    buildState: "built",
    // Deposit = mint cTokens + deposit into obligation; repay = repay. borrow/
    // withdraw (lending_market::borrow / withdraw_ctokens) deliberately absent.
    allowlistedTargets: [
      // A first-time deposit creates the user's obligation, then deposits into it.
      `${SUILEND_PACKAGE}::lending_market::create_obligation`,
      `${SUILEND_PACKAGE}::lending_market::deposit_liquidity_and_mint_ctokens`,
      `${SUILEND_PACKAGE}::lending_market::deposit_ctokens_into_obligation`,
      // A SUI deposit also rebalances the reserve's liquid-staking position — value-neutral
      // protocol accounting the SDK appends to the deposit PTB (moves no user value out).
      `${SUILEND_PACKAGE}::lending_market::rebalance_staker`,
      `${SUILEND_PACKAGE}::lending_market::repay`,
    ],
    coinTypes: [SUI, USDC, USDT],
    guardianNotes:
      "Peers @mysten/sui 2.17.0 exactly — added via pnpm override to 2.18. Live path is bundler-only (SDK is not clean Node-ESM); fixture path tested. Deposit/repay only.",
  },
  {
    id: "7k",
    name: "7K Aggregator",
    category: "aggregator",
    sdkPackage: "@7kprotocol/sdk-ts",
    status: "active",
    buildState: "deferred",
    allowlistedTargets: [],
    coinTypes: [SUI, USDC, USDT],
    guardianNotes:
      "Stable v4 peers @mysten/sui v1; v2 only on 5.0.0-beta. Deferred until a stable v2 ships.",
  },
  {
    id: "turbos",
    name: "Turbos",
    category: "dex",
    sdkPackage: "turbos-clmm-sdk",
    status: "active",
    buildState: "deferred",
    allowlistedTargets: [],
    coinTypes: [SUI, USDC],
    guardianNotes:
      "Peers @mysten/sui ^1 (no v2 release). Carried the same fixed-point lib as the Cetus overflow — note even while active.",
  },
  {
    id: "aftermath",
    name: "Aftermath (spot/agg)",
    category: "aggregator",
    sdkPackage: "aftermath-ts-sdk",
    status: "active",
    buildState: "built",
    // Static scaffolding targets in the Aftermath router utils package.
    // Per-DEX integration calls (router::swap_a_b, router::swap_b_a,
    // router::add_swap_exact_in_to_route) are matched by module::function
    // signature in the Guardian (isAftermathSwapCall) — the integration
    // package changes per pool and is upgradeable (same pattern as Cetus agg).
    // Discovery: 3 live Aftermath swap txns queried via sui_getTransactionBlock
    // (utils pkg 0xdc157...). The referral_vault call is optional/non-value.
    allowlistedTargets: [
      `${AFTERMATH_ROUTER_UTILS_PACKAGE}::swap_cap::obtain_router_cap`,
      `${AFTERMATH_ROUTER_UTILS_PACKAGE}::swap_cap::initiate_path`,
      `${AFTERMATH_ROUTER_UTILS_PACKAGE}::swap_cap::return_router_cap_already_payed_fee`,
    ],
    coinTypes: [SUI, USDC],
    guardianNotes:
      "Spot/aggregation only (PERP excluded). Static utils targets exact-package; per-DEX router calls matched by module::function (isAftermathSwapCall). Verified via 3 live swap txns. [needs live-env] confirm round-trip with funded wallet.",
  },
  {
    id: "scallop",
    name: "Scallop",
    category: "lending",
    sdkPackage: "@scallop-io/sui-scallop-sdk",
    status: "active",
    buildState: "deferred",
    allowlistedTargets: [],
    coinTypes: [SUI, USDC, USDT],
    guardianNotes: "Audit-clean lending; not yet wired.",
  },
  {
    id: "momentum",
    name: "Momentum",
    category: "dex",
    status: "active",
    buildState: "deferred",
    allowlistedTargets: [],
    coinTypes: [SUI, USDC],
    guardianNotes: "CLMM; carried the shared fixed-point lib as the Cetus overflow — patched, monitored.",
  },
  {
    id: "flowx",
    name: "FlowX",
    category: "dex",
    status: "active",
    buildState: "deferred",
    allowlistedTargets: [],
    coinTypes: [SUI, USDC],
    guardianNotes: "Carried the shared fixed-point lib as the Cetus overflow — patched post-incident.",
  },
  {
    id: "haedal",
    name: "Haedal",
    category: "lst",
    status: "active",
    buildState: "deferred",
    allowlistedTargets: [],
    coinTypes: [SUI],
    guardianNotes: "Liquid staking; build-deferred — no unsigned-PTB SDK path yet.",
  },
  {
    id: "wormhole",
    name: "Wormhole Token Bridge",
    category: "bridge",
    status: "active",
    buildState: "built",
    // Only the Sui-side redeem is keyless-feasible; the source leg is wallet-driven.
    allowlistedTargets: [`${WORMHOLE_WTT_PACKAGE}::complete_transfer::complete_transfer`],
    coinTypes: [USDC, USDT],
    guardianNotes:
      "Cross-chain inflow. Built SDK-free (Sui-side redeem only); source leg is wallet-driven (Connect). Safety = recipient==self + VAA verify + priced-asset allowlist + bridge fee (NOT the trading cap).",
  },

  // -------------------------------------------------------------------------
  // HACKED — listed for posture, never built
  // -------------------------------------------------------------------------
  {
    id: "nemo",
    name: "Nemo",
    category: "yield",
    status: "hacked",
    buildState: "excluded",
    lastIncident: {
      date: "2025-09-07",
      amountUsd: 2_400_000,
      rootCauseClass: "access-control",
      summary: "Unaudited code (public flash-loan + flawed query) drained USDC; operations paused.",
    },
    allowlistedTargets: [],
    coinTypes: [USDC],
    guardianNotes: "Yield/PT protocol; excluded pending post-mortem + re-audit.",
  },
  {
    id: "volo",
    name: "Volo",
    category: "lst",
    status: "hacked",
    buildState: "excluded",
    lastIncident: {
      date: "2025-03-21",
      amountUsd: 3_500_000,
      rootCauseClass: "pool-logic",
      summary: "Concentrated-liquidity vault logic flaw; vaults frozen, root cause undisclosed.",
    },
    allowlistedTargets: [],
    coinTypes: [SUI, wBTC],
    guardianNotes: "Liquid staking; excluded pending published post-mortem.",
  },
  {
    id: "aftermath-perp",
    name: "Aftermath PERP",
    category: "perps",
    status: "hacked",
    buildState: "excluded",
    lastIncident: {
      date: "2026-04-29",
      amountUsd: 1_140_000,
      rootCauseClass: "fee-accounting",
      summary: "Negative builder-fee accounting inflated collateral; PERP module paused.",
    },
    allowlistedTargets: [],
    coinTypes: [USDC],
    guardianNotes: "PERP module only; Aftermath spot/agg tracked separately as active.",
  },

  // -------------------------------------------------------------------------
  // LISTED-EXCLUDED — off-model, never built
  // -------------------------------------------------------------------------
  {
    id: "bluefin",
    name: "Bluefin",
    category: "perps",
    status: "listed-excluded",
    buildState: "excluded",
    allowlistedTargets: [],
    coinTypes: [USDC],
    guardianNotes:
      "off-model: perps use off-chain signed orders, not an unsigned PTB — DeepBook covers the on-chain orderbook",
  },
];
