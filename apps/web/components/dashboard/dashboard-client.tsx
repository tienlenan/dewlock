"use client";

/**
 * DashboardClient — the per-wallet dashboard surface.
 *
 * Reads the connected wallet (dapp-kit), fetches GET /api/user-stats, and renders
 * the user's Dewlock activity + reward badges. The protocol-wide section is a
 * placeholder here and is filled by the protocol metrics work (Phase 5).
 *
 * No keys, no signing — purely a read-only view. Honest states throughout:
 * disconnected → connect prompt; load failure → error; empty → newbie state.
 */

import { useEffect, useState } from "react";
import { useCurrentAccount, ConnectButton } from "@mysten/dapp-kit";
import { UserStatsCard } from "./user-stats-card";
import { BadgeGrid } from "./badge-grid";
import { DailyCapAndReceipts } from "./daily-cap-and-receipts";
import { ProtocolMetricsSection } from "./protocol-metrics-section";
import type { UserStatsApiResponse } from "./types";

function useUserStats(wallet: string | undefined) {
  const [data, setData] = useState<UserStatsApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    setData(null);
    setError(null);
    fetch(`/api/user-stats?wallet=${encodeURIComponent(wallet)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: UserStatsApiResponse) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [wallet]);

  return { data, error };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-muted)", marginBottom: 12 }}>
      {children}
    </div>
  );
}

export function DashboardClient() {
  const account = useCurrentAccount();
  const wallet = account?.address;
  const { data, error } = useUserStats(wallet);

  return (
    <div className="flex flex-col" style={{ gap: 36 }}>
      {/* User section — connect prompt when disconnected */}
      <section>
        <SectionLabel>your activity</SectionLabel>
        {!wallet ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
            <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: 0, lineHeight: 1.55 }}>
              Connect your wallet to see your activity, volume, and the reward badges you’ve earned through Dewlock.
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {error && (
              <div style={{ maxWidth: 440, padding: 20, textAlign: "center", color: "var(--destructive)", fontSize: 13 }}>
                Couldn’t load your dashboard ({error}).
              </div>
            )}
            {!data && !error && (
              <div className="split-mono" style={{ maxWidth: 440, padding: 24, textAlign: "center", color: "var(--fg-faint)", fontSize: 11, letterSpacing: "0.1em" }}>
                loading your activity…
              </div>
            )}
            {data && (
              <>
                <UserStatsCard stats={data.stats} wallet={data.wallet} memoryEnabled={data.memoryEnabled} />
                <DailyCapAndReceipts dailyUsage={data.dailyUsage} receipts={data.recentReceipts} />
                <BadgeGrid earned={data.badges.earned} locked={data.badges.locked} />
              </>
            )}
          </div>
        )}
      </section>

      {/* Protocol-wide section — always visible (not wallet-scoped) */}
      <section>
        <SectionLabel>protocol-wide</SectionLabel>
        <ProtocolMetricsSection />
      </section>
    </div>
  );
}
