/**
 * BadgeMedal — a hexagon medallion holding a category glyph, tinted by tier.
 *
 * Tier runs bronze → silver → gold → platinum → aqua, with the brand accent as
 * the pinnacle. Tier is derived from a badge's rank within its category
 * progression (see tierForRank + BADGE_ORDER). Earned medallions are tier-tinted
 * and full-strength; locked ones are a dim neutral outline. Pure presentation.
 */

import { glyphMarkupFor } from "./badge-glyphs";

// Medal tier ramp — index 0 = tier 1 (bronze) … index 4 = tier 5 (aqua brand).
export const TIER_META = [
  { color: "#C08457", name: "Bronze" },
  { color: "#94A3B4", name: "Silver" },
  { color: "#E0A53A", name: "Gold" },
  { color: "#2BB3C4", name: "Platinum" },
  { color: "#0C89E9", name: "Aqua" },
] as const;

/** Tier (1–5) from a badge's rank within its category, spread first→last. */
export function tierForRank(rank: number, count: number): number {
  if (count <= 1) return 5;
  return Math.min(5, Math.max(1, Math.round((rank / (count - 1)) * 4) + 1));
}

/**
 * Canonical catalog order — mirrors packages/agent/src/memory/badges.ts so the
 * dashboard can rank each badge within its category and pick a medal tier
 * (the API DTO carries no order). Keep in sync if the catalog changes.
 */
export const BADGE_ORDER: string[] = [
  "newbie", "getting-started", "regular", "degen", "power-user", "centurion",
  "first-swap", "swapper", "swap-savant", "swap-machine",
  "first-send", "frequent-sender", "dispatcher", "courier-elite",
  "first-lend", "supplier", "yield-veteran", "lending-whale",
  "first-limit", "maker", "orderbook-regular", "limit-master",
  "first-bridge", "bridger", "omnichain", "bridge-veteran",
  "first-dollar", "high-roller", "big-mover", "heavy-hitter", "volume-whale",
  "portfolio-starter", "portfolio-builder", "portfolio-whale", "portfolio-kraken",
  "multi-tool", "all-rounder", "protocol-explorer", "protocol-connoisseur",
  "rookie-day", "week-one", "month-one", "veteran",
  "conviction", "iron-conviction",
  "close-call", "eagle-eye", "guardian-graduate", "sealed-signer",
  "level-5", "level-10", "level-25",
];

const HEX = "45,24 34.5,5.81 13.5,5.81 3,24 13.5,42.19 34.5,42.19";

export function BadgeMedal({
  badgeId,
  tier,
  earned,
  size = 44,
  title,
}: {
  badgeId: string;
  tier: number;
  earned: boolean;
  size?: number;
  title?: string;
}) {
  const meta = TIER_META[Math.min(5, Math.max(1, tier)) - 1];
  const ring = earned ? meta.color : "var(--border-strong)";
  const fill = earned ? `color-mix(in srgb, ${meta.color} 14%, transparent)` : "transparent";
  const ink = earned ? meta.color : "var(--fg-faint)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title ?? "badge"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points={HEX} fill={fill} stroke={ring} strokeWidth={1.5} />
      <g
        transform="translate(12 12)"
        fill="none"
        stroke={ink}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: ink, opacity: earned ? 1 : 0.5 }}
        dangerouslySetInnerHTML={{ __html: glyphMarkupFor(badgeId) }}
      />
    </svg>
  );
}
