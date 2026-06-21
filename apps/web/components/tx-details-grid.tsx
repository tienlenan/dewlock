"use client";

/**
 * TxDetailsGrid — the min-received / slippage / route / gas / coin-type / est-value
 * rows. The full coin TYPE is always shown (fake-coin prevention) — do not reduce it
 * to a ticker. Markup is identical to the inline version it was extracted from.
 */

import React from "react";
import { formatNative, formatMist, formatUsd, shortCoinType } from "./tx-preview-format";
import type { TxPreviewData } from "./tx-preview-card";

export function TxDetailsGrid({ preview }: { preview: TxPreviewData }) {
  const isLend = !!preview.lendingProtocol;
  const isSwap = !!preview.coinTypeOut && !isLend;
  const amountOut = preview.minAmountOutNative && preview.coinTypeOut
    ? formatNative(preview.minAmountOutNative, preview.coinTypeOut, preview.coinDecimals)
    : null;
  const tickerOut = preview.coinTypeOut ? shortCoinType(preview.coinTypeOut) : null;
  const gasCost = formatMist(preview.gasCostMist);

  return (
    <div className="flex flex-col gap-2" style={{ fontSize: "12.5px" }}>
      {isSwap && preview.slippageBps !== undefined && (
        <>
          <DetailRow
            label="Min received (re-derived)"
            value={`${amountOut ?? "—"} ${tickerOut ?? ""}`}
            mono
          />
          <DetailRow
            label="Slippage cap"
            value={`${(preview.slippageBps / 100).toFixed(2)}%`}
            mono
          />
        </>
      )}
      {isSwap && preview.swapSource && (
        <DetailRow
          label="Route"
          value={
            preview.swapSource === "aggregator"
              ? `aggregator · ${(preview.routeProviders ?? []).join(" → ") || "best route"}`
              : "Cetus (direct pool)"
          }
          mono
        />
      )}
      <DetailRow label="Network gas" value={gasCost} mono />
      {/* Coin type — always shown for fake-coin prevention */}
      <DetailRow
        label="Coin type"
        value={<code className="mono" style={{ fontSize: "10px", wordBreak: "break-all", color: "var(--fg-muted)" }}>{preview.coinTypeIn}</code>}
      />
      <DetailRow
        label="Est. value"
        value={
          <span style={preview.capsWarning ? { color: "var(--destructive)", fontWeight: 600 } : {}}>
            {formatUsd(preview.estimatedUsdValue)}
          </span>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal layout helper
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span
        className={mono ? "mono" : ""}
        style={{ textAlign: "right", color: "var(--fg)" }}
      >
        {value}
      </span>
    </div>
  );
}
