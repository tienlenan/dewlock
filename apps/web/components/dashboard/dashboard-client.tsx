"use client";

/**
 * DashboardClient — the per-wallet dashboard surface.
 *
 * Cards load INDEPENDENTLY: the passport + friends self-fetch, the activity cards
 * (level/stats/badges) share one fetch, and the receipts/daily-cap card fetches on its
 * own — so one slow (~10-15s, variable) memwal recall never blocks the whole dashboard.
 * Each card shows its own skeleton and resolves when its data arrives.
 *
 * No keys, no signing — purely a read-only view. Honest states throughout:
 * disconnected → connect prompt; load failure → per-group retry; empty → newbie state.
 */

import { useCurrentAccount, ConnectButton } from "@mysten/dapp-kit";
import { UserStatsCard } from "./user-stats-card";
import { LevelCard } from "./level-card";
import { BadgeGrid } from "./badge-grid";
import { DailyCapAndReceipts } from "./daily-cap-and-receipts";
import { ProtocolMetricsSection } from "./protocol-metrics-section";
import { PassportCard } from "./passport-card";
import { FriendListCard } from "./friend-list-card";
import { useUserStats } from "@/lib/dashboard/use-dashboard-data";
import type { ContactsApi } from "@/lib/contacts/use-contacts";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-muted)", marginBottom: 12 }}>
      {children}
    </div>
  );
}

/** A shimmering placeholder block — w-full up to maxWidth, matching the real cards. */
function SkeletonBlock({ height, maxWidth = 440 }: { height: number; maxWidth?: number }) {
  return (
    <div
      aria-hidden
      className="w-full"
      role="status"
      aria-label="Loading"
      style={{
        maxWidth,
        height,
        borderRadius: 14,
        background: "linear-gradient(90deg, var(--bg-sub) 25%, var(--border) 50%, var(--bg-sub) 75%)",
        backgroundSize: "200% 100%",
        animation: "dashShimmer 1.6s ease-in-out infinite",
      }}
    />
  );
}

/** Small inline error + retry for a card group whose independent fetch failed. */
function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="w-full" style={{ maxWidth: 440, padding: 16, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", color: "var(--fg-muted)", fontSize: 13 }}>
      <span>Couldn’t load — {message}</span>
      <button
        type="button"
        onClick={onRetry}
        style={{ border: "1px solid var(--border)", borderRadius: 99, padding: "5px 14px", background: "var(--bg-sub)", color: "var(--fg)", fontSize: 12.5, cursor: "pointer" }}
      >
        Retry
      </button>
    </div>
  );
}

/**
 * My Dashboard — per-wallet activity in a balanced two-column layout, each card loading
 * independently. Left column: level, stats, friends, spend. Right column: reward badges.
 * Single column on mobile. `contactsApi` + `onManageContacts` come from the app shell so
 * the friend card shares the dialog's single write path.
 */
export function UserDashboard({
  contactsApi,
  onManageContacts,
}: {
  contactsApi?: ContactsApi;
  onManageContacts?: () => void;
} = {}) {
  const account = useCurrentAccount();
  const wallet = account?.address;
  const stats = useUserStats(wallet);

  const statsReady = !!stats.data;
  const statsFailed = !!stats.error && !stats.data;

  return (
    <section className="flex flex-col w-full" style={{ gap: 0, maxWidth: 980 }}>
      <style>{`@keyframes dashShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
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
          {/* On-chain passport — self-fetches; the user's shareable identity. Spans the top. */}
          <PassportCard />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Left column — everything except badges (level, stats, friends, spend) */}
            <div className="flex flex-col gap-5">
              {/* Activity (level + stats) — one fetch, its own skeleton/error */}
              {statsFailed ? (
                <ErrorRetry message={stats.error!} onRetry={stats.retry} />
              ) : (
                <>
                  {statsReady && stats.data!.level ? (
                    <LevelCard
                      level={stats.data!.level}
                      earnedBadges={stats.data!.badges.earned.length}
                      totalBadges={stats.data!.badges.earned.length + stats.data!.badges.locked.length}
                    />
                  ) : (
                    <SkeletonBlock height={86} />
                  )}
                  {statsReady ? (
                    <UserStatsCard stats={stats.data!.stats} wallet={stats.data!.wallet} memoryEnabled={stats.data!.memoryEnabled} />
                  ) : (
                    <SkeletonBlock height={150} />
                  )}
                </>
              )}

              {/* Friends — self-fetches via useContacts (independent) */}
              {contactsApi && onManageContacts && (
                <FriendListCard api={contactsApi} onManage={onManageContacts} />
              )}

              {/* Receipts + daily cap — from the same activity recall (own skeleton) */}
              {statsReady ? (
                <DailyCapAndReceipts dailyUsage={stats.data!.dailyUsage} receipts={stats.data!.recentReceipts} />
              ) : !statsFailed ? (
                <SkeletonBlock height={200} />
              ) : null}
            </div>

            {/* Right column — reward badges (shares the activity fetch) */}
            <div className="flex flex-col gap-5">
              {statsReady ? (
                <BadgeGrid earned={stats.data!.badges.earned} locked={stats.data!.badges.locked} />
              ) : (
                <SkeletonBlock height={220} />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Network Dashboard — system-wide protocol registry + live TVL (not wallet-scoped). */
export function NetworkDashboard() {
  return (
    <section className="flex flex-col" style={{ gap: 0 }}>
      <SectionLabel>protocol-wide · network</SectionLabel>
      <ProtocolMetricsSection />
    </section>
  );
}

/** Back-compat: the original combined dashboard (both sections stacked). */
export function DashboardClient() {
  return (
    <div className="flex flex-col" style={{ gap: 36 }}>
      <UserDashboard />
      <NetworkDashboard />
    </div>
  );
}
