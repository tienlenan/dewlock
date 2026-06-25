"use client";

/**
 * HistoryFeedCard — reverse-chronological feed of the wallet's approved and
 * Guardian-blocked actions, built from the immutable receipt log.
 *
 * WHY no P&L column: the receipt schema stores no entry-USD baseline and there
 * is no historical price oracle. usdValue shown is the Guardian-computed amount
 * at action time (from the action log line), clearly labeled "recorded value" —
 * never profit/loss, never a fabricated delta.
 *
 * Visual tokens mirror ecosystem-card-shell.tsx and lend-options-card.tsx.
 */

import { ShieldCheck, ShieldX, ExternalLink, Clock } from "lucide-react";

// ---------------------------------------------------------------------------
// Data shape (mirrors getHistory outputSchema)
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  timestamp: string;
  actionLabel: string;
  txDigest: string;
  usdValue: number;
  verdict: "approved" | "blocked";
  blockReasons?: string[];
  explorerUrl?: string;
}

export interface HistoryFeedData {
  walletAddress: string;
  feed: HistoryEntry[];
  totalApproved: number;
  totalBlocked: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Single history row
// ---------------------------------------------------------------------------

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const isApproved = entry.verdict === "approved";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "11px 16px",
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* Verdict icon */}
      <div style={{ paddingTop: 2, flexShrink: 0 }}>
        {isApproved ? (
          <ShieldCheck
            size={15}
            style={{ color: "var(--success)" }}
            aria-label="Approved"
          />
        ) : (
          <ShieldX
            size={15}
            style={{ color: "var(--destructive)" }}
            aria-label="Blocked"
          />
        )}
      </div>

      {/* Action label + block reasons */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--fg)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.actionLabel}
        </div>
        {!isApproved && entry.blockReasons && entry.blockReasons.length > 0 && (
          <div
            style={{
              fontSize: 10.5,
              color: "var(--destructive)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.blockReasons.join(", ")}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: 3,
          }}
        >
          <Clock size={10} style={{ color: "var(--fg-faint)", flexShrink: 0 }} aria-hidden />
          <span style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>
            {relativeTime(entry.timestamp)}
          </span>
        </div>
      </div>

      {/* USD value + explorer link */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          className="mono"
          style={{
            fontSize: 13,
            fontWeight: 650,
            color: isApproved ? "var(--fg)" : "var(--fg-muted)",
          }}
        >
          {fmtUsd(entry.usdValue)}
        </div>
        <div
          className="split-mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.08em",
            color: isApproved ? "var(--success)" : "var(--destructive)",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          {isApproved ? "approved" : "blocked"}
        </div>
        {isApproved && entry.explorerUrl && (
          <a
            href={entry.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View on Sui explorer"
            style={{ display: "inline-flex", alignItems: "center", marginTop: 3 }}
          >
            <ExternalLink
              size={10}
              style={{ color: "var(--fg-faint)" }}
              aria-label="View transaction on explorer"
            />
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function SkeletonRows({ n }: { n: number }) {
  return (
    <div>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            style={{ width: 15, height: 15, borderRadius: 999, background: "var(--bg-sub)", flexShrink: 0 }}
          />
          <div style={{ flex: 1, height: 11, borderRadius: 4, background: "var(--bg-sub)" }} />
          <div style={{ width: 52, height: 11, borderRadius: 4, background: "var(--bg-sub)" }} />
        </div>
      ))}
    </div>
  );
}

export function HistoryFeedCard({
  data,
  loading = false,
}: {
  data?: HistoryFeedData;
  loading?: boolean;
}) {
  return (
    <div
      className="w-full overflow-hidden"
      style={{
        maxWidth: 520,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "13px 16px 11px",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
          Action history
        </div>
        {data && (
          <span
            className="split-mono"
            style={{ fontSize: 10, color: "var(--fg-muted)", letterSpacing: "0.06em" }}
          >
            {data.totalApproved} approved · {data.totalBlocked} blocked
          </span>
        )}
      </div>

      {/* Rows */}
      {loading && <SkeletonRows n={4} />}

      {!loading && data && data.feed.length === 0 && (
        <div
          style={{
            padding: "18px 16px",
            borderTop: "1px solid var(--border)",
            color: "var(--fg-muted)",
            fontSize: 13,
          }}
        >
          No recorded actions yet.
        </div>
      )}

      {!loading && data && data.feed.map((entry, i) => (
        <HistoryRow key={`${entry.txDigest}-${i}`} entry={entry} />
      ))}

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "8px 16px",
        }}
      >
        <p
          className="split-mono"
          style={{
            fontSize: 9.5,
            color: "var(--fg-faint)",
            margin: 0,
            letterSpacing: "0.04em",
          }}
        >
          USD values recorded at action time · not profit/loss · from immutable receipt log.
        </p>
      </div>
    </div>
  );
}
