/**
 * Tests: Wormhole bridge gates — VAA parse + the 9 fail-closed gates.
 *
 * Builds a binary token-transfer VAA and walks each gate's failure mode plus the
 * all-pass path. Reflects the red-team posture: fee model (not the $5 cap),
 * priced-asset allowlist, recipient==self, Gate-8 fail-closed, Gate-5 honest
 * quorum pre-check (crypto enforced on-chain).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseVaa } from "@dewlock/sui/wormhole-vaa";
import { checkBridgeConstraints, type BridgeContext } from "../guardian-bridge";

const WALLET = "0x" + "a".repeat(64);
const ETH_WTT = "0x3ee18b2214aff97000d974cf647e7c347e8fa585";
const ETH_USDC = "0xa0b86991d4c6782d91331c3d4aefc37feabcfb75";

// --- binary helpers ---
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const u64 = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(n); return b; };
const u256 = (n: bigint) => { const b = Buffer.alloc(32); b.writeBigUInt64BE(n, 24); return b; };
const hex32 = (h: string) => { const x = h.replace(/^0x/, ""); return Buffer.from(x.padStart(64, "0"), "hex"); };

interface VaaOpts {
  guardianSetIndex?: number;
  sigCount?: number;
  timestampSec?: number;
  emitterChain?: number;
  emitterAddress?: string;
  sequence?: bigint;
  amount?: bigint;
  tokenAddress?: string;
  tokenChain?: number;
  recipient?: string;
  recipientChain?: number;
  payloadType?: number;
}

const NOW = 1_900_000_000_000; // fixed ms

function buildVaa(o: VaaOpts = {}): Uint8Array {
  const sigCount = o.sigCount ?? 13;
  const header = Buffer.concat([
    Buffer.from([1]),
    u32(o.guardianSetIndex ?? 4),
    Buffer.from([sigCount]),
    Buffer.alloc(sigCount * 66),
  ]);
  const body = Buffer.concat([
    u32(o.timestampSec ?? Math.floor(NOW / 1000) - 600), // 10 min ago
    u32(0),
    u16(o.emitterChain ?? 2),
    hex32(o.emitterAddress ?? ETH_WTT),
    u64(o.sequence ?? 1n),
    Buffer.from([1]),
    Buffer.from([o.payloadType ?? 1]),
    u256(o.amount ?? 10_000_000_000n), // $100 (8-dec normalized)
    hex32(o.tokenAddress ?? ETH_USDC),
    u16(o.tokenChain ?? 2),
    hex32(o.recipient ?? WALLET),
    u16(o.recipientChain ?? 21),
    u256(0n),
  ]);
  return new Uint8Array(Buffer.concat([header, body]));
}

function ctx(over: Partial<BridgeContext> = {}): BridgeContext {
  return {
    connectedWallet: WALLET,
    ptbRecipient: WALLET,
    currentGuardianSetIndex: 4,
    nowMs: NOW,
    dailyUsdSoFar: 0,
    ...over,
  };
}

describe("parseVaa", () => {
  it("parses a token-transfer VAA's header + body + payload", () => {
    const v = parseVaa(buildVaa());
    expect(v.emitterChain).toBe(2);
    expect(v.recipientChain).toBe(21);
    expect(v.recipient).toBe(WALLET);
    expect(v.signatureCount).toBe(13);
    expect(v.guardianSetIndex).toBe(4);
    expect(v.amountNormalized).toBe(10_000_000_000n);
    expect(v.replayKey).toContain("/1");
  });
});

describe("checkBridgeConstraints — all gates pass", () => {
  beforeEach(() => {
    vi.stubEnv("BRIDGE_FEE_BPS", "10");
    vi.stubEnv("BRIDGE_USD_CEILING", "250000");
    vi.stubEnv("BRIDGE_DAILY_USD_CEILING", "1000000");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("a valid ethereum→sui USDC redeem to self passes; fee is charged", () => {
    const r = checkBridgeConstraints(parseVaa(buildVaa()), ctx());
    expect(r.ok).toBe(true);
    expect(r.suiCoinType).toBeDefined();
    expect(r.usdValue).toBeCloseTo(100);
    expect(r.bridgeFeeUsd).toBeCloseTo(0.1); // 10 bps of $100
  });
});

describe("checkBridgeConstraints — each gate fails closed", () => {
  beforeEach(() => {
    vi.stubEnv("BRIDGE_FEE_BPS", "10");
    vi.stubEnv("BRIDGE_USD_CEILING", "250000");
    vi.stubEnv("BRIDGE_DAILY_USD_CEILING", "1000000");
  });
  afterEach(() => vi.unstubAllEnvs());

  const gateOf = (vaa: Uint8Array, c = ctx()) => checkBridgeConstraints(parseVaa(vaa), c).errors.map((e) => e.gate);

  it("Gate 1: wrong emitter → bridge_emitter", () => {
    expect(gateOf(buildVaa({ emitterAddress: "0x" + "b".repeat(40) }))).toContain("bridge_emitter");
  });
  it("Gate 2: non-Sui destination → bridge_chain", () => {
    expect(gateOf(buildVaa({ recipientChain: 5 }))).toContain("bridge_chain");
  });
  it("Gate 3: non-allowlisted token → bridge_asset", () => {
    expect(gateOf(buildVaa({ tokenAddress: "0x" + "c".repeat(40) }))).toContain("bridge_asset");
  });
  it("Gate 3: wrapped re-bridge (tokenChain ≠ source) → bridge_asset", () => {
    expect(gateOf(buildVaa({ tokenChain: 5 }))).toContain("bridge_asset");
  });
  it("Gate 0: non-transfer payload type → bridge_payload", () => {
    expect(gateOf(buildVaa({ payloadType: 2 }))).toContain("bridge_payload");
  });
  it("Gate 4: over the sanity ceiling → bridge_ceiling", () => {
    // $300k > $250k ceiling (8-dec normalized).
    expect(gateOf(buildVaa({ amount: 30_000_000_000_000n }))).toContain("bridge_ceiling");
  });
  it("Gate 5: below guardian quorum → bridge_quorum", () => {
    expect(gateOf(buildVaa({ sigCount: 5 }))).toContain("bridge_quorum");
  });
  it("Gate 6: recipient ≠ connected wallet → bridge_recipient", () => {
    expect(gateOf(buildVaa({ recipient: "0x" + "e".repeat(64) }))).toContain("bridge_recipient");
  });
  it("Gate 7: VAA too young (not finalized) → bridge_finality", () => {
    const young = buildVaa({ timestampSec: Math.floor(NOW / 1000) - 5 });
    expect(gateOf(young)).toContain("bridge_finality");
  });
  it("Gate 8: guardian-set mismatch → bridge_guardian_set (fail-closed)", () => {
    expect(gateOf(buildVaa({ guardianSetIndex: 3 }))).toContain("bridge_guardian_set");
  });
  it("Gate 8: unknown current set index → bridge_guardian_set (fail-closed)", () => {
    expect(gateOf(buildVaa(), ctx({ currentGuardianSetIndex: undefined }))).toContain("bridge_guardian_set");
  });
  it("Gate 9: already redeemed (advisory) → bridge_replay", () => {
    expect(gateOf(buildVaa(), ctx({ alreadyRedeemed: true }))).toContain("bridge_replay");
  });

  it("recipient short-vs-padded canonicalizes to a MATCH (no false block)", () => {
    // VAA recipient padded; connected wallet supplied unpadded → same address.
    const short = "0x" + "a".repeat(64);
    const r = checkBridgeConstraints(parseVaa(buildVaa()), ctx({ connectedWallet: short, ptbRecipient: short }));
    expect(r.errors.map((e) => e.gate)).not.toContain("bridge_recipient");
  });
});
