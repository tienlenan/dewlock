/**
 * SDK-free VAA fetch + parse for the Wormhole Sui redeem leg.
 *
 * WHY SDK-free: @wormhole-foundation/sdk-sui hard-deps @mysten/sui v1, which would
 * clash with the repo's v2.18. We instead parse the published VAA binary directly
 * and fetch it from the public Wormholescan API — no SDK, no v1/v2 conflict.
 *
 * The parsed VAA feeds the deterministic bridge gates. Cryptographic signature
 * validity is NOT re-implemented here (that is enforced on-chain by the Token
 * Bridge's complete_transfer); we parse the header counts + body for the gates.
 */

// Wormhole chain ids → names (the subset Dewlock recognizes).
export const WORMHOLE_CHAIN_NAMES: Record<number, string> = {
  1: "solana",
  2: "ethereum",
  4: "bsc",
  5: "polygon",
  6: "avalanche",
  21: "sui",
  23: "arbitrum",
  24: "optimism",
  30: "base",
};

export interface ParsedVAA {
  version: number;
  guardianSetIndex: number;
  /** Number of guardian signatures present in the header. */
  signatureCount: number;
  /** Source-chain unix timestamp in milliseconds. */
  timestampMs: number;
  emitterChain: number;
  /** 32-byte emitter address, lowercase 0x-hex. */
  emitterAddress: string;
  sequence: bigint;
  /** Token-transfer payload type (1 = transfer, 3 = transfer-with-payload). */
  payloadType: number;
  /** Bridged amount, Wormhole-normalized (8 decimals). */
  amountNormalized: bigint;
  /** 32-byte origin token address, lowercase 0x-hex. */
  tokenAddress: string;
  tokenChain: number;
  /** 32-byte recipient (the Sui address), lowercase 0x-hex. */
  recipient: string;
  recipientChain: number;
  /** Stable replay key — unique per source transfer. */
  replayKey: string;
}

export class VaaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaaParseError";
  }
}

function toHex(b: Buffer): string {
  return "0x" + b.toString("hex");
}

/**
 * Parse a binary VAA (token-transfer payload). Throws VaaParseError on any
 * malformed input — callers treat a throw as BLOCK (fail-closed).
 */
export function parseVaa(bytes: Uint8Array): ParsedVAA {
  try {
    const buf = Buffer.from(bytes);
    let o = 0;
    const version = buf.readUInt8(o); o += 1;
    const guardianSetIndex = buf.readUInt32BE(o); o += 4;
    const signatureCount = buf.readUInt8(o); o += 1;
    o += signatureCount * 66; // each signature = 1-byte index + 65-byte sig

    const bodyStart = o;
    const timestamp = buf.readUInt32BE(o); o += 4;
    o += 4; // nonce
    const emitterChain = buf.readUInt16BE(o); o += 2;
    const emitterAddress = toHex(buf.subarray(o, o + 32)); o += 32;
    const sequence = buf.readBigUInt64BE(o); o += 8;
    o += 1; // consistencyLevel

    // Token-transfer payload
    const payloadType = buf.readUInt8(o); o += 1;
    const amountNormalized = BigInt(toHex(buf.subarray(o, o + 32))); o += 32;
    const tokenAddress = toHex(buf.subarray(o, o + 32)); o += 32;
    const tokenChain = buf.readUInt16BE(o); o += 2;
    const recipient = toHex(buf.subarray(o, o + 32)); o += 32;
    const recipientChain = buf.readUInt16BE(o); o += 2;

    void bodyStart;
    return {
      version,
      guardianSetIndex,
      signatureCount,
      timestampMs: timestamp * 1000,
      emitterChain,
      emitterAddress,
      sequence,
      payloadType,
      amountNormalized,
      tokenAddress,
      tokenChain,
      recipient,
      recipientChain,
      replayKey: `${emitterChain}/${emitterAddress}/${sequence}`,
    };
  } catch (err) {
    throw new VaaParseError(`Failed to parse VAA bytes: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const WORMHOLESCAN_API =
  process.env.WORMHOLESCAN_API ?? "https://api.wormholescan.io";

/**
 * Fetch a signed VAA by (chain, emitter, sequence) from the public Wormholescan
 * API. THROWS on any failure — callers treat a throw as BLOCK (never proceed on
 * a relayer claim alone). [needs live-env] verify the endpoint shape before demo.
 */
export async function fetchVaaBytes(
  emitterChain: number,
  emitterAddress: string,
  sequence: bigint,
): Promise<Uint8Array> {
  const emitter = emitterAddress.replace(/^0x/, "");
  const url = `${WORMHOLESCAN_API}/api/v1/vaas/${emitterChain}/${emitter}/${sequence}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new VaaParseError(`VAA fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new VaaParseError(`VAA fetch HTTP ${res.status} for ${url}`);
  const json = (await res.json()) as { data?: { vaa?: string } };
  const b64 = json?.data?.vaa;
  if (!b64) throw new VaaParseError("VAA response had no vaa field — blocking.");
  return Uint8Array.from(Buffer.from(b64, "base64"));
}
