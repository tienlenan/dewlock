"use client";

/**
 * UserStatsCard — per-wallet activity summary.
 *
 * Two clearly-separated panels:
 *  - Dewlock activity (from the immutable receipt log): tx count, volume, and a
 *    per-action breakdown. The source of truth for badges.
 *  - On-chain footprint (from BlockVision, optional): portfolio USD + total
 *    on-chain tx count. Shown as "unavailable" when degraded — never fabricated.
 */

import type { UserStatsData, WalletOverviewDto } from "./types";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 96 }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--fg)" }}>{value}</div>
      <div className="split-mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--fg-muted)", marginTop: 2 }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

const ACTION_LABELS: Record<keyof UserStatsData["actions"], string> = {
  transfer: "transfers",
  swap: "swaps",
  lend: "lend",
  bridge: "bridges",
  limit: "limit orders",
};

function usd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function UserStatsCard({
  stats,
  wallet,
  memoryEnabled,
}: {
  stats: UserStatsData;
  wallet?: WalletOverviewDto;
  memoryEnabled?: boolean;
}) {
  const activeActions = (Object.keys(stats.actions) as Array<keyof UserStatsData["actions"]>).filter(
    (k) => stats.actions[k] > 0,
  );

  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex items-center justify-between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Your Dewlock activity</span>
        <span className="split-mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--fg-faint)" }}>
          from receipts
        </span>
      </div>

      <div style={{ padding: 16 }}>
        <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
          <Stat label="transactions" value={String(stats.txCount)} />
          <Stat label="volume" value={usd(stats.volumeUsd)} />
          <Stat label="action types" value={String(stats.distinctActions)} />
        </div>

        {activeActions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 14 }}>
            {activeActions.map((k) => (
              <span
                key={k}
                className="split-mono"
                style={{ fontSize: 10, color: "var(--fg-muted)", background: "var(--bg-sub)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 99 }}
              >
                {stats.actions[k]} {ACTION_LABELS[k]}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 11.5, color: "var(--fg-faint)", margin: "12px 0 0", lineHeight: 1.45 }}>
            {memoryEnabled === false
              ? "No receipts yet (memory off in this environment). Your first sealed transaction earns the Newbie badge."
              : "No transactions yet. Your first sealed transaction earns the Newbie badge."}
          </p>
        )}
      </div>

      {/* On-chain footprint (BlockVision) — optional, fail-soft */}
      {wallet && (
        <div style={{ padding: "13px 16px", borderTop: "1px solid var(--border)" }}>
          <div className="split-mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--fg-muted)", marginBottom: 8 }}>
            on-chain footprint · blockvision
          </div>
          {wallet.degraded && wallet.totalUsdValue == null ? (
            <p style={{ fontSize: 11.5, color: "var(--fg-faint)", margin: 0, lineHeight: 1.45 }}>
              On-chain data unavailable right now.
            </p>
          ) : (
            <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
              <Stat
                label="portfolio"
                value={wallet.totalUsdValue != null ? usd(wallet.totalUsdValue) : "—"}
                sub={`${wallet.coins.length} assets`}
              />
              <Stat
                label="on-chain txs"
                value={wallet.onchainTxCount != null ? wallet.onchainTxCount.toLocaleString() : "—"}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
