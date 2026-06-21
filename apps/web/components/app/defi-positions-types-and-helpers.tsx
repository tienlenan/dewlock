"use client";

/**
 * defi-positions-types-and-helpers — shared types, formatting helpers, and
 * row sub-components for the DeFi Positions card.
 *
 * Extracted to keep defi-positions-section.tsx under 200 LOC.
 */

import React, { useState } from "react";
import { CoinLogo, ProtocolLogo } from "@/components/chat/asset-logos";
import { WithdrawAmountInput } from "@/components/app/withdraw-amount-input";

// ── Pool → base coin type ────────────────────────────────────────────────────

export const POOL_BASE_COIN_TYPE: Record<string, string> = {
  DEEP_USDC: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
  SUI_USDC:  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  DEEP_SUI:  "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
};

// ── Data types ────────────────────────────────────────────────────────────────

export interface OpenOrder {
  orderId: string;
  poolKey: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  filledPct: number;
  expireTimestampMs: number;
}

export interface SettledBalance {
  coinType: string;
  coinKey: string;
  balance: number; // human-readable
}

export interface NaviSupplied {
  coinType: string;
  symbol: string;
  amount: number;
  valueUsd: number;
}

export interface DefiPositionsData {
  walletAddress: string;
  deepbook: {
    balanceManagerId: string | null;
    openOrders: OpenOrder[];
    settledBalances: SettledBalance[];
  };
  lending: {
    navi: { supplied: NaviSupplied[]; healthFactor: number | null };
    suilend: { supplied: null; manageUrl: string };
  };
  demoFixture: boolean;
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function shortCoinType(coinType: string): string {
  const parts = coinType.split("::");
  return parts[parts.length - 1] ?? coinType;
}

export function formatExpiry(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "expired";
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function formatPct(pct: number): string {
  return `${(pct * 100).toFixed(1)}%`;
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="split-mono"
      style={{
        fontSize: 9.5,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--fg-muted)",
        margin: "0 0 6px",
      }}
    >
      {children}
    </p>
  );
}

export function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ fontSize: 12 }}>
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span className="mono" style={{ color: "var(--fg)" }}>{value}</span>
    </div>
  );
}

// ── Protocol block ────────────────────────────────────────────────────────────
// Groups a protocol's positions under one branded header: protocol icon + name on
// the left, an optional external "Manage ↗" link on the right, children below.

export function ProtocolBlock({
  id,
  name,
  manageUrl,
  children,
}: {
  id: string;
  name: string;
  manageUrl?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: children ? 7 : 0 }}>
        <div className="flex items-center gap-2">
          <ProtocolLogo id={id} size={20} />
          <span
            className="split-mono"
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--fg)" }}
          >
            {name}
          </span>
        </div>
        {manageUrl && (
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
          >
            Manage ↗
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

export function ActionButton({
  onClick,
  children,
  variant = "default",
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "destructive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 26,
        padding: "0 10px",
        border: `1px solid ${variant === "destructive" ? "color-mix(in srgb, var(--destructive) 40%, transparent)" : "var(--border)"}`,
        borderRadius: 6,
        background:
          variant === "destructive"
            ? "color-mix(in srgb, var(--destructive) 6%, transparent)"
            : "var(--bg-sub)",
        color: variant === "destructive" ? "var(--destructive)" : "var(--fg-muted)",
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── Open order row ────────────────────────────────────────────────────────────

export function OpenOrderRow({
  order,
  bmId,
  onCancel,
}: {
  order: OpenOrder;
  bmId: string;
  onCancel: (orderId: string, poolKey: string, balanceManagerId: string, coinTypeIn: string) => void;
}) {
  const coinTypeIn = POOL_BASE_COIN_TYPE[order.poolKey] ?? "";
  const pairLabel = order.poolKey.replace("_", "/");

  return (
    <div
      style={{
        padding: "9px 12px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ flex: 1, display: "grid", gap: 2 }}>
        <div className="flex items-center gap-2" style={{ fontSize: 12 }}>
          <span
            className="split-mono"
            style={{
              fontSize: 10,
              padding: "1px 7px",
              borderRadius: 99,
              background:
                order.side === "BUY"
                  ? "color-mix(in srgb, var(--success) 12%, transparent)"
                  : "color-mix(in srgb, var(--destructive) 12%, transparent)",
              color: order.side === "BUY" ? "var(--success)" : "var(--destructive)",
              border: `1px solid ${order.side === "BUY" ? "color-mix(in srgb, var(--success) 30%, transparent)" : "color-mix(in srgb, var(--destructive) 30%, transparent)"}`,
            }}
          >
            {order.side}
          </span>
          <span style={{ color: "var(--fg)", fontWeight: 600 }}>{pairLabel}</span>
          <span style={{ color: "var(--fg-muted)" }}>@ {order.price}</span>
        </div>
        <div className="flex items-center gap-3" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
          <span className="mono">qty {order.quantity}</span>
          <span>filled {formatPct(order.filledPct)}</span>
          <span>exp {formatExpiry(order.expireTimestampMs)}</span>
        </div>
      </div>
      <ActionButton
        variant="destructive"
        onClick={() => onCancel(order.orderId, order.poolKey, bmId, coinTypeIn)}
      >
        Cancel
      </ActionButton>
    </div>
  );
}

// ── Settled balance row ───────────────────────────────────────────────────────

export function SettledBalanceRow({
  bal,
  bmId,
  onWithdraw,
}: {
  bal: SettledBalance;
  bmId: string;
  onWithdraw: (coinType: string, coinSymbol: string, humanAmount: string, balanceManagerId: string) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const symbol = shortCoinType(bal.coinType);

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <div style={{ padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <CoinLogo symbol={symbol} size={22} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>{symbol}</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
            {bal.balance.toLocaleString("en-US", { maximumFractionDigits: 6 })} settled
          </span>
        </div>
        <ActionButton onClick={() => setShowInput((v) => !v)}>
          {showInput ? "Cancel" : "Withdraw"}
        </ActionButton>
      </div>
      {showInput && (
        <div style={{ padding: "0 12px 10px" }}>
          <WithdrawAmountInput
            coinSymbol={symbol}
            maxAmount={bal.balance}
            onConfirm={(amount) => {
              setShowInput(false);
              onWithdraw(bal.coinType, symbol, amount, bmId);
            }}
            onCancel={() => setShowInput(false)}
          />
        </div>
      )}
    </div>
  );
}
