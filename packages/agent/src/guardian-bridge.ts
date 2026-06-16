/**
 * guardian-bridge.ts — deterministic, fail-closed gates for the Wormhole Sui redeem.
 *
 * Bridges are the highest-risk DeFi primitive, so this is a SEPARATE, stricter
 * gate set that NEVER relaxes a core gate. Key posture decisions (from the
 * red-team review) differ from a normal trade:
 *
 *  - NOT the $5/$20 trading cap and NOT a $1M reference cap. The real safety is
 *    Gate 6 (recipient == the user's OWN wallet) + VAA verification + a priced-
 *    asset allowlist: redeemed funds can only ever land in the user's account, so
 *    theft-via-redirect is structurally impossible regardless of size. On top we
 *    charge a transparent bridge fee and keep a HIGH sanity ceiling (abuse-rate
 *    guard only, server-authoritative).
 *  - Gate 5 does NOT re-implement guardian-signature cryptography; cryptographic
 *    validity is enforced ON-CHAIN by complete_transfer. We do a cheap quorum
 *    pre-check and say so honestly.
 *  - Gate 8 (guardian-set rotation) is FAIL-CLOSED, not advisory.
 *  - Gate 6 canonicalizes addresses and compares the recipient parsed from the
 *    final PTB bytes (WYSIWYS) against both the VAA payload and the connected
 *    wallet (from the authenticated session, not the request body).
 */

import { getTrustedUsdPrice, COIN_TYPES } from "./allowlist";
import { WORMHOLE_CHAIN_NAMES, type ParsedVAA } from "@dewlock/sui/wormhole-vaa";

// ---------------------------------------------------------------------------
// Config (curated; server-authoritative where it affects value)
// ---------------------------------------------------------------------------

/** Wormhole chain id for Sui. */
const SUI_CHAIN_ID = 21;

/** Known Token-Bridge (WTT) emitter addresses per source chain, 32-byte hex. */
const WTT_EMITTERS: Record<string, string> = {
  // EVM emitters are the 20-byte contract left-padded to 32 bytes.
  ethereum: pad32("0x3ee18b2214aff97000d974cf647e7c347e8fa585"),
  polygon: pad32("0x5a58505fa1c4f8c65385323f7d00faad2161572a"),
  avalanche: pad32("0x0e082f06ff657d94310cb8ce8b0d9a04541d8052"),
  // [needs live-env] solana/base/arbitrum/optimism emitters before enabling them.
};

const ALLOWED_SOURCE_CHAINS = new Set(Object.keys(WTT_EMITTERS));

/**
 * Bridged-asset allowlist: (sourceChain → originTokenAddress → Sui coin type).
 * Restricted to PRICED assets only (USDC/USDT) so the value ceiling is never
 * inert and we never wire a manipulable pool/oracle price for the cap.
 */
const BRIDGE_ASSET_ALLOWLIST: Record<string, Record<string, string>> = {
  ethereum: {
    "0xa0b86991d4c6782d91331c3d4aefc37feabcfb75": COIN_TYPES.USDC,
    "0xdac17f958d2ee523a2206206994597c13d831ec7": COIN_TYPES.USDT,
  },
};

/** Source-chain finality windows (ms) — a VAA younger than this isn't final. */
const FINALITY_MS: Record<string, number> = {
  ethereum: 15 * 12 * 1000,
  polygon: 128 * 2000,
  avalanche: 2000,
};

const MAX_VAA_AGE_MS = 24 * 60 * 60 * 1000; // 24h
/** Minimum guardian quorum (historical 13-of-19; on-chain enforces the real set). */
const MIN_GUARDIAN_QUORUM = 13;

function pad32(addr: string): string {
  const h = addr.replace(/^0x/, "").toLowerCase();
  return "0x" + h.padStart(64, "0");
}

/** Canonicalize a Sui address (left-pad to 32 bytes, lowercase) for comparison. */
export function normalizeSuiAddr(addr: string): string {
  return pad32(addr);
}

/** Server-authoritative bridge fee + sanity ceiling (NEVER client-set). */
export function getBridgeParams(): { feeBps: number; usdCeiling: number; dailyUsdCeiling: number } {
  const feeBps = parseFloat(process.env.BRIDGE_FEE_BPS ?? "10"); // 0.10% default
  const usdCeiling = parseFloat(process.env.BRIDGE_USD_CEILING ?? "250000"); // abuse-rate guard
  const dailyUsdCeiling = parseFloat(process.env.BRIDGE_DAILY_USD_CEILING ?? "1000000");
  return { feeBps, usdCeiling, dailyUsdCeiling };
}

// ---------------------------------------------------------------------------
// Gate runner
// ---------------------------------------------------------------------------

export interface BridgeContext {
  /** Connected wallet from the authenticated session (NOT the request body). */
  connectedWallet: string;
  /** Recipient parsed out of the FINAL redeem PTB bytes (WYSIWYS). */
  ptbRecipient: string;
  /** Current on-chain guardian-set index (undefined = couldn't fetch → fail-closed). */
  currentGuardianSetIndex?: number;
  /** Evaluation time in ms (injected for determinism). */
  nowMs: number;
  /** Rolling daily bridged USD for this wallet (abuse-rate guard). */
  dailyUsdSoFar: number;
  /** Off-chain advisory: has this VAA already been redeemed? (on-chain authoritative) */
  alreadyRedeemed?: boolean;
}

export interface BridgeGateError {
  gate: string;
  reason: string;
}

export interface BridgeResult {
  ok: boolean;
  errors: BridgeGateError[];
  /** Resolved Sui coin type for the bridged asset (when gate 3 passes). */
  suiCoinType?: string;
  /** Bridged value in USD (when priced). */
  usdValue?: number;
  /** Charged bridge fee in USD (preview line item). */
  bridgeFeeUsd?: number;
}

/**
 * Run all 9 bridge gates. Collects ALL failures (fail-closed: any error ⇒ ok:false).
 */
export function checkBridgeConstraints(vaa: ParsedVAA, ctx: BridgeContext): BridgeResult {
  const errors: BridgeGateError[] = [];
  const add = (gate: string, reason: string) => errors.push({ gate, reason });
  const chain = WORMHOLE_CHAIN_NAMES[vaa.emitterChain];

  // Gate 0 — Payload sanity: only token-transfer payloads (1 = transfer,
  // 3 = transfer-with-payload). Any other type means the parsed offsets are not
  // a transfer and amount/token/recipient cannot be trusted. Fail-closed.
  if (vaa.payloadType !== 1 && vaa.payloadType !== 3) {
    add("bridge_payload", `VAA payload type ${vaa.payloadType} is not a token transfer (expected 1 or 3).`);
  }

  // Gate 1 — Emitter matches the known WTT emitter for the source chain.
  if (!chain || !WTT_EMITTERS[chain]) {
    add("bridge_emitter", `Unknown/unsupported source chain id ${vaa.emitterChain}.`);
  } else if (normalizeSuiAddr(vaa.emitterAddress) !== WTT_EMITTERS[chain]) {
    add("bridge_emitter", `Emitter ${vaa.emitterAddress} is not the Wormhole Token-Bridge for ${chain}.`);
  }

  // Gate 2 — Source chain allowlisted AND destination is Sui.
  if (!chain || !ALLOWED_SOURCE_CHAINS.has(chain)) {
    add("bridge_chain", `Source chain ${chain ?? vaa.emitterChain} is not in the bridge allowlist.`);
  }
  if (vaa.recipientChain !== SUI_CHAIN_ID) {
    add("bridge_chain", `Destination chain ${vaa.recipientChain} is not Sui (${SUI_CHAIN_ID}).`);
  }

  // Gate 3 — Asset allowlist (priced assets only). The VAA token address is a
  // 32-byte left-padded value; EVM allowlist keys are 20-byte — compare on the
  // trailing 20 bytes (40 hex).
  const evmToken = "0x" + vaa.tokenAddress.replace(/^0x/, "").slice(-40).toLowerCase();
  const suiCoinType = chain ? BRIDGE_ASSET_ALLOWLIST[chain]?.[evmToken] : undefined;
  if (!suiCoinType) {
    add("bridge_asset", `Token ${vaa.tokenAddress} on ${chain ?? "?"} is not an approved (priced) bridge asset.`);
  } else if (vaa.tokenChain !== vaa.emitterChain) {
    // The allowlist entry is for an asset NATIVE to the source chain. A transfer
    // whose token-origin chain differs is a wrapped re-bridge — refuse it (also
    // closes a trailing-20-byte address collision with a foreign-origin token).
    add("bridge_asset", `Token origin chain ${vaa.tokenChain} ≠ source chain ${vaa.emitterChain} — wrapped re-bridge not allowed.`);
  }

  // Gate 4 — Priced value + bridge fee + HIGH sanity ceiling (NOT a tight cap).
  let usdValue: number | undefined;
  let bridgeFeeUsd: number | undefined;
  if (suiCoinType) {
    const price = getTrustedUsdPrice(suiCoinType);
    if (price === undefined) {
      add("bridge_asset", `No trusted USD price for ${suiCoinType} — cannot bound bridge value. Blocking.`);
    } else {
      // VAA amounts are Wormhole-normalized to 8 decimals.
      usdValue = (Number(vaa.amountNormalized) / 1e8) * price;
      const { feeBps, usdCeiling, dailyUsdCeiling } = getBridgeParams();
      bridgeFeeUsd = (usdValue * feeBps) / 10_000;
      if (usdValue > usdCeiling) {
        add("bridge_ceiling", `Bridge value ~$${usdValue.toFixed(2)} exceeds the sanity ceiling $${usdCeiling}.`);
      }
      if (ctx.dailyUsdSoFar + usdValue > dailyUsdCeiling) {
        add("bridge_daily_ceiling", `Daily bridged ~$${(ctx.dailyUsdSoFar + usdValue).toFixed(2)} exceeds $${dailyUsdCeiling}.`);
      }
    }
  }

  // Gate 5 — Guardian quorum pre-check. NOTE: cryptographic signature validity is
  // enforced ON-CHAIN by complete_transfer; this is a cheap count pre-check only.
  if (vaa.signatureCount < MIN_GUARDIAN_QUORUM) {
    add(
      "bridge_quorum",
      `VAA carries ${vaa.signatureCount} guardian signatures, below the ${MIN_GUARDIAN_QUORUM} quorum. ` +
        "(Signature validity itself is verified on-chain by complete_transfer.)",
    );
  }

  // Gate 6 — Recipient == the user's own wallet (PTB-parsed == VAA == session).
  const vaaR = normalizeSuiAddr(vaa.recipient);
  const ptbR = normalizeSuiAddr(ctx.ptbRecipient);
  const walletR = normalizeSuiAddr(ctx.connectedWallet);
  if (ptbR !== vaaR) {
    add("bridge_recipient", "PTB recipient does not match the VAA payload recipient — possible redirect. Blocking.");
  }
  if (vaaR !== walletR) {
    add("bridge_recipient", "VAA recipient is not the connected wallet — redeemed funds would not land in your account. Blocking.");
  }

  // Gate 7 — Finality + age window.
  const age = ctx.nowMs - vaa.timestampMs;
  const minAge = chain ? FINALITY_MS[chain] ?? 60_000 : 60_000;
  if (age < minAge) {
    add("bridge_finality", `VAA is too young (${Math.round(age / 1000)}s) — source chain not yet finalized. Wait and retry.`);
  } else if (age > MAX_VAA_AGE_MS) {
    add("bridge_finality", "VAA is stale (>24h). Initiate a new bridge transfer.");
  }

  // Gate 8 — Guardian-set rotation: FAIL-CLOSED (not advisory).
  if (ctx.currentGuardianSetIndex === undefined) {
    add("bridge_guardian_set", "Could not fetch the current guardian-set index — blocking (fail-closed).");
  } else if (vaa.guardianSetIndex !== ctx.currentGuardianSetIndex) {
    add(
      "bridge_guardian_set",
      `VAA guardian-set ${vaa.guardianSetIndex} ≠ current ${ctx.currentGuardianSetIndex} — superseded set. Blocking.`,
    );
  }

  // Gate 9 — Replay (off-chain ADVISORY; on-chain complete_transfer is authoritative).
  if (ctx.alreadyRedeemed) {
    add("bridge_replay", "This VAA appears already redeemed (advisory; on-chain enforces replay protection).");
  }

  return { ok: errors.length === 0, errors, suiCoinType, usdValue, bridgeFeeUsd };
}
