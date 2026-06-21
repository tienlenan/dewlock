/**
 * prepareBridgeRedeem — the Sui-side Wormhole redeem guardian flow.
 *
 * Kept SEPARATE from prepareTrade because a bridge redeem has a fundamentally
 * different input + value model: the value safety is recipient==self + VAA verify
 * + a priced-asset allowlist + a bridge fee (NOT the $5/$20 trading cap), and the
 * input is a signed VAA, not a coin amount. This flow:
 *   parse VAA → 9 bridge gates → build redeem PTB → structural (allowlist + shape)
 *   → dry-run + WYSIWYS digest → bridge preview (or a block with gate reasons).
 *
 * The source-chain lock/burn is wallet-driven (Connect) and is NEVER signed by
 * Dewlock — only this Sui redeem is.
 *
 * [needs live-env] This is the bridge guardian ENTRY; no HTTP route wires it yet.
 * When wiring it, `currentGuardianSetIndex` MUST be read from the live Wormhole
 * core-state object (never stubbed/hardcoded) or Gate 8 silently degrades from
 * fail-closed to advisory. Likewise back `dailyUsdSoFar` with a server-side
 * per-wallet tracker (as prepareTrade does) for the abuse-rate ceiling.
 */

import { Transaction } from "@mysten/sui/transactions";
import { dryRunTransaction, getSuiMainnetClient } from "@dewlock/sui";
import { parseVaa } from "@dewlock/sui/wormhole-vaa";
import { buildRedeem } from "@dewlock/sui/build-redeem";
import { checkAllowlist, checkActionShape } from "../guardian";
import type { TradeProposal } from "../guardian";
import { checkBridgeConstraints, getBridgeParams } from "../guardian-bridge";

export interface BridgeRedeemInput {
  /** Connected wallet from the authenticated session (NOT client-supplied). */
  walletAddress: string;
  /** The signed VAA bytes, base64. */
  vaaBase64: string;
  /** Current on-chain guardian-set index (undefined ⇒ fail-closed at Gate 8). */
  currentGuardianSetIndex?: number;
  /** Evaluation time (ms) — injected for determinism. */
  nowMs: number;
  /** Rolling daily bridged USD for this wallet (abuse-rate guard). */
  dailyUsdSoFar?: number;
  /** Off-chain advisory replay flag (on-chain is authoritative). */
  alreadyRedeemed?: boolean;
}

export type BridgeRedeemResult =
  | {
      ok: true;
      txBytes: string;
      approvedDigest: string;
      preview: {
        sourceChain: number;
        suiCoinType: string;
        usdValue: number;
        bridgeFeeUsd: number;
        recipient: string;
        sourceLegNote: string;
        demoFixture: boolean;
      };
    }
  | { ok: false; reasons: string[]; gates: string[] };

async function sha256Hex(b64: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(Buffer.from(b64, "base64")).digest("hex");
}

export async function prepareBridgeRedeem(input: BridgeRedeemInput): Promise<BridgeRedeemResult> {
  const client = getSuiMainnetClient();

  // 1. Parse the VAA (fail-closed on malformed bytes).
  let vaa;
  try {
    vaa = parseVaa(Uint8Array.from(Buffer.from(input.vaaBase64, "base64")));
  } catch (err) {
    return { ok: false, reasons: [err instanceof Error ? err.message : String(err)], gates: ["bridge_vaa_parse"] };
  }

  // 2. The 9 bridge gates. complete_transfer routes on-chain to the VAA recipient,
  //    so the PTB recipient IS the VAA recipient by construction (no redirectable
  //    arg) — the meaningful check is VAA recipient == connected wallet.
  const bridge = checkBridgeConstraints(vaa, {
    connectedWallet: input.walletAddress,
    ptbRecipient: vaa.recipient,
    currentGuardianSetIndex: input.currentGuardianSetIndex,
    nowMs: input.nowMs,
    dailyUsdSoFar: input.dailyUsdSoFar ?? 0,
    alreadyRedeemed: input.alreadyRedeemed,
  });
  if (!bridge.ok || !bridge.suiCoinType || bridge.usdValue === undefined) {
    return { ok: false, reasons: bridge.errors.map((e) => e.reason), gates: bridge.errors.map((e) => e.gate) };
  }

  // 3. Build the redeem PTB.
  let redeem: Awaited<ReturnType<typeof buildRedeem>>;
  try {
    redeem = await buildRedeem(client, { senderAddress: input.walletAddress, vaaBase64: input.vaaBase64, coinType: bridge.suiCoinType });
  } catch (err) {
    return { ok: false, reasons: [err instanceof Error ? err.message : String(err)], gates: ["bridge_build"] };
  }

  // 4. Structural guardian: allowlist + action-shape on the redeem PTB.
  const proposalShim = { actionType: "bridge_redeem", txBytes: redeem.txBytes } as unknown as TradeProposal;
  const allow = await checkAllowlist(redeem.txBytes);
  if (!allow.ok) return { ok: false, reasons: [allow.reason], gates: ["allowlist"] };
  const shape = await checkActionShape(proposalShim);
  if (!shape.ok) return { ok: false, reasons: [shape.reason], gates: ["action_shape"] };

  // 5. Dry-run the FULL bytes (fail-closed), then WYSIWYS over the gas-less TransactionKind:
  //    the client signs the kind and the wallet fills gas at sign time (no stale gas coin).
  try {
    await dryRunTransaction(client, redeem.txBytes);
  } catch (err) {
    return { ok: false, reasons: [err instanceof Error ? err.message : String(err)], gates: ["dry_run"] };
  }
  const kindBytes = await Transaction.from(redeem.txBytes).build({ onlyTransactionKind: true });
  const signableTxBytes = Buffer.from(kindBytes).toString("base64");
  const approvedDigest = await sha256Hex(signableTxBytes);

  return {
    ok: true,
    txBytes: signableTxBytes,
    approvedDigest,
    preview: {
      sourceChain: vaa.emitterChain,
      suiCoinType: bridge.suiCoinType,
      usdValue: bridge.usdValue,
      bridgeFeeUsd: bridge.bridgeFeeUsd ?? (bridge.usdValue * getBridgeParams().feeBps) / 10_000,
      recipient: vaa.recipient,
      sourceLegNote:
        "The source-chain transfer is your own wallet-driven decision (Wormhole Connect) — Dewlock signs ONLY this Sui redeem, and only to your own address.",
      demoFixture: redeem.isFixture,
    },
  };
}
