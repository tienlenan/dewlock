"use client";

/**
 * TxActionSummary — the headline "what you're doing" block of the preview card:
 * swap (You pay / You receive), transfer (You send / raw 0x recipient), or lend.
 * Markup is identical to the inline version it was extracted from; the raw 0x
 * recipient (spoofing guard) is preserved verbatim.
 */

import React from "react";
import { LendSummary } from "./lend-card";
import { formatNative, shortCoinType } from "./tx-preview-format";
import type { TxPreviewData } from "./tx-preview-card";

export function TxActionSummary({ preview }: { preview: TxPreviewData }) {
  const isLend = !!preview.lendingProtocol;
  const isSwap = !!preview.coinTypeOut && !isLend;
  const isTransfer = !preview.coinTypeOut && !isLend;
  const lendVerb: "deposit" | "repay" = /repay/i.test(preview.actionLabel) ? "repay" : "deposit";

  const amountIn = formatNative(preview.amountInNative, preview.coinTypeIn, preview.coinDecimals);
  const tickerIn = shortCoinType(preview.coinTypeIn);
  const amountOut = preview.minAmountOutNative && preview.coinTypeOut
    ? formatNative(preview.minAmountOutNative, preview.coinTypeOut, preview.coinDecimals)
    : null;
  const tickerOut = preview.coinTypeOut ? shortCoinType(preview.coinTypeOut) : null;

  return (
    <>
      {/* You pay / You receive — swap style */}
      {isSwap && (
        <div className="flex flex-col gap-2">
          {/* You pay box */}
          <div
            className="flex items-center justify-between"
            style={{
              padding: "13px 15px",
              background: "var(--bg-sub)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
            }}
          >
            <div>
              <div
                className="split-mono"
                style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)" }}
              >
                You pay
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, marginTop: 2 }}>
                {amountIn}{" "}
                <span style={{ fontSize: "12px", color: "var(--fg-muted)" }}>{tickerIn}</span>
              </div>
            </div>
            {/* Down-arrow indicator */}
            <div
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 99,
                background: "var(--accent-soft)",
                color: "var(--accent-ink)",
                fontSize: 16,
              }}
            >
              ↓
            </div>
          </div>

          {/* You receive box */}
          <div
            className="flex items-center justify-between"
            style={{
              padding: "13px 15px",
              background: "var(--bg-sub)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
            }}
          >
            <div>
              <div
                className="split-mono"
                style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)" }}
              >
                You receive (min)
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, marginTop: 2 }}>
                ~{amountOut}{" "}
                <span style={{ fontSize: "12px", color: "var(--fg-muted)" }}>{tickerOut}</span>
              </div>
            </div>
            {amountOut && (
              <span className="mono" style={{ fontSize: "11px", color: "var(--success)" }}>
                +{amountOut}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Transfer: send + raw recipient */}
      {isTransfer && (
        <div
          style={{
            padding: "13px 15px",
            background: "var(--bg-sub)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div className="flex items-baseline justify-between">
            <div
              className="split-mono"
              style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)" }}
            >
              You send
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700 }}>
              {amountIn}{" "}
              <span style={{ fontSize: "12px", color: "var(--fg-muted)" }}>{tickerIn}</span>
            </div>
          </div>
          {preview.recipientAddress && (
            <div className="flex items-start justify-between gap-2">
              <span
                className="split-mono"
                style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)", flexShrink: 0 }}
              >
                To (raw 0x)
              </span>
              {/* Raw address always shown — spoofing guard */}
              <code
                className="mono"
                style={{ fontSize: "11px", color: "var(--fg)", wordBreak: "break-all", textAlign: "right" }}
              >
                {preview.recipientAddress}
              </code>
            </div>
          )}
        </div>
      )}

      {/* Lend: protocol + asset + health (borrow/withdraw never reach this card) */}
      {isLend && preview.lendingProtocol && (
        <LendSummary
          protocol={preview.lendingProtocol}
          verb={lendVerb}
          amount={amountIn}
          ticker={tickerIn}
          healthBefore={preview.healthBefore}
          healthAfter={preview.healthAfter}
        />
      )}
    </>
  );
}
