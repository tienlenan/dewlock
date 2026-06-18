"use client";

/**
 * Loading skeletons that MIRROR the real dashboard cards (not blank rectangles) — same
 * card chrome, same internal layout, so there's no reflow when data arrives. Each mirrors
 * its sibling component: LevelCard, UserStatsCard, BadgeGrid, DailyCapAndReceipts,
 * FriendListCard. Animation = the global `dashShimmer` keyframe (globals.css).
 */

/** A single shimmering placeholder shape. */
function Shimmer({ w = "100%", h, r = 6, style }: { w?: number | string; h: number; r?: number; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "linear-gradient(90deg, var(--bg-sub) 25%, var(--border) 50%, var(--bg-sub) 75%)",
        backgroundSize: "200% 100%",
        animation: "dashShimmer 1.6s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

function CardShell({ children, maxWidth = 440 }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <div className="w-full overflow-hidden" role="status" aria-label="Loading" style={{ maxWidth, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}>
      {children}
    </div>
  );
}

/** Mirrors LevelCard: 54px level badge + title/bar/xp column. */
export function LevelCardSkeleton() {
  return (
    <CardShell>
      <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <Shimmer w={54} h={54} r={14} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
          <div className="flex items-center justify-between">
            <Shimmer w={120} h={14} />
            <Shimmer w={56} h={10} />
          </div>
          <Shimmer h={7} r={99} />
          <Shimmer w={140} h={9} />
        </div>
      </div>
    </CardShell>
  );
}

/** Mirrors UserStatsCard: header + 3 stat tiles + chip row. */
export function StatsCardSkeleton() {
  return (
    <CardShell>
      <div className="flex items-center justify-between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <Shimmer w={140} h={13} />
        <Shimmer w={64} h={9} />
      </div>
      <div style={{ padding: 16 }}>
        <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ flex: 1, minWidth: 96, display: "grid", gap: 6 }}>
              <Shimmer w={56} h={22} />
              <Shimmer w={72} h={9} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 14 }}>
          {[64, 52, 70].map((w, i) => <Shimmer key={i} w={w} h={18} r={99} />)}
        </div>
      </div>
    </CardShell>
  );
}

/** Mirrors DailyCapAndReceipts: cap bar + "recent receipts" + rows. */
export function ReceiptsSkeleton() {
  return (
    <CardShell>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "grid", gap: 8 }}>
        <div className="flex items-center justify-between">
          <Shimmer w={92} h={9} />
          <Shimmer w={88} h={12} />
        </div>
        <Shimmer h={6} r={99} />
      </div>
      <div style={{ padding: "13px 16px", display: "grid", gap: 10 }}>
        <Shimmer w={84} h={9} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 4 }}>
              <Shimmer w="60%" h={12} />
              <Shimmer w="40%" h={9} />
            </div>
            <Shimmer w={44} h={12} />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/** Mirrors BadgeGrid: header line + a grid of medallion placeholders. */
export function BadgeGridSkeleton() {
  return (
    <div className="w-full" role="status" aria-label="Loading" style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)", padding: 16, display: "grid", gap: 14 }}>
      <Shimmer w={120} h={12} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Shimmer w={46} h={46} r={12} />
            <Shimmer w={36} h={8} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors MetricsTotals (network): header + 5 headline metric cells (560px wide). */
export function MetricsTotalsSkeleton() {
  return (
    <CardShell maxWidth={560}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <Shimmer w={110} h={13} />
      </div>
      <div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ flex: 1, minWidth: 110, display: "grid", gap: 5 }}>
            <Shimmer w={64} h={20} />
            <Shimmer w={84} h={9} />
            <Shimmer w={70} h={8} />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/** Mirrors ProtocolMetricsTable (network): header + per-protocol rows (560px wide). */
export function ProtocolMetricsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <CardShell maxWidth={560}>
      <div className="flex items-center justify-between" style={{ padding: "13px 16px" }}>
        <Shimmer w={140} h={13} />
        <Shimmer w={120} h={9} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ padding: "11px 16px", borderTop: "1px solid var(--border)" }}>
          <div className="flex-1 min-w-0" style={{ display: "grid", gap: 5 }}>
            <Shimmer w="50%" h={13} />
            <Shimmer w={72} h={9} />
          </div>
          <Shimmer w={56} h={13} />
        </div>
      ))}
    </CardShell>
  );
}

/** Full network section skeleton — totals card + protocol table. */
export function NetworkSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading protocol metrics" style={{ maxWidth: 560, width: "100%" }}>
      <MetricsTotalsSkeleton />
      <ProtocolMetricsTableSkeleton />
    </div>
  );
}

/** Mirrors the friend list rows (name + address). Used in the card + dialog. */
export function FriendListRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading friends" style={{ display: "grid", gap: 7 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between" style={{ gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 4 }}>
            <Shimmer w="45%" h={12} />
            <Shimmer w="80%" h={9} />
          </div>
          <Shimmer w={28} h={12} />
        </div>
      ))}
    </div>
  );
}
