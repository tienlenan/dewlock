"use client";

/**
 * ProfileChatCard — the gamification profile rendered in chat. Self-fetches
 * /api/user-stats for the connected wallet (the durable, monotonic level/badges)
 * — like the protocol-metrics card self-fetches /api/metrics — so "show my level"
 * in chat shows the REAL profile, not the empty derive the agent tool would pass.
 */

import { useEffect, useState } from "react";
import { LevelCard } from "./level-card";
import { UserStatsCard } from "./user-stats-card";
import { BadgeGrid } from "./badge-grid";
import type { UserStatsApiResponse } from "./types";

export function ProfileChatCard({ walletAddress }: { walletAddress?: string }) {
  const [data, setData] = useState<UserStatsApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    fetch(`/api/user-stats?wallet=${encodeURIComponent(walletAddress)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: UserStatsApiResponse) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer); };
  }, [walletAddress]);

  if (!walletAddress) {
    return <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Connect your wallet to see your level and badges.</div>;
  }
  if (error) {
    return <div style={{ fontSize: 13, color: "var(--destructive)" }}>Couldn’t load your profile ({error}).</div>;
  }
  if (!data) {
    return <div className="split-mono" style={{ fontSize: 11, color: "var(--fg-faint)", letterSpacing: "0.1em" }}>loading your profile…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.level && (
        <LevelCard
          level={data.level}
          earnedBadges={data.badges.earned.length}
          totalBadges={data.badges.earned.length + data.badges.locked.length}
        />
      )}
      <UserStatsCard stats={data.stats} wallet={data.wallet} memoryEnabled={data.memoryEnabled} />
      <BadgeGrid earned={data.badges.earned} locked={data.badges.locked} />
    </div>
  );
}
