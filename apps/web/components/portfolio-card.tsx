"use client";

/**
 * PortfolioCard — renders the getPortfolio tool result in the chat thread.
 *
 * Hero: total USD value + network badge + optional DEMO badge.
 * Holdings: per-coin row with CoinLogo, balance, USD value, allocation %, unit
 * price, and swap/send quick actions. Allocation bar: inline stacked divs,
 * no chart library — the denominator is the sum of coins that have priceUsd
 * (same oracle as SuiVision, single source, no blending).
 *
 * Security affordances (must never be removed):
 *  - Full coin TYPE displayed under each ticker — prevents fake-coin confusion.
 *  - Network badge shows which chain the data is from.
 *  - DEMO badge in fixture mode — data never presented as live when canned.
 *
 * DeFi positions: NAVI/Suilend SDK reads are incompatible with @mysten/sui 2.18.
 * Rather than fabricate numbers, the section is omitted. A placeholder is
 * rendered so the UI communicates the eventual intent without inventing data.
 */

import { useRef, useState } from "react";
import { ArrowLeftRight, Send, MoreVertical } from "lucide-react";
import { CoinLogo } from "@/components/chat/asset-logos";

export interface PortfolioBalance {
  coinType: string;
  displayTicker: string;
  nativeBalance: string;
  humanBalance: string;
  estimatedUsdValue: number | null;
  decimals: number;
  /** Token logo URL from SuiVision; falls back to tinted monogram. */
  iconUrl?: string | null;
  /** Unit price in USD from SuiVision. */
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
  /** Quick row action — prefills a chat intent (e.g. "sell all SUI" / "send SUI"). */
  onAction?: (kind: "swap" | "send", ticker: string) => void;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

/**
 * Token amount for display: trims trailing zeros and caps at 3 decimals
 * (30.000000 → "30", 1.123456 → "1.123"), with thousands separators for large
 * holdings. A tiny non-zero balance falls back to 3 significant digits so it never
 * collapses to "0".
 */
function formatTokenAmount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value > 0 && value < 0.001) {
    return value.toLocaleString("en-US", { maximumSignificantDigits: 3 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

/**
 * Unit price: same trailing-zero trim as the balance ($30.00 → "$30", $1.123456 →
 * "$1.123"). Sub-$1 keeps more precision so micro-priced coins read clearly.
 */
function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 1 ? 6 : 3,
  });
}

/** Shorten coin type to last two segments for the security-affordance sub-label. */
function shortCoinType(coinType: string): string {
  const parts = coinType.split("::");
  if (parts.length >= 2) return `…::${parts[parts.length - 2]}::${parts[parts.length - 1]}`;
  return coinType;
}

// ── Allocation bar ─────────────────────────────────────────────────────────────
// Palette cycles over 5 pastel accent tints for visual distinction.
const BAR_COLORS = [
  "var(--accent)",
  "hsl(150 60% 44%)",
  "hsl(28 95% 56%)",
  "hsl(270 68% 58%)",
  "hsl(10 70% 55%)",
];

interface AllocationSlice { pct: number; color: string }

function AllocationBar({ slices }: { slices: AllocationSlice[] }) {
  return (
    <div
      style={{
        display: "flex",
        height: 5,
        borderRadius: 99,
        overflow: "hidden",
        background: "var(--bg-sub)",
        gap: 1,
      }}
      aria-hidden
    >
      {slices.map((s, i) => (
        <div
          key={i}
          style={{ flex: `0 0 ${s.pct}%`, background: s.color, borderRadius: 99 }}
        />
      ))}
    </div>
  );
}

// ── Row action button ──────────────────────────────────────────────────────────

function RowActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex items-center justify-center transition-colors"
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--bg-sub)",
        color: "var(--fg-muted)",
        cursor: "pointer",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--accent-ink)";
        (e.currentTarget as HTMLElement).style.borderColor =
          "color-mix(in srgb, var(--accent) 40%, transparent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
      }}
    >
      {children}
    </button>
  );
}

// ── Row actions: inline icons on desktop, a compact kebab context-menu on mobile ──
function RowActions({
  ticker,
  onAction,
}: {
  ticker: string;
  onAction: (kind: "swap" | "send", ticker: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Anchor the menu with fixed positioning so it escapes the card's overflow:hidden clip.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    setOpen(true);
  };

  const item = (label: string, Icon: typeof ArrowLeftRight, kind: "swap" | "send") => (
    <button
      type="button"
      role="menuitem"
      onClick={() => { onAction(kind, ticker); setOpen(false); }}
      className="flex items-center gap-2 w-full text-left transition-colors"
      style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", color: "var(--fg)", fontSize: 13, cursor: "pointer" }}
    >
      <Icon size={14} aria-hidden /> {label} {ticker}
    </button>
  );

  return (
    <>
      {/* Desktop: inline icon buttons */}
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        <RowActionButton label={`Swap ${ticker}`} onClick={() => onAction("swap", ticker)}>
          <ArrowLeftRight size={13} aria-hidden />
        </RowActionButton>
        <RowActionButton label={`Send ${ticker}`} onClick={() => onAction("send", ticker)}>
          <Send size={13} aria-hidden />
        </RowActionButton>
      </div>

      {/* Mobile: one kebab → fixed-position context menu (compact) */}
      <div className="sm:hidden shrink-0">
        <button
          ref={btnRef}
          type="button"
          aria-label={`Actions for ${ticker}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={openMenu}
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-sub)", color: "var(--fg-muted)", cursor: "pointer" }}
        >
          <MoreVertical size={15} aria-hidden />
        </button>
        {open && pos && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
            <div
              role="menu"
              style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 61, minWidth: 140, background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-md)", padding: 5 }}
            >
              {item("Swap", ArrowLeftRight, "swap")}
              {item("Send", Send, "send")}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Coin row ──────────────────────────────────────────────────────────────────

interface CoinRowProps {
  b: PortfolioBalance;
  pct: number | null;
  pctColor: string;
  onAction?: (kind: "swap" | "send", ticker: string) => void;
}

function CoinRow({ b, pct, pctColor, onAction }: CoinRowProps) {
  return (
    <div
      className="flex items-start gap-3"
      style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}
    >
      {/* Logo — uses the shared CoinLogo with tinted monogram fallback */}
      <CoinLogo symbol={b.displayTicker} logoUrl={b.iconUrl} size={34} />

      {/* Mobile: identity on top, balance/value/actions drop to a NEW line below.
          sm+ (desktop): identity on the left, numbers + actions on the right. */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        {/* Identity: ticker + full coin type security affordance */}
        <div className="min-w-0 sm:flex-1">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 13.5, fontWeight: 650, color: "var(--fg)", lineHeight: 1.2 }}>
              {b.displayTicker}
            </span>
            {pct !== null && (
              <span
                className="split-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  padding: "2px 6px",
                  borderRadius: 99,
                  background: `color-mix(in srgb, ${pctColor} 12%, transparent)`,
                  color: pctColor,
                  border: `1px solid color-mix(in srgb, ${pctColor} 28%, transparent)`,
                  lineHeight: 1.5,
                }}
              >
                {pct.toFixed(1)}%
              </span>
            )}
          </div>
          {/* Full coin TYPE — security affordance, always shown */}
          <div
            className="mono truncate"
            style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}
            title={b.coinType}
          >
            {shortCoinType(b.coinType)}
          </div>
        </div>

        {/* Numbers + actions cluster — its own line on mobile, right-aligned on sm+.
            items-start so the balance + value numbers line up at the top. */}
        <div className="flex items-start gap-3 shrink-0">
          {/* Balance + unit price */}
          <div className="text-left sm:text-right shrink-0">
            <div className="mono" style={{ fontSize: 13.5, fontWeight: 650, color: "var(--fg)", lineHeight: 1.2 }}>
              {formatTokenAmount(Number(b.humanBalance))}
            </div>
            {b.priceUsd != null && b.priceUsd > 0 ? (
              <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>
                @ {formatPrice(b.priceUsd)}
              </div>
            ) : (
              <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>
                —
              </div>
            )}
          </div>

          {/* USD value */}
          <div className="text-left sm:text-right shrink-0">
            <div className="mono" style={{ fontSize: 13.5, fontWeight: 650, color: "var(--fg)", lineHeight: 1.2 }}>
              {b.estimatedUsdValue != null ? formatUsd(b.estimatedUsdValue) : "—"}
            </div>
          </div>

          {/* Quick actions — inline icons on desktop, compact kebab menu on mobile */}
          {onAction && <RowActions ticker={b.displayTicker} onAction={onAction} />}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PortfolioCard({
  walletAddress,
  balances,
  totalEstimatedUsdValue,
  network,
  demoFixture,
  onAction,
}: PortfolioCardProps) {
  // Filter zero-balance tokens; sort by USD desc.
  const sorted = balances
    .filter((b) => BigInt(b.nativeBalance) !== 0n)
    .sort((a, b) => (b.estimatedUsdValue ?? 0) - (a.estimatedUsdValue ?? 0));

  // Allocation denominator: only coins with a known USD value (single oracle,
  // no SuiVision+Pyth blending). Coins without prices show a "—" chip.
  const allocDenom = sorted.reduce(
    (sum, b) => sum + (b.estimatedUsdValue ?? 0),
    0
  );

  // Build allocation slices for the inline bar.
  const allocationSlices: AllocationSlice[] = sorted
    .filter((b) => b.estimatedUsdValue != null && b.estimatedUsdValue > 0)
    .map((b, i) => ({
      pct: allocDenom > 0 ? ((b.estimatedUsdValue ?? 0) / allocDenom) * 100 : 0,
      color: BAR_COLORS[i % BAR_COLORS.length],
    }));

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        maxWidth: 460,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* ── Hero header — gradient wash matching lend/swap card aesthetic ── */}
      <div
        style={{
          padding: "16px 16px 14px",
          borderBottom: "1px solid var(--border)",
          background:
            "linear-gradient(180deg, var(--accent-soft) 0%, transparent 100%)",
        }}
      >
        {/* Meta row: label + badges */}
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span
            className="split-mono"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.14em",
              color: "var(--accent-ink)",
              textTransform: "uppercase",
            }}
          >
            Portfolio · sui:{network}
          </span>
          <div className="flex items-center gap-1.5">
            {/* DEMO badge — security affordance, never remove */}
            {demoFixture && (
              <span
                className="split-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  padding: "3px 8px",
                  borderRadius: 99,
                  color: "var(--warning)",
                  background:
                    "color-mix(in srgb, var(--warning) 12%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                }}
              >
                DEMO
              </span>
            )}
            {/* Network badge — security affordance, never remove */}
            <span
              className="split-mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                padding: "3px 8px",
                borderRadius: 99,
                color: "var(--accent-ink)",
                background: "var(--accent-soft)",
                border:
                  "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
              }}
            >
              {network}
            </span>
          </div>
        </div>

        {/* Total USD — large hero number */}
        <div
          className="mono"
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: "var(--fg)",
          }}
        >
          {formatUsd(totalEstimatedUsdValue)}
        </div>

        {/* Wallet address — truncated for context */}
        <p
          className="mono"
          style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 5 }}
        >
          {walletAddress.slice(0, 10)}…{walletAddress.slice(-6)}
        </p>

        {/* Allocation bar — inline stacked divs, no chart library */}
        {allocationSlices.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <AllocationBar slices={allocationSlices} />
          </div>
        )}
      </div>

      {/* ── Column header ── */}
      {sorted.length > 0 && (
        <div
          className="hidden sm:flex items-center gap-3"
          style={{
            padding: "7px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-sub)",
          }}
        >
          <div style={{ width: 34, flexShrink: 0 }} />
          <div
            className="split-mono flex-1"
            style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--fg-faint)" }}
          >
            Asset
          </div>
          <div
            className="split-mono text-right shrink-0"
            style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--fg-faint)", minWidth: 80 }}
          >
            Balance
          </div>
          <div
            className="split-mono text-right shrink-0"
            style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--fg-faint)", minWidth: 70 }}
          >
            Value
          </div>
          {onAction && <div style={{ width: 61, flexShrink: 0 }} />}
        </div>
      )}

      {/* ── Balance rows ── */}
      <div>
        {sorted.length === 0 ? (
          <div
            style={{
              padding: "32px 20px",
              textAlign: "center",
              color: "var(--fg-faint)",
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 8 }}>—</div>
            No assets found for this wallet.
          </div>
        ) : (
          sorted.map((b, i) => {
            const pct =
              allocDenom > 0 && b.estimatedUsdValue != null
                ? (b.estimatedUsdValue / allocDenom) * 100
                : null;
            const pctColor = BAR_COLORS[i % BAR_COLORS.length];
            return (
              <CoinRow
                key={b.coinType}
                b={b}
                pct={pct}
                pctColor={pctColor}
                onAction={onAction}
              />
            );
          })
        )}
      </div>

    </div>
  );
}
