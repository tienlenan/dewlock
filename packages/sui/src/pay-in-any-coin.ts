/**
 * pay-in-any-coin — deterministic "pay N <COIN> to <recipient>" while holding a different coin.
 *
 * Turns a single pay intent into a [swap → send-exact] composite: reverse-quote the target amount
 * back into the held coin to SIZE the swap (with a safety margin so the swap's guaranteed minOut
 * covers the exact pay), then the composite engine's chained send delivers EXACTLY the declared
 * amount and returns the dust to the sender. Deterministic (no LLM): parse → size → build → the
 * Guardian re-derives and blocks on any mismatch.
 */

import { fetchAggregatorQuote } from "./aggregator-quotes";
import { COIN_TYPES, COIN_DECIMALS } from "./protocol-constants";
import type { DynamicCompositeLeg } from "./build-composite";

/** Symbols the pay parser recognizes → canonical coin type. */
const SYMBOL_TO_TYPE: Record<string, string> = {
  SUI: COIN_TYPES.SUI,
  USDC: COIN_TYPES.USDC,
};

export interface ParsedPay {
  /** Exact amount to deliver, in the target coin's native units. */
  amountNative: bigint;
  /** Canonical target coin type the recipient receives. */
  coinOut: string;
  symbol: string;
  /** Raw recipient token (0x / .sui / @name / contact) — resolved downstream, never here. */
  recipient: string;
}

/**
 * Parse `pay <amount> <SYMBOL> to <recipient>`. Returns null when it is not a pay intent or the
 * symbol/amount is unsupported (caller falls through to the normal path).
 */
export function parsePayInAnyCoin(text: string): ParsedPay | null {
  const m = text.trim().match(/^pay\s+([\d.,]+)\s+([A-Za-z]+)\s+(?:to|→)\s+(.+)$/i);
  if (!m) return null;
  const symbol = m[2].toUpperCase();
  const coinOut = SYMBOL_TO_TYPE[symbol];
  if (!coinOut) return null;
  const human = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(human) || human <= 0) return null;
  const decimals = COIN_DECIMALS[coinOut] ?? 9;
  const amountNative = BigInt(Math.round(human * 10 ** decimals));
  if (amountNative <= 0n) return null;
  const recipient = m[3].trim().replace(/[.,;!?]+$/, "");
  if (!recipient) return null;
  return { amountNative, coinOut, symbol, recipient };
}

export interface PayLegsOptions {
  /** Coin the sender actually holds and swaps FROM (e.g. SUI). */
  heldCoin: string;
  /** Target coin the recipient receives. */
  coinOut: string;
  /** Exact amount to deliver, in target-coin native units. */
  amountOut: bigint;
  /** Resolved 0x recipient. */
  recipient: string;
  slippageBps?: number;
  /** Extra buffer over the reverse-quoted input so the swap's minOut covers amountOut. */
  marginBps?: number;
  /** Injected for tests; defaults to the live aggregator quote. */
  quote?: typeof fetchAggregatorQuote;
}

/**
 * Build the [swap heldCoin→coinOut (sized), send EXACT amountOut → recipient] legs. The swap input
 * is reverse-quoted from `amountOut` + `marginBps` so the swap's guaranteed minOut >= amountOut;
 * the chained send splits exactly `amountOut` and the engine flushes the dust back to the sender.
 */
export async function buildPayInAnyCoinLegs(opts: PayLegsOptions): Promise<DynamicCompositeLeg[]> {
  const slippageBps = opts.slippageBps ?? 50;
  const marginBps = opts.marginBps ?? 800; // 8% buffer over the exact equivalent (dust returns to sender)
  if (opts.amountOut <= 0n) throw new Error("pay amount must be positive");
  if (opts.heldCoin === opts.coinOut) throw new Error("pay-in-any-coin requires a different held coin");

  const quote = opts.quote ?? fetchAggregatorQuote;
  // Reverse quote: how much heldCoin is ~= amountOut of coinOut.
  const rev = await quote(opts.coinOut, opts.heldCoin, opts.amountOut, slippageBps);
  const heldNeeded = rev.estimatedAmountOut;
  if (heldNeeded <= 0n) throw new Error("pay-in-any-coin: reverse quote returned zero");
  const swapIn = (heldNeeded * BigInt(10_000 + marginBps)) / 10_000n;

  return [
    { actionType: "swap", coinTypeIn: opts.heldCoin, coinTypeOut: opts.coinOut, amountInNative: swapIn, slippageBps },
    { actionType: "send", coinTypeIn: opts.coinOut, amountInNative: opts.amountOut, recipient: opts.recipient, amountFrom: "prev-output" },
  ];
}
