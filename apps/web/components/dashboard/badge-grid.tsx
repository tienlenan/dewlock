"use client";

/**
 * BadgeGrid — the ~50 reward badges as a trophy case, grouped by category and
 * ordered by progression. Each badge is a hexagon medallion whose tier (bronze →
 * aqua) reflects its rank in the category. Earned medals are tier-tinted; locked
 * ones are dimmed. Pure presentation, derived from the receipt-backed profile.
 */

import type { BadgeStateDto } from "./types";
import { BadgeMedal, BADGE_ORDER, tierForRank, TIER_META } from "./badge-medal";

const CATEGORY_ORDER = [
  "milestone", "swap", "send", "lend", "limit", "bridge",
  "volume", "portfolio", "diversity", "loyalty", "conviction", "security", "level",
];
const CATEGORY_LABELS: Record<string, string> = {
  milestone: "Milestones",
  swap: "Swaps",
  send: "Transfers",
  lend: "Lending",
  limit: "Limit orders",
  bridge: "Bridge",
  volume: "Volume",
  portfolio: "Portfolio",
  diversity: "Diversity",
  loyalty: "Loyalty",
  conviction: "Conviction",
  security: "Security",
  level: "Levels",
};

const orderIndex = (id: string) => {
  const i = BADGE_ORDER.indexOf(id);
  return i === -1 ? 999 : i;
};

function TrophyCell({ badge, tier }: { badge: BadgeStateDto; tier: number }) {
  const earned = badge.earned;
  const tierName = TIER_META[Math.min(5, Math.max(1, tier)) - 1].name;
  return (
    <div
      title={`${badge.name} — ${badge.blurb}${earned ? ` · ${tierName}` : " · locked"}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "10px 4px 8px",
        borderRadius: 12,
        background: earned ? "var(--bg-sub)" : "transparent",
        border: `1px solid ${earned ? "var(--border)" : "transparent"}`,
      }}
    >
      <BadgeMedal badgeId={badge.id} tier={tier} earned={earned} size={46} title={badge.name} />
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          lineHeight: 1.25,
          textAlign: "center",
          color: earned ? "var(--fg)" : "var(--fg-faint)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {badge.name}
      </span>
    </div>
  );
}

export function BadgeGrid({ earned, locked }: { earned: BadgeStateDto[]; locked: BadgeStateDto[] }) {
  const all = [...earned, ...locked];

  // Group by category (canonical order; unknown categories last).
  const byCat = new Map<string, BadgeStateDto[]>();
  for (const b of all) {
    const cat = b.category ?? "other";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(b);
  }
  const cats = [...byCat.keys()].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99),
  );

  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 560, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex items-center justify-between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Badges</span>
        <span className="split-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--fg-muted)" }}>
          {earned.length}/{all.length} earned
        </span>
      </div>

      <div style={{ padding: "8px 14px 16px" }}>
        {cats.map((cat) => {
          // Order each category by progression so tiers ramp bronze → aqua.
          const items = byCat.get(cat)!.slice().sort((a, b) => orderIndex(a.id) - orderIndex(b.id));
          const earnedCount = items.filter((b) => b.earned).length;
          return (
            <div key={cat} style={{ marginTop: 12 }}>
              <div className="split-mono" style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--fg-muted)", margin: "0 0 8px" }}>
                {CATEGORY_LABELS[cat] ?? cat} · {earnedCount}/{items.length}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(82px, 1fr))", gap: 6 }}>
                {items.map((b, i) => (
                  <TrophyCell key={b.id} badge={b} tier={tierForRank(i, items.length)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
