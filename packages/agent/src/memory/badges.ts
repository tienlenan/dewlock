/**
 * Badge / rewards catalog — pure, derived from a BadgeInput (receipt-backed +
 * injected external fields). ~50 badges across 12 categories: total-tx
 * milestones, per-action-type progressions (swap / send / lend / limit / bridge
 * each tracked separately), volume tiers, portfolio-value tiers, protocol
 * diversity, loyalty (wallet age), conviction, security-savvy, and level
 * milestones.
 *
 * Badges reward what the user actually did (receipts = source of truth); the
 * durable wallet profile (Phase 7) persists them monotonically. A badge whose
 * data source is unavailable (e.g. portfolio value when BlockVision is down)
 * stays locked — never fabricated.
 */

import type { BadgeInput } from "./user-stats";

export type BadgeCategory =
  | "milestone"
  | "swap"
  | "send"
  | "lend"
  | "limit"
  | "bridge"
  | "volume"
  | "portfolio"
  | "diversity"
  | "loyalty"
  | "conviction"
  | "security"
  | "level";

export interface BadgeDef {
  id: string;
  category: BadgeCategory;
  name: string;
  blurb: string;
  predicate: (s: BadgeInput) => boolean;
}

export interface BadgeState {
  id: string;
  category: BadgeCategory;
  name: string;
  blurb: string;
  earned: boolean;
}

// Optional-field readers default missing data to 0 → the badge stays locked.
const pf = (s: BadgeInput) => s.portfolioUsd ?? 0;
const pr = (s: BadgeInput) => s.protocolsUsed ?? 0;
const da = (s: BadgeInput) => s.daysActive ?? 0;
const cv = (s: BadgeInput) => s.convictionDays ?? 0;
const lv = (s: BadgeInput) => s.level ?? 0;

export const BADGES: BadgeDef[] = [
  // --- Milestones (total transactions) ---
  { id: "newbie", category: "milestone", name: "Newbie", blurb: "Made your first sealed transaction.", predicate: (s) => s.txCount >= 1 },
  { id: "getting-started", category: "milestone", name: "Getting the Hang of It", blurb: "5 transactions in.", predicate: (s) => s.txCount >= 5 },
  { id: "regular", category: "milestone", name: "Regular", blurb: "10 transactions — you live here now.", predicate: (s) => s.txCount >= 10 },
  { id: "degen", category: "milestone", name: "Degen", blurb: "25 transactions. The Guardian salutes you.", predicate: (s) => s.txCount >= 25 },
  { id: "power-user", category: "milestone", name: "Power User", blurb: "50 sealed transactions.", predicate: (s) => s.txCount >= 50 },
  { id: "centurion", category: "milestone", name: "Centurion", blurb: "100 transactions, all sealed before signing.", predicate: (s) => s.txCount >= 100 },

  // --- Swap ---
  { id: "first-swap", category: "swap", name: "Market Mover", blurb: "Did your first swap.", predicate: (s) => s.actions.swap >= 1 },
  { id: "swapper", category: "swap", name: "Swapper", blurb: "10 swaps.", predicate: (s) => s.actions.swap >= 10 },
  { id: "swap-savant", category: "swap", name: "Swap Savant", blurb: "50 swaps.", predicate: (s) => s.actions.swap >= 50 },
  { id: "swap-machine", category: "swap", name: "Swap Machine", blurb: "100 swaps.", predicate: (s) => s.actions.swap >= 100 },

  // --- Send / transfer ---
  { id: "first-send", category: "send", name: "Courier", blurb: "Sent your first transfer.", predicate: (s) => s.actions.transfer >= 1 },
  { id: "frequent-sender", category: "send", name: "Frequent Sender", blurb: "10 transfers.", predicate: (s) => s.actions.transfer >= 10 },
  { id: "dispatcher", category: "send", name: "Dispatcher", blurb: "50 transfers.", predicate: (s) => s.actions.transfer >= 50 },
  { id: "courier-elite", category: "send", name: "Courier Elite", blurb: "100 transfers.", predicate: (s) => s.actions.transfer >= 100 },

  // --- Lend ---
  { id: "first-lend", category: "lend", name: "Yield Farmer", blurb: "Supplied or repaid on a lending market.", predicate: (s) => s.actions.lend >= 1 },
  { id: "supplier", category: "lend", name: "Supplier", blurb: "10 lending actions.", predicate: (s) => s.actions.lend >= 10 },
  { id: "yield-veteran", category: "lend", name: "Yield Veteran", blurb: "25 lending actions.", predicate: (s) => s.actions.lend >= 25 },
  { id: "lending-whale", category: "lend", name: "Lending Whale", blurb: "50 lending actions.", predicate: (s) => s.actions.lend >= 50 },

  // --- Limit / DeepBook ---
  { id: "first-limit", category: "limit", name: "Patient Trader", blurb: "Placed a POST_ONLY limit order.", predicate: (s) => s.actions.limit >= 1 },
  { id: "maker", category: "limit", name: "Maker", blurb: "10 limit orders.", predicate: (s) => s.actions.limit >= 10 },
  { id: "orderbook-regular", category: "limit", name: "Order-Book Regular", blurb: "50 limit orders.", predicate: (s) => s.actions.limit >= 50 },
  { id: "limit-master", category: "limit", name: "Limit Master", blurb: "100 limit orders.", predicate: (s) => s.actions.limit >= 100 },

  // --- Bridge ---
  { id: "first-bridge", category: "bridge", name: "Chain Hopper", blurb: "Bridged liquidity into Sui.", predicate: (s) => s.actions.bridge >= 1 },
  { id: "bridger", category: "bridge", name: "Bridger", blurb: "5 bridge redeems.", predicate: (s) => s.actions.bridge >= 5 },
  { id: "omnichain", category: "bridge", name: "Omnichain", blurb: "10 bridge redeems.", predicate: (s) => s.actions.bridge >= 10 },
  { id: "bridge-veteran", category: "bridge", name: "Bridge Veteran", blurb: "25 bridge redeems.", predicate: (s) => s.actions.bridge >= 25 },

  // --- Volume (USD moved) ---
  { id: "first-dollar", category: "volume", name: "First Dollar", blurb: "Moved your first dollar of value.", predicate: (s) => s.volumeUsd >= 1 },
  { id: "high-roller", category: "volume", name: "High Roller", blurb: "$100+ moved through the Guardian.", predicate: (s) => s.volumeUsd >= 100 },
  { id: "big-mover", category: "volume", name: "Big Mover", blurb: "$1,000+ moved.", predicate: (s) => s.volumeUsd >= 1_000 },
  { id: "heavy-hitter", category: "volume", name: "Heavy Hitter", blurb: "$10,000+ moved.", predicate: (s) => s.volumeUsd >= 10_000 },
  { id: "volume-whale", category: "volume", name: "Whale", blurb: "$100,000+ moved.", predicate: (s) => s.volumeUsd >= 100_000 },

  // --- Portfolio value (BlockVision) ---
  { id: "portfolio-starter", category: "portfolio", name: "Portfolio Starter", blurb: "$100+ in your wallet.", predicate: (s) => pf(s) >= 100 },
  { id: "portfolio-builder", category: "portfolio", name: "Portfolio Builder", blurb: "$1,000+ portfolio.", predicate: (s) => pf(s) >= 1_000 },
  { id: "portfolio-whale", category: "portfolio", name: "Portfolio Whale", blurb: "$10,000+ portfolio.", predicate: (s) => pf(s) >= 10_000 },
  { id: "portfolio-kraken", category: "portfolio", name: "Kraken", blurb: "$100,000+ portfolio.", predicate: (s) => pf(s) >= 100_000 },

  // --- Diversity ---
  { id: "multi-tool", category: "diversity", name: "Swiss Army Degen", blurb: "Used 3+ different action types.", predicate: (s) => s.distinctActions >= 3 },
  { id: "all-rounder", category: "diversity", name: "All-Rounder", blurb: "Used all 5 action types.", predicate: (s) => s.distinctActions >= 5 },
  { id: "protocol-explorer", category: "diversity", name: "Protocol Explorer", blurb: "Touched 3+ protocols.", predicate: (s) => pr(s) >= 3 },
  { id: "protocol-connoisseur", category: "diversity", name: "Protocol Connoisseur", blurb: "Touched 6+ protocols.", predicate: (s) => pr(s) >= 6 },

  // --- Loyalty (wallet age) ---
  { id: "rookie-day", category: "loyalty", name: "Day One", blurb: "Active for a day.", predicate: (s) => da(s) >= 1 },
  { id: "week-one", category: "loyalty", name: "Week One", blurb: "Active for a week.", predicate: (s) => da(s) >= 7 },
  { id: "month-one", category: "loyalty", name: "Monthly Regular", blurb: "Active for a month.", predicate: (s) => da(s) >= 30 },
  { id: "veteran", category: "loyalty", name: "Veteran", blurb: "Active for 90+ days.", predicate: (s) => da(s) >= 90 },

  // --- Conviction (kept risk cap) ---
  { id: "conviction", category: "conviction", name: "Conviction", blurb: "Held your risk cap for a week.", predicate: (s) => cv(s) >= 7 },
  { id: "iron-conviction", category: "conviction", name: "Iron Conviction", blurb: "Held your risk cap for a month.", predicate: (s) => cv(s) >= 30 },

  // --- Security-savvy ---
  { id: "close-call", category: "security", name: "Close Call", blurb: "The Guardian blocked a risky action — and you heeded it.", predicate: (s) => (s.blocksHeeded ?? 0) >= 1 },
  { id: "eagle-eye", category: "security", name: "Eagle Eye", blurb: "Dodged a SuiNS lookalike near-miss.", predicate: (s) => (s.lookalikeDodged ?? 0) >= 1 },
  { id: "guardian-graduate", category: "security", name: "Guardian Graduate", blurb: "Heeded 5 Guardian blocks.", predicate: (s) => (s.blocksHeeded ?? 0) >= 5 },
  { id: "sealed-signer", category: "security", name: "Sealed Signer", blurb: "Signed exactly the bytes the Guardian approved.", predicate: (s) => s.txCount >= 1 },

  // --- Level milestones ---
  { id: "level-5", category: "level", name: "Operator", blurb: "Reached level 5.", predicate: (s) => lv(s) >= 5 },
  { id: "level-10", category: "level", name: "Strategist", blurb: "Reached level 10.", predicate: (s) => lv(s) >= 10 },
  { id: "level-25", category: "level", name: "Sentinel Prime", blurb: "Reached level 25.", predicate: (s) => lv(s) >= 25 },
];

/** Compute earned vs locked badges for a user's input. */
export function computeBadges(stats: BadgeInput): { earned: BadgeState[]; locked: BadgeState[] } {
  const earned: BadgeState[] = [];
  const locked: BadgeState[] = [];
  for (const b of BADGES) {
    const state: BadgeState = {
      id: b.id,
      category: b.category,
      name: b.name,
      blurb: b.blurb,
      earned: b.predicate(stats),
    };
    (state.earned ? earned : locked).push(state);
  }
  return { earned, locked };
}

/**
 * Build earned/locked from an explicit set of earned ids — used to render the
 * DURABLE (monotonic) profile, where a badge stays earned even if the current
 * derive wouldn't re-award it.
 */
export function badgesFromEarnedIds(earnedIds: Iterable<string>): { earned: BadgeState[]; locked: BadgeState[] } {
  const set = new Set(earnedIds);
  const earned: BadgeState[] = [];
  const locked: BadgeState[] = [];
  for (const b of BADGES) {
    const state: BadgeState = { id: b.id, category: b.category, name: b.name, blurb: b.blurb, earned: set.has(b.id) };
    (state.earned ? earned : locked).push(state);
  }
  return { earned, locked };
}
