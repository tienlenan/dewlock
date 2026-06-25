"use client";

/**
 * YieldAdvisorCard — read-only advisory card ranking yield/staking venues for
 * the user's idle balances. Each recommendation row shows a coin, its balance,
 * and the best protocol venue (lend APY or LST APY, self-fetched from /api/lend-options).
 *
 * Action buttons reuse the existing Guardian-gated lend/stake flows by re-submitting
 * the action string as a chat message — the user chooses; nothing auto-executes.
 *
 * WHY no P&L or cost-basis: the receipt schema stores no entry-USD baseline and there
 * is no historical price oracle. Showing a P&L would require fabrication.
 *
 * Visual tokens mirror lend-options-card.tsx and ecosystem-card-shell.tsx.
 */

import { useEffect, useState } from "react";
import { TrendingUp, ChevronRight } from "lucide-react";
import { ProtocolLogo } from "./asset-logos";
import { fetchJsonWithRetry } from "@/lib/fetch-with-retry";

// ---------------------------------------------------------------------------
// Data shape (mirrors getYieldAdvice outputSchema)
// ---------------------------------------------------------------------------

export interface YieldVenue {
  protocol: string;
  name: string;
  kind: "lend" | "stake";
  apyPct: number | null;
  action: string;
}

export interface YieldRecommendation {
  coinType: string;
  coinSymbol: string;
  humanBalance: string;
  estimatedUsdValue: number | null;
  bestVenue: YieldVenue;
  allVenues: YieldVenue[];
}

export interface YieldAdviceData {
  walletAddress: string;
  recommendations: YieldRecommendation[];
  needsPortfolio: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtApy(apy: number | null | undefined): string | null {
  return typeof apy === "number" && Number.isFinite(apy) ? `${apy.toFixed(2)}%` : null;
}

function fmtUsd(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "";
  return `≈ $${v.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

export function YieldAdvisorCard({
  data,
  onChoose,
}: {
  data: YieldAdviceData;
  /** Re-submit action string as a chat message (routes through Guardian-gated flow). */
  onChoose?: (actionText: string) => void;
}) {
  // Self-fetch live APY per coin from /api/lend-options (fail-soft).
  // Keyed by coinType → apyByProtocol map.
  const [liveApy, setLiveApy] = useState<Record<string, Record<string, number | null>>>({});

  useEffect(() => {
    const coinTypes = data.recommendations.map((r) => r.coinType);
    if (coinTypes.length === 0) return;

    let cancelled = false;
    const ctrls: AbortController[] = [];

    // Fetch APY for each coin in parallel (fail-soft: a failure leaves that coin's APY as "—")
    Promise.all(
      coinTypes.map(async (coinType) => {
        const ctrl = new AbortController();
        ctrls.push(ctrl);
        try {
          const d = await fetchJsonWithRetry<{ apyByProtocol?: Record<string, number | null> }>(
            `/api/lend-options?coin=${encodeURIComponent(coinType)}`,
            { attempts: 2, timeoutMs: 6000, signal: ctrl.signal },
          );
          return { coinType, apy: d.apyByProtocol ?? {} };
        } catch {
          return { coinType, apy: {} };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const merged: Record<string, Record<string, number | null>> = {};
      for (const { coinType, apy } of results) merged[coinType] = apy;
      setLiveApy(merged);
    });

    return () => {
      cancelled = true;
      ctrls.forEach((c) => c.abort());
    };
  }, [data.recommendations]);

  const [chosen, setChosen] = useState<string | null>(null);

  if (data.needsPortfolio) {
    return (
      <div
        className="w-full overflow-hidden"
        style={{ maxWidth: 480, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", padding: "18px", color: "var(--fg-muted)", fontSize: 13 }}
      >
        Portfolio not loaded yet — try asking "show my portfolio" first.
      </div>
    );
  }

  if (data.recommendations.length === 0) {
    return (
      <div
        className="w-full overflow-hidden"
        style={{ maxWidth: 480, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", padding: "18px", color: "var(--fg-muted)", fontSize: 13 }}
      >
        No yield venues available for your current balances.
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 480, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, var(--accent-soft) 0%, transparent 100%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <TrendingUp size={15} style={{ color: "var(--accent-ink)", flexShrink: 0 }} aria-hidden />
        <div>
          <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--accent-ink)", textTransform: "uppercase" }}>
            Yield advisor
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", marginTop: 1 }}>
            Best venues for your idle balances
          </div>
        </div>
      </div>

      {/* Recommendation rows */}
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {data.recommendations.map((rec) => {
          const apyMap = liveApy[rec.coinType] ?? {};
          const liveApyVal = apyMap[rec.bestVenue.protocol] ?? null;
          const apyStr = fmtApy(liveApyVal ?? rec.bestVenue.apyPct);
          const usdStr = fmtUsd(rec.estimatedUsdValue);
          const actionKey = `${rec.coinType}:${rec.bestVenue.protocol}`;
          const isChosen = chosen === actionKey;

          return (
            <button
              key={rec.coinType}
              type="button"
              disabled={Boolean(chosen)}
              onClick={() => {
                setChosen(actionKey);
                onChoose?.(rec.bestVenue.action);
              }}
              className="flex items-center gap-3 text-left transition-all"
              style={{
                width: "100%",
                padding: "11px 13px",
                borderRadius: 12,
                border: isChosen ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                background: isChosen ? "var(--accent-soft)" : "var(--bg-elev)",
                boxShadow: isChosen ? "var(--shadow-aqua)" : "var(--shadow-sm)",
                opacity: chosen && !isChosen ? 0.45 : 1,
                cursor: chosen ? "default" : "pointer",
              }}
            >
              {/* Protocol logo */}
              <ProtocolLogo id={rec.bestVenue.protocol} size={34} />

              {/* Coin + venue info */}
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 14, fontWeight: 650, color: "var(--fg)" }}>
                  {rec.coinSymbol}
                  {usdStr && (
                    <span style={{ fontWeight: 400, fontSize: 11, color: "var(--fg-muted)", marginLeft: 5 }}>
                      {usdStr}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 1 }}>
                  {rec.bestVenue.name}
                  <span className="split-mono" style={{ marginLeft: 5, letterSpacing: "0.04em", fontSize: 10, textTransform: "uppercase" }}>
                    {rec.bestVenue.kind}
                  </span>
                </div>
              </div>

              {/* APY block */}
              <div className="shrink-0 text-right" style={{ minWidth: 58 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 17,
                    fontWeight: 750,
                    lineHeight: 1,
                    color: apyStr ? "var(--success)" : "var(--fg-faint)",
                  }}
                >
                  {apyStr ?? "—"}
                </div>
                <div
                  className="split-mono"
                  style={{ fontSize: 8.5, letterSpacing: "0.1em", color: "var(--fg-faint)", marginTop: 3, textTransform: "uppercase" }}
                >
                  {rec.bestVenue.kind === "stake" ? "stake apy" : "supply apy"}
                </div>
              </div>

              {/* Chevron */}
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  background: isChosen ? "var(--accent)" : "var(--bg-sub)",
                  color: isChosen ? "#fff" : "var(--fg-faint)",
                }}
              >
                <ChevronRight size={13} aria-hidden />
              </div>
            </button>
          );
        })}

        <p
          className="split-mono"
          style={{ fontSize: 9.5, color: "var(--fg-faint)", margin: "2px 2px 0", letterSpacing: "0.04em" }}
        >
          Live APY · advisory only, not financial advice · Guardian dry-runs before you sign.
        </p>
      </div>
    </div>
  );
}
