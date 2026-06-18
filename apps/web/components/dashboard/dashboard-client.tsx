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

import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { RotateCw } from "lucide-react";
import { emitDashboardReload } from "@/lib/tx-events";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { UserStatsCard } from "./user-stats-card";
import { BadgeGrid } from "./badge-grid";
import { DailyCapAndReceipts } from "./daily-cap-and-receipts";
import { ProtocolMetricsSection } from "./protocol-metrics-section";
import { PassportCard } from "./passport-card";
import { FriendListCard } from "./friend-list-card";
import { StatsCardSkeleton, BadgeGridSkeleton, ReceiptsSkeleton } from "./dashboard-skeletons";
import { useUserStats } from "@/lib/dashboard/use-dashboard-data";
import type { ContactsApi } from "@/lib/contacts/use-contacts";

/** Section header: a label with an optional right-aligned action (e.g. Reload). */
function SectionHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 12, gap: 12 }}>
      <span className="split-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-muted)" }}>
        {label}
      </span>
      {action}
    </div>
  );
}

/** Reload button — emits a hard-reload event that every dashboard card refetches on. */
function ReloadButton() {
  const [spinning, setSpinning] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { emitDashboardReload(); setSpinning(true); setTimeout(() => setSpinning(false), 800); }}
      aria-label="Reload data"
      title="Reload data"
      className="flex items-center transition-colors"
      style={{ gap: 5, border: "1px solid var(--border)", borderRadius: 99, padding: "4px 11px", background: "var(--bg-elev)", color: "var(--fg-muted)", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
    >
      <RotateCw size={12} aria-hidden style={{ animation: spinning ? "dashSpin 0.8s linear" : "none" }} />
      Reload
    </button>
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
      <SectionHeader label="your activity" action={wallet ? <ReloadButton /> : undefined} />
      {!wallet ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
          <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: 0, lineHeight: 1.55 }}>
            Connect your wallet to see your activity, volume, and the reward badges you’ve earned through Dewlock.
          </p>
          <ConnectWalletButton label="Connect Wallet" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* On-chain passport — self-fetches; the user's shareable identity. Spans the top. */}
          <PassportCard />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Left column — stats, friends, spend (level/badges live on the passport above) */}
            <div className="flex flex-col gap-5">
              {/* Activity stats — one fetch, its own skeleton/error */}
              {statsFailed ? (
                <ErrorRetry message={stats.error!} onRetry={stats.retry} />
              ) : statsReady ? (
                <UserStatsCard stats={stats.data!.stats} wallet={stats.data!.wallet} memoryEnabled={stats.data!.memoryEnabled} />
              ) : (
                <StatsCardSkeleton />
              )}

              {/* Friends — self-fetches via useContacts (independent) */}
              {contactsApi && onManageContacts && (
                <FriendListCard api={contactsApi} onManage={onManageContacts} />
              )}

              {/* Receipts + daily cap — from the same activity recall (own skeleton) */}
              {statsReady ? (
                <DailyCapAndReceipts dailyUsage={stats.data!.dailyUsage} receipts={stats.data!.recentReceipts} />
              ) : !statsFailed ? (
                <ReceiptsSkeleton />
              ) : null}
            </div>

            {/* Right column — reward badges (shares the activity fetch) */}
            <div className="flex flex-col gap-5">
              {statsReady ? (
                <BadgeGrid earned={stats.data!.badges.earned} locked={stats.data!.badges.locked} />
              ) : (
                <BadgeGridSkeleton />
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
    <section className="flex flex-col w-full" style={{ gap: 0, maxWidth: 560 }}>
      <SectionHeader label="protocol-wide · network" action={<ReloadButton />} />
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
