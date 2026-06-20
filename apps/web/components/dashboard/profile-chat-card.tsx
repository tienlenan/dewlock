"use client";

/**
 * ProfileChatCard — the gamification profile rendered in chat. Self-fetches
 * /api/user-stats for the connected wallet (the durable, monotonic level/badges)
 * — like the protocol-metrics card self-fetches /api/metrics — so "show my level"
 * in chat shows the REAL profile, not the empty derive the agent tool would pass.
 */

import { useEffect, useState, useCallback } from "react";
import { LevelCard } from "./level-card";
import { UserStatsCard } from "./user-stats-card";
import { BadgeGrid } from "./badge-grid";
import type { UserStatsApiResponse } from "./types";
import { fetchJsonWithRetry } from "@/lib/fetch-with-retry";

export function ProfileChatCard({ walletAddress }: { walletAddress?: string }) {
  const [data, setData] = useState<UserStatsApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped to re-run the fetch on manual Retry after auto-retries are exhausted.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    const ctrl = new AbortController();
    setError(null);
    setData(null);
    // Auto-retry up to 3× with a per-attempt timeout: /api/user-stats has a cold path
    // (serverless + memwal/BlockVision warm-up) that can exceed 10s on the first call
    // while a warm retry returns fast — so retry transparently instead of erroring.
    fetchJsonWithRetry<UserStatsApiResponse>(
      `/api/user-stats?wallet=${encodeURIComponent(walletAddress)}`,
      { attempts: 3, timeoutMs: 10_000, signal: ctrl.signal },
    )
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        // Swallow the unmount-cancel; only a genuine all-attempts failure shows the Retry UI.
        if (!cancelled && !ctrl.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      });
    return () => { cancelled = true; ctrl.abort(); };
  }, [walletAddress, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  if (!walletAddress) {
    return <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Connect your wallet to see your level and badges.</div>;
  }
  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--destructive)" }}>
        <span>Couldn’t load your profile.</span>
        <button
          type="button"
          onClick={retry}
          className="split-mono transition-colors"
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            color: "var(--fg-muted)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "3px 10px",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)"; }}
        >
          Retry
        </button>
      </div>
    );
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
