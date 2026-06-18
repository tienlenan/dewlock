"use client";

/**
 * LevelCard — the wallet's XP level, band title, and progress to the next level,
 * plus earned/total badge count. Level/XP come from the receipt-derived profile
 * (/api/user-stats). Pure presentation — design tokens only.
 */

import type { LevelDto } from "./types";

export function LevelCard({
  level,
  earnedBadges,
  totalBadges,
}: {
  level: LevelDto;
  earnedBadges: number;
  totalBadges: number;
}) {
  // Progress within the current level (0–100). Null xpForNext = max level.
  const span = level.xpForNext != null ? level.xpIntoLevel + level.xpForNext : level.xpIntoLevel;
  const pct = level.xpForNext == null ? 100 : span > 0 ? Math.round((level.xpIntoLevel / span) * 100) : 0;

  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
        {/* Level badge */}
        <div
          style={{
            flexShrink: 0,
            width: 54,
            height: 54,
            borderRadius: 14,
            background: "var(--accent-soft)",
            border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span className="split-mono" style={{ fontSize: 8, letterSpacing: "0.1em", color: "var(--accent-ink)" }}>LVL</span>
          <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: "var(--accent-ink)" }}>{level.level}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>{level.title}</span>
            <span className="split-mono" style={{ fontSize: 10, color: "var(--fg-muted)" }}>
              {earnedBadges}/{totalBadges} badges
            </span>
          </div>

          {/* XP progress bar */}
          <div style={{ height: 7, borderRadius: 99, background: "var(--bg-sub)", overflow: "hidden", marginTop: 8 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s ease" }} />
          </div>
          <div className="split-mono" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginTop: 4 }}>
            {level.xp.toLocaleString()} XP
            {level.xpForNext != null ? ` · ${level.xpForNext.toLocaleString()} to level ${level.level + 1}` : " · max level"}
          </div>
        </div>
      </div>
    </div>
  );
}
