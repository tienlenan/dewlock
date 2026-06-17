"use client";

/**
 * BadgeGrid — earned vs locked reward badges, derived from the immutable receipt
 * log (source of truth). Earned badges are accent-tinted; locked ones are dimmed
 * with their unlock blurb so the user sees what's next. Pure presentation.
 */

import type { BadgeStateDto } from "./types";

function BadgeChip({ badge }: { badge: BadgeStateDto }) {
  const earned = badge.earned;
  return (
    <div
      title={badge.blurb}
      style={{
        border: `1px solid ${earned ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--border)"}`,
        background: earned ? "var(--accent-soft)" : "var(--bg-sub)",
        borderRadius: 12,
        padding: "12px 14px",
        opacity: earned ? 1 : 0.62,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: 13, fontWeight: 700, color: earned ? "var(--accent-ink)" : "var(--fg-muted)" }}>
          {badge.name}
        </span>
        <span
          className="split-mono"
          style={{ fontSize: 9, letterSpacing: "0.1em", color: earned ? "var(--success)" : "var(--fg-faint)" }}
        >
          {earned ? "earned" : "locked"}
        </span>
      </div>
      <span style={{ fontSize: 11, color: earned ? "var(--fg-muted)" : "var(--fg-faint)", lineHeight: 1.4 }}>
        {badge.blurb}
      </span>
    </div>
  );
}

export function BadgeGrid({
  earned,
  locked,
}: {
  earned: BadgeStateDto[];
  locked: BadgeStateDto[];
}) {
  const all = [...earned, ...locked];
  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex items-center justify-between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Badges</span>
        <span className="split-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--fg-muted)" }}>
          {earned.length}/{all.length} earned
        </span>
      </div>
      <div
        style={{
          padding: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        {all.map((b) => (
          <BadgeChip key={b.id} badge={b} />
        ))}
      </div>
    </div>
  );
}
