"use client";

/**
 * DefiPositionsSection — renders the getDefiPositions tool result as a card,
 * grouped by protocol so each provider carries its own brand icon + header.
 *
 * Blocks:
 *   - DeepBook — open orders (Cancel) + settled balances (Withdraw → WithdrawAmountInput)
 *   - NAVI — supplied rows + health factor + Manage ↗ deep-link
 *   - Suilend — Manage ↗ deep-link only (its SDK reads are unavailable)
 *
 * Security:
 *   - DEMO badge shown when demoFixture === true
 *   - Manage ↗ links always open target="_blank" rel="noopener noreferrer"
 *   - NAVI / Suilend have no in-app tx; Manage is deep-link only
 *
 * Row sub-components, the ProtocolBlock header, and data types live in
 * defi-positions-types-and-helpers.tsx.
 */

import React, { useState } from "react";
import { CoinLogo } from "@/components/chat/asset-logos";
import {
  type DefiPositionsData,
  type BalanceManager,
  type OpenOrder,
  type SettledBalance,
  type PoolTiedBalance,
  SectionLabel,
  DataRow,
  ProtocolBlock,
  OpenOrderRow,
  SettledBalanceRow,
  PoolTiedRow,
} from "@/components/app/defi-positions-types-and-helpers";

// Re-export data type so chat-thread can import it from one place.
export type { DefiPositionsData } from "@/components/app/defi-positions-types-and-helpers";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DefiPositionsSectionProps {
  data: DefiPositionsData;
  /** Scoped per-BM: keys are `${balanceManagerId}:${orderId}` */
  hiddenOrderIds?: ReadonlySet<string>;
  /** Scoped per-BM: keys are `${balanceManagerId}:${coinKey}` */
  hiddenCoinKeys?: ReadonlySet<string>;
  onCancel: (orderId: string, poolKey: string, balanceManagerId: string, coinTypeIn: string) => void;
  onWithdraw: (coinType: string, coinSymbol: string, humanAmount: string, balanceManagerId: string) => void;
  /** Claim settled (filled/owed) balances pool→BM for this BalanceManager. */
  onClaim?: (coinType: string, coinSymbol: string, balanceManagerId: string) => void;
}

// ── NAVI block ────────────────────────────────────────────────────────────────

function NaviBlock({ navi }: { navi: DefiPositionsData["lending"]["navi"] }) {
  const supplied = navi.supplied ?? [];

  return (
    <ProtocolBlock id="navi" name="NAVI Protocol" manageUrl="https://app.naviprotocol.io">
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "9px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {supplied.map((row) => (
          <div key={row.coinType} className="flex items-center gap-2" style={{ fontSize: 12 }}>
            <CoinLogo symbol={row.symbol} size={18} />
            <span style={{ flex: 1, color: "var(--fg)" }}>{row.symbol}</span>
            <span className="mono" style={{ color: "var(--fg)" }}>
              {row.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}
            </span>
            <span style={{ color: "var(--fg-faint)", fontSize: 11 }}>
              ${row.valueUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        {navi.healthFactor !== null && (
          <DataRow
            label="Health factor"
            value={
              <span
                style={{
                  color:
                    (navi.healthFactor ?? 99) < 1.1
                      ? "var(--destructive)"
                      : (navi.healthFactor ?? 99) < 1.5
                      ? "var(--warning)"
                      : "var(--success)",
                }}
              >
                {navi.healthFactor!.toFixed(2)}
              </span>
            }
          />
        )}
      </div>
    </ProtocolBlock>
  );
}

// ── BalanceManagerBlock — one sub-section per BM ─────────────────────────────

function BalanceManagerBlock({
  bm,
  index,
  total,
  hiddenOrderIds,
  hiddenCoinKeys,
  onCancel,
  onWithdraw,
  onClaim,
}: {
  bm: BalanceManager;
  index: number;
  total: number;
  hiddenOrderIds: ReadonlySet<string>;
  hiddenCoinKeys: ReadonlySet<string>;
  onCancel: (orderId: string, poolKey: string, balanceManagerId: string, coinTypeIn: string) => void;
  onWithdraw: (coinType: string, coinSymbol: string, humanAmount: string, balanceManagerId: string) => void;
  onClaim?: (coinType: string, coinSymbol: string, balanceManagerId: string) => void;
}) {
  const bmId = bm.balanceManagerId;
  // Scoped per-BM: hide keys are `${bmId}:${orderId}` and `${bmId}:${coinKey}`
  const visibleOrders: OpenOrder[] = bm.openOrders.filter(
    (o) => !hiddenOrderIds.has(`${bmId}:${o.orderId}`),
  );
  const visibleBalances: SettledBalance[] = bm.settledBalances.filter(
    (b) => !hiddenCoinKeys.has(`${bmId}:${b.coinKey}`),
  );
  // Funds committed to pools (locked in orders / settled-from-fills). Not subject to the
  // optimistic hide sets (those scope cancel/withdraw of the BM's own orders + free balance).
  const poolTied: PoolTiedBalance[] = (bm.poolTied ?? []).filter((p) => p.locked > 0 || p.settled > 0);
  const isEmpty =
    visibleOrders.length === 0 && visibleBalances.length === 0 && poolTied.length === 0;

  // Shortened BM address label: 0xab...1c
  const shortBmId =
    bmId.length > 10
      ? `${bmId.slice(0, 6)}…${bmId.slice(-4)}`
      : bmId;

  return (
    <div>
      {/* Account label — only shown when multiple BMs exist */}
      {total > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <span
            className="split-mono"
            style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--fg-muted)" }}
          >
            Account {index + 1}
          </span>
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--fg-faint)" }}
          >
            {shortBmId}
          </span>
        </div>
      )}

      {isEmpty ? (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            color: "var(--fg-faint)",
            fontStyle: "italic",
          }}
        >
          No open orders or settled balances
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleOrders.length > 0 && (
            <div>
              <SectionLabel>Open Orders</SectionLabel>
              <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                {visibleOrders.map((order) => (
                  <OpenOrderRow key={order.orderId} order={order} bmId={bmId} onCancel={onCancel} />
                ))}
              </div>
            </div>
          )}
          {visibleBalances.length > 0 && (
            <div>
              <SectionLabel>Available (withdrawable)</SectionLabel>
              <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                {visibleBalances.map((bal) => (
                  <SettledBalanceRow key={bal.coinKey} bal={bal} bmId={bmId} onWithdraw={onWithdraw} />
                ))}
              </div>
            </div>
          )}
          {poolTied.length > 0 && (
            <div>
              <SectionLabel>In Orders / Claimable</SectionLabel>
              <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                {poolTied.map((row) => (
                  <PoolTiedRow key={`pt:${row.coinKey}`} row={row} bmId={bmId} onClaim={onClaim} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── BM funding helper ─────────────────────────────────────────────────────────

/**
 * A BalanceManager is "funded" when it holds a settled balance OR carries any open
 * order. Open-order-only accounts count as funded so the "funded only" filter never
 * hides an account with live resting orders (its balance is locked in the order book).
 */
function isBmFunded(bm: BalanceManager): boolean {
  return (
    bm.openOrders.length > 0 ||
    bm.settledBalances.some((b) => b.balance > 0) ||
    (bm.poolTied ?? []).some((p) => p.locked > 0 || p.settled > 0)
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DefiPositionsSection({
  data,
  hiddenOrderIds = new Set(),
  hiddenCoinKeys = new Set(),
  onCancel,
  onWithdraw,
  onClaim,
}: DefiPositionsSectionProps) {
  const { deepbook, lending, demoFixture } = data;
  const balanceManagers = deepbook.balanceManagers ?? [];

  // "Funded only" filter — opt-in toggle scoped to this card. Only offered when at
  // least one empty BM exists (otherwise the filter would do nothing).
  const [fundedOnly, setFundedOnly] = useState(false);
  const emptyBmCount = balanceManagers.filter((bm) => !isBmFunded(bm)).length;
  const visibleBms = fundedOnly ? balanceManagers.filter(isBmFunded) : balanceManagers;

  const naviSupplied = lending.navi.supplied ?? [];
  const hasDeepbook = balanceManagers.length > 0;
  const hasNavi = naviSupplied.length > 0;
  const hasSuilend = !!lending.suilend.manageUrl;
  const hasAny = hasDeepbook || hasNavi || hasSuilend;

  return (
    <div
      style={{
        maxWidth: 500,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "13px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="split-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-muted)" }}>
          DeFi Positions
        </span>
        {demoFixture && (
          <span
            className="split-mono"
            style={{
              fontSize: 10,
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
      </div>

      {/* Body — one block per protocol, each branded with its own icon */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!hasAny && (
          <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>No open positions.</p>
        )}

        {/* DeepBook — one sub-section per BalanceManager */}
        {hasDeepbook && (
          <ProtocolBlock id="deepbook" name="DeepBook">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Funded-only filter — only offered when there is an empty BM to hide */}
              {emptyBmCount > 0 && (
                <label
                  title="Hide BalanceManagers with no settled balance and no open orders"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    cursor: "pointer",
                    fontSize: 11,
                    color: "var(--fg-muted)",
                    alignSelf: "flex-start",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={fundedOnly}
                    onChange={(e) => setFundedOnly(e.target.checked)}
                    style={{ accentColor: "var(--accent)", width: 13, height: 13, cursor: "pointer" }}
                  />
                  Funded accounts only (balance &gt; 0)
                </label>
              )}

              {visibleBms.length === 0 ? (
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "var(--fg-faint)",
                    fontStyle: "italic",
                  }}
                >
                  No funded accounts
                </div>
              ) : (
                visibleBms.map((bm, idx) => (
                  <BalanceManagerBlock
                    key={bm.balanceManagerId}
                    bm={bm}
                    index={idx}
                    total={visibleBms.length}
                    hiddenOrderIds={hiddenOrderIds}
                    hiddenCoinKeys={hiddenCoinKeys}
                    onCancel={onCancel}
                    onWithdraw={onWithdraw}
                    onClaim={onClaim}
                  />
                ))
              )}
            </div>
          </ProtocolBlock>
        )}

        {/* NAVI lending */}
        {hasNavi && <NaviBlock navi={lending.navi} />}

        {/* Suilend — deep-link only (no in-app reads) */}
        {hasSuilend && (
          <ProtocolBlock id="suilend" name="Suilend" manageUrl={lending.suilend.manageUrl} />
        )}
      </div>
    </div>
  );
}
