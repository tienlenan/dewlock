/**
 * Badge / rewards catalog — pure, derived from UserStats (receipt-backed).
 *
 * Badges reward what the user did THROUGH Dewlock (the receipt log), so they're
 * deterministic + correct even before the memwal signer is provisioned. Awarding
 * = recompute on read; memwal persistence is a cache, never the authority.
 */

import type { UserStats } from "./user-stats";

export interface BadgeDef {
  id: string;
  /** Fun display name. */
  name: string;
  /** One-line blurb shown on the card. */
  blurb: string;
  /** Earned when this returns true for the user's stats. */
  predicate: (s: UserStats) => boolean;
}

export interface BadgeState {
  id: string;
  name: string;
  blurb: string;
  earned: boolean;
}

export const BADGES: BadgeDef[] = [
  { id: "newbie", name: "Newbie", blurb: "Made your first sealed transaction.", predicate: (s) => s.txCount >= 1 },
  { id: "getting-started", name: "Getting the Hang of It", blurb: "5 transactions in.", predicate: (s) => s.txCount >= 5 },
  { id: "regular", name: "Regular", blurb: "10 transactions — you live here now.", predicate: (s) => s.txCount >= 10 },
  { id: "degen", name: "Degen", blurb: "25 transactions. The Guardian salutes you.", predicate: (s) => s.txCount >= 25 },
  { id: "centurion", name: "Centurion", blurb: "100 transactions, all sealed before signing.", predicate: (s) => s.txCount >= 100 },
  { id: "first-swap", name: "Market Mover", blurb: "Did your first swap.", predicate: (s) => s.actions.swap >= 1 },
  { id: "first-lend", name: "Yield Farmer", blurb: "Supplied or repaid on a lending market.", predicate: (s) => s.actions.lend >= 1 },
  { id: "first-limit", name: "Patient Trader", blurb: "Placed a POST_ONLY limit order.", predicate: (s) => s.actions.limit >= 1 },
  { id: "first-bridge", name: "Chain Hopper", blurb: "Bridged liquidity into Sui.", predicate: (s) => s.actions.bridge >= 1 },
  { id: "multi-tool", name: "Swiss Army Degen", blurb: "Used 3+ different action types.", predicate: (s) => s.distinctActions >= 3 },
  { id: "high-roller", name: "High Roller", blurb: "$100+ moved through the Guardian.", predicate: (s) => s.volumeUsd >= 100 },
];

/** Compute earned vs locked badges for a user's stats. */
export function computeBadges(stats: UserStats): { earned: BadgeState[]; locked: BadgeState[] } {
  const earned: BadgeState[] = [];
  const locked: BadgeState[] = [];
  for (const b of BADGES) {
    const state: BadgeState = { id: b.id, name: b.name, blurb: b.blurb, earned: b.predicate(stats) };
    (state.earned ? earned : locked).push(state);
  }
  return { earned, locked };
}
