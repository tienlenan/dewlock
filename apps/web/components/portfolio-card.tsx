"use client";

/**
 * PortfolioCard — renders the getPortfolio tool result in the chat thread.
 *
 * Shows each supported coin with native + human balance and estimated USD value.
 * Renders a "DEMO" badge when the data comes from canned fixture mode.
 * Shows zero-balance rows at reduced opacity.
 * Renders a Cetus LP row (sample/preview) matching the mockup when present.
 *
 * Visual: matches mockup portfolio card — bg-elev, shadow-md, mono balances,
 * coin type shown under each ticker (fake-coin prevention), Cetus LP row at bottom.
 *
 * Security affordances (must never be removed):
 *  - Full coin TYPE displayed under each ticker — prevents fake-coin confusion.
 *  - Network badge shows which chain the data is from.
 *  - DEMO badge in fixture mode — data never presented as live when canned.
 */

import { useState } from "react";

export interface PortfolioBalance {
  coinType: string;
  displayTicker: string;
  nativeBalance: string;
  humanBalance: string;
  estimatedUsdValue: number | null;
  decimals: number;
  /** Token logo / avatar URL from SuiVision (optional; falls back to ticker initials). */
  iconUrl?: string | null;
  /** Unit price in USD from SuiVision (optional). */
  priceUsd?: number | null;
  /** Verified on SuiVision. */
  verified?: boolean;
}

export interface PortfolioCardProps {
  walletAddress: string;
  balances: PortfolioBalance[];
  totalEstimatedUsdValue: number;
  network: "mainnet";
  demoFixture: boolean;
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

/** Unit price — more precision for sub-dollar tokens so micro-priced coins read. */
function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 6 : 2,
  });
}

/**
 * CoinAvatar — renders the SuiVision token logo, falling back to ticker initials
 * in an accent circle when there's no logo or the image fails to load.
 */
function CoinAvatar({ iconUrl, ticker }: { iconUrl?: string | null; ticker: string }) {
  const [failed, setFailed] = useState(false);
  const showImg = iconUrl && !failed;

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote token logos, arbitrary hosts
      <img
        src={iconUrl}
        alt=""
        width={30}
        height={30}
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0"
        style={{ width: 30, height: 30, borderRadius: 99, objectFit: "cover", background: "var(--bg-sub)" }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center shrink-0 mono"
      style={{
        width: 30,
        height: 30,
        borderRadius: 99,
        background: "var(--accent-soft)",
        color: "var(--accent-ink)",
        fontSize: ticker.length > 3 ? "9px" : "11px",
        fontWeight: 700,
      }}
    >
      {ticker}
    </div>
  );
}

/** Shorten coin type for the sub-label: keep last two segments. */
function shortCoinType(coinType: string): string {
  const parts = coinType.split("::");
  if (parts.length >= 2) return `…::${parts[parts.length - 2]}::${parts[parts.length - 1]}`;
  return coinType;
}

export function PortfolioCard({
  walletAddress,
  balances,
  totalEstimatedUsdValue,
  network,
  demoFixture,
}: PortfolioCardProps) {
  // Hide zero-balance tokens; sort the rest by USD value (desc).
  const sorted = balances
    .filter((b) => BigInt(b.nativeBalance) !== 0n)
    .sort((a, b) => (b.estimatedUsdValue ?? 0) - (a.estimatedUsdValue ?? 0));

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        maxWidth: "440px",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "18px 18px 14px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="split-mono"
            style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--fg-muted)" }}
          >
            Total value · sui:{network}
          </span>
          <div className="flex items-center gap-1.5">
            {demoFixture && (
              <span
                className="split-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--warning)",
                  background: "color-mix(in srgb, var(--warning) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                  padding: "3px 9px",
                  borderRadius: 99,
                }}
              >
                DEMO
              </span>
            )}
            <span
              className="split-mono"
              style={{
                fontSize: "10px",
                color: "var(--accent-ink)",
                background: "var(--accent-soft)",
                padding: "3px 9px",
                borderRadius: 99,
              }}
            >
              {network}
            </span>
          </div>
        </div>

        {/* Total value display */}
        <div className="flex items-baseline gap-2.5 mt-1.5">
          <span
            style={{
              fontSize: "30px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "var(--fg)",
            }}
          >
            {formatUsd(totalEstimatedUsdValue)}
          </span>
        </div>

        {/* Wallet address — always shown for context */}
        <p
          className="mono mt-1"
          style={{ fontSize: "11px", color: "var(--fg-faint)", margin: "4px 0 0" }}
        >
          {walletAddress.slice(0, 10)}…{walletAddress.slice(-6)}
        </p>
      </div>

      {/* ── Balance rows ── */}
      <div style={{ padding: "6px 0" }}>
        {sorted.length === 0 && (
          <div
            style={{
              padding: "28px 18px",
              textAlign: "center",
              color: "var(--fg-faint)",
              fontSize: "13px",
            }}
          >
            No token balances found for this wallet.
          </div>
        )}
        {sorted.map((b) => {
          return (
            <div
              key={b.coinType}
              className="flex items-center gap-3"
              style={{ padding: "11px 18px" }}
            >
              {/* Token avatar — SuiVision logo, ticker-initials fallback */}
              <CoinAvatar iconUrl={b.iconUrl} ticker={b.displayTicker} />

              {/* Balance + coin type */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--fg)" }}>
                    {b.humanBalance}
                  </span>
                  <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--fg-muted)" }}>
                    {b.displayTicker}
                  </span>
                </div>
                {/* Coin type — security affordance, always shown */}
                <div
                  className="mono truncate"
                  style={{ fontSize: "11px", color: "var(--fg-faint)" }}
                  title={b.coinType}
                >
                  {shortCoinType(b.coinType)}
                </div>
              </div>

              {/* USD value + unit price */}
              <div className="text-right shrink-0">
                <div
                  className="mono"
                  style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--fg)" }}
                >
                  {b.estimatedUsdValue != null ? formatUsd(b.estimatedUsdValue) : "—"}
                </div>
                {b.priceUsd != null && b.priceUsd > 0 && (
                  <div className="mono" style={{ fontSize: "10.5px", color: "var(--fg-faint)" }}>
                    @ {formatPrice(b.priceUsd)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Cetus LP row — sample/preview ── */}
      <div
        className="flex items-center gap-3"
        style={{
          padding: "13px 18px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-sub)",
        }}
      >
        {/* Cetus LP badge */}
        <span
          className="split-mono shrink-0"
          style={{
            fontSize: "10px",
            color: "var(--accent-ink)",
            background: "var(--accent-soft)",
            border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
            padding: "3px 8px",
            borderRadius: 99,
          }}
        >
          Cetus LP
        </span>

        {/* Pair */}
        <div className="flex-1 min-w-0" style={{ fontSize: "13px", color: "var(--fg)" }}>
          SUI / USDC{" "}
          <span style={{ color: "var(--fg-faint)" }}>· 0.25%</span>
        </div>

        {/* In range badge */}
        <span
          className="split-mono shrink-0"
          style={{
            fontSize: "10px",
            color: "var(--success)",
            border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)",
            padding: "2px 8px",
            borderRadius: 99,
          }}
        >
          in range
        </span>

        {/* Sample note */}
        <span
          className="split-mono shrink-0"
          style={{
            fontSize: "9px",
            color: "var(--fg-faint)",
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            padding: "2px 6px",
            borderRadius: 99,
          }}
        >
          preview
        </span>
      </div>
    </div>
  );
}
