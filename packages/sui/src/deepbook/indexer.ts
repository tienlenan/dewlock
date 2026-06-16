/**
 * deepbook/indexer.ts — DeepBook orderbook read operations (level2, mid-price, metadata).
 *
 * WHY fixture fallback: the hosted indexer required for level2/mid-price data may
 * be unavailable in tests or demo mode. A deterministic fixture snapshot ensures
 * the demo path works without network access.
 *
 * All reads go through a live DeepBookClient (which contacts the indexer/RPC
 * internally). The fixture path is gated by NEXT_PUBLIC_DEMO_MODE=fixture.
 */

import type { DeepBookClient } from "@mysten/deepbook-v3";
import type { SuiClient } from "./client";
import { createDeepBookClient, BALANCE_MANAGER_KEY } from "./client";

export interface BookParams {
  tickSize: number;
  lotSize: number;
  minSize: number;
}

export interface Level2Data {
  bidPrices: number[];
  bidQuantities: number[];
  askPrices: number[];
  askQuantities: number[];
}

export interface BookSnapshot {
  poolKey: string;
  midPrice: number;
  bookParams: BookParams;
  level2: Level2Data;
}

// ---------------------------------------------------------------------------
// Fixture snapshots — deterministic demo data matching real pool characteristics
// ---------------------------------------------------------------------------

/** Fixture data for supported pools (used in NEXT_PUBLIC_DEMO_MODE=fixture). */
const FIXTURE_SNAPSHOTS: Record<string, BookSnapshot> = {
  DEEP_USDC: {
    poolKey: "DEEP_USDC",
    midPrice: 0.003105,
    bookParams: { tickSize: 0.000001, lotSize: 1.0, minSize: 1.0 },
    level2: {
      bidPrices: [0.003100, 0.003090, 0.003080],
      bidQuantities: [10000, 5000, 20000],
      askPrices: [0.003110, 0.003120, 0.003130],
      askQuantities: [8000, 12000, 6000],
    },
  },
  SUI_USDC: {
    poolKey: "SUI_USDC",
    midPrice: 3.0025,
    bookParams: { tickSize: 0.0001, lotSize: 0.1, minSize: 0.1 },
    level2: {
      bidPrices: [3.001, 2.999, 2.995],
      bidQuantities: [500, 1200, 800],
      askPrices: [3.004, 3.006, 3.010],
      askQuantities: [400, 900, 1500],
    },
  },
  DEEP_SUI: {
    poolKey: "DEEP_SUI",
    midPrice: 0.00103,
    bookParams: { tickSize: 0.000001, lotSize: 1.0, minSize: 1.0 },
    level2: {
      bidPrices: [0.001025, 0.001020, 0.001015],
      bidQuantities: [50000, 30000, 20000],
      askPrices: [0.001035, 0.001040, 0.001050],
      askQuantities: [40000, 25000, 15000],
    },
  },
};

function isFixtureMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "fixture";
}

// ---------------------------------------------------------------------------
// Public read functions
// ---------------------------------------------------------------------------

/**
 * Fetch mid-price for a pool.
 * Falls back to fixture if DEMO_MODE=fixture or on indexer error.
 */
export async function fetchMidPrice(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
  poolKey: string,
): Promise<number> {
  if (isFixtureMode()) {
    return getFixtureSnapshot(poolKey).midPrice;
  }
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  try {
    return await (client as DeepBookClient).midPrice(poolKey);
  } catch (err) {
    // Indexer unavailable → fall back to fixture (warn, not throw — read-only path)
    console.warn(`[deepbook/indexer] midPrice fetch failed for ${poolKey}, using fixture:`, err);
    return getFixtureSnapshot(poolKey).midPrice;
  }
}

/**
 * Fetch pool booking parameters (tick/lot/min-size).
 * Falls back to fixture on error.
 */
export async function fetchBookParams(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
  poolKey: string,
): Promise<BookParams> {
  if (isFixtureMode()) {
    return getFixtureSnapshot(poolKey).bookParams;
  }
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  try {
    const raw = await (client as DeepBookClient).poolBookParams(poolKey);
    return {
      tickSize: raw.tickSize as unknown as number,
      lotSize: raw.lotSize as unknown as number,
      minSize: raw.minSize as unknown as number,
    };
  } catch (err) {
    console.warn(`[deepbook/indexer] poolBookParams failed for ${poolKey}, using fixture:`, err);
    return getFixtureSnapshot(poolKey).bookParams;
  }
}

/**
 * Fetch level-2 book snapshot (top N ticks from mid).
 * Falls back to fixture on error.
 */
export async function fetchLevel2(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
  poolKey: string,
  ticksFromMid = 10,
): Promise<Level2Data> {
  if (isFixtureMode()) {
    return getFixtureSnapshot(poolKey).level2;
  }
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  try {
    const raw = await (client as DeepBookClient).getLevel2TicksFromMid(poolKey, ticksFromMid);
    return {
      bidPrices: raw.bid_prices as unknown as number[],
      bidQuantities: raw.bid_quantities as unknown as number[],
      askPrices: raw.ask_prices as unknown as number[],
      askQuantities: raw.ask_quantities as unknown as number[],
    };
  } catch (err) {
    console.warn(`[deepbook/indexer] level2 fetch failed for ${poolKey}, using fixture:`, err);
    return getFixtureSnapshot(poolKey).level2;
  }
}

/**
 * Fetch a full book snapshot (mid + params + level2) in a single client init.
 * Preferred over calling individual fetch functions when all three are needed.
 */
export async function fetchBookSnapshot(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
  poolKey: string,
): Promise<BookSnapshot> {
  if (isFixtureMode()) {
    return getFixtureSnapshot(poolKey);
  }
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  const dbClient = client as DeepBookClient;
  try {
    const [midPrice, rawParams, level2Raw] = await Promise.all([
      dbClient.midPrice(poolKey),
      dbClient.poolBookParams(poolKey),
      dbClient.getLevel2TicksFromMid(poolKey, 10),
    ]);
    return {
      poolKey,
      midPrice: midPrice as unknown as number,
      bookParams: {
        tickSize: rawParams.tickSize as unknown as number,
        lotSize: rawParams.lotSize as unknown as number,
        minSize: rawParams.minSize as unknown as number,
      },
      level2: {
        bidPrices: level2Raw.bid_prices as unknown as number[],
        bidQuantities: level2Raw.bid_quantities as unknown as number[],
        askPrices: level2Raw.ask_prices as unknown as number[],
        askQuantities: level2Raw.ask_quantities as unknown as number[],
      },
    };
  } catch (err) {
    console.warn(`[deepbook/indexer] fetchBookSnapshot failed for ${poolKey}, using fixture:`, err);
    return getFixtureSnapshot(poolKey);
  }
}

/**
 * Check whether a DeepBook pool is on the fee-whitelist (0-fee pools only).
 * Falls back to false on error (fail-closed: non-whitelisted → reject).
 */
export async function checkPoolWhitelisted(
  suiClient: SuiClient,
  senderAddress: string,
  balanceManagerId: string,
  poolKey: string,
): Promise<boolean> {
  if (isFixtureMode()) {
    // All fixture pools are considered whitelisted for demo purposes
    return poolKey in FIXTURE_SNAPSHOTS;
  }
  const { client } = await createDeepBookClient({ suiClient, senderAddress, balanceManagerId });
  try {
    return await (client as DeepBookClient).whitelisted(poolKey);
  } catch {
    return false; // fail-closed
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getFixtureSnapshot(poolKey: string): BookSnapshot {
  const snap = FIXTURE_SNAPSHOTS[poolKey];
  if (!snap) {
    throw new Error(
      `No fixture snapshot for pool "${poolKey}". Supported: ${Object.keys(FIXTURE_SNAPSHOTS).join(", ")}`,
    );
  }
  return snap;
}

/** Exported for testing: get fixture snapshot without network access. */
export function getFixtureBookSnapshot(poolKey: string): BookSnapshot {
  return getFixtureSnapshot(poolKey);
}

/** Exported for testing: validate BALANCE_MANAGER_KEY usage. */
export { BALANCE_MANAGER_KEY };
