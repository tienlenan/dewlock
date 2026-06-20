"use client";

/**
 * LendOptionsCard — protocol picker for a lend whose amount + coin are known but
 * whose protocol is not (e.g. "lend 1 SUI"). Renders one premium vault card per
 * eligible lending protocol with a branded logo and its live supply APY, so the
 * user picks a venue instead of re-typing the whole action into a form.
 *
 * Picking a protocol composes a COMPLETE command ("deposit 1 SUI to navi") via
 * onChoose, which re-enters the deterministic pipeline → prepareTrade → Guardian.
 * APY is self-fetched from /api/lend-options (fail-soft: "—"); never builds/signs.
 */

import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ProtocolLogo } from "./asset-logos";
import { fetchJsonWithRetry } from "@/lib/fetch-with-retry";

export interface LendOption {
  protocol: string;
  name: string;
}

export interface LendOptionsData {
  coinType: string;
  coinSymbol: string;
  amountHuman?: string;
  verb: "deposit" | "repay";
  options: LendOption[];
}

function fmtApy(apy: number | null | undefined): string | null {
  return typeof apy === "number" ? apy.toFixed(2) : null;
}

export function LendOptionsCard({
  data,
  onChoose,
}: {
  data: LendOptionsData;
  /** Pick a protocol → composes a complete lend command and re-submits it. */
  onChoose?: (protocol: string) => void;
}) {
  const [apy, setApy] = useState<Record<string, number | null>>({});
  const [chosen, setChosen] = useState<string | null>(null);

  // Self-fetch live supply APY (fail-soft — leaves entries undefined → "—").
  // Auto-retry up to 3× so a cold-path first load still shows live APY instead of "—".
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    fetchJsonWithRetry<{ apyByProtocol?: Record<string, number | null> }>(
      `/api/lend-options?coin=${encodeURIComponent(data.coinType)}`,
      { attempts: 3, timeoutMs: 8000, signal: ctrl.signal },
    )
      .then((d) => { if (!cancelled) setApy(d.apyByProtocol ?? {}); })
      .catch(() => { if (!cancelled) setApy({}); });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [data.coinType]);

  const verbLabel = data.verb === "repay" ? "Repay" : "Supply";
  const amountLabel = data.amountHuman ? `${data.amountHuman} ${data.coinSymbol}` : data.coinSymbol;

  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      {/* Header with a soft gradient wash */}
      <div
        style={{
          padding: "14px 16px 13px",
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, var(--accent-soft) 0%, transparent 100%)",
        }}
      >
        <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--accent-ink)", textTransform: "uppercase" }}>
          {verbLabel} · choose a protocol
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", marginTop: 3, letterSpacing: "-0.01em" }}>
          {amountLabel}
        </div>
      </div>

      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 9 }}>
        {data.options.map((o) => {
          const isChosen = chosen === o.protocol;
          const apyStr = fmtApy(apy[o.protocol]);
          return (
            <button
              key={o.protocol}
              type="button"
              disabled={Boolean(chosen)}
              onClick={() => {
                setChosen(o.protocol);
                onChoose?.(o.protocol);
              }}
              className="flex items-center gap-3 text-left transition-all"
              style={{
                width: "100%",
                padding: "12px 13px",
                borderRadius: 12,
                border: isChosen ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                background: isChosen ? "var(--accent-soft)" : "var(--bg-elev)",
                boxShadow: isChosen ? "var(--shadow-aqua)" : "var(--shadow-sm)",
                opacity: chosen && !isChosen ? 0.45 : 1,
                cursor: chosen ? "default" : "pointer",
              }}
            >
              <ProtocolLogo id={o.protocol} size={36} />

              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 14.5, fontWeight: 650, color: "var(--fg)" }}>{o.name}</div>
                <div className="flex items-center gap-1" style={{ fontSize: 10.5, color: "var(--fg-muted)", marginTop: 2 }}>
                  <ShieldCheck size={11} style={{ color: "var(--success)" }} aria-hidden />
                  <span className="split-mono" style={{ letterSpacing: "0.04em" }}>deposit / repay · audit-clean</span>
                </div>
              </div>

              {/* APY block — the "interest", prominent */}
              <div className="shrink-0 text-right" style={{ minWidth: 64 }}>
                <div className="mono" style={{ fontSize: 18, fontWeight: 750, lineHeight: 1, color: apyStr ? "var(--success)" : "var(--fg-faint)" }}>
                  {apyStr ? `${apyStr}%` : "—"}
                </div>
                <div className="split-mono" style={{ fontSize: 8.5, letterSpacing: "0.1em", color: "var(--fg-faint)", marginTop: 3, textTransform: "uppercase" }}>
                  supply apy
                </div>
              </div>

              {/* Affordance chevron / chosen state */}
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: isChosen ? "var(--accent)" : "var(--bg-sub)",
                  color: isChosen ? "#fff" : "var(--fg-faint)",
                }}
              >
                <ArrowRight size={14} aria-hidden />
              </div>
            </button>
          );
        })}

        {data.options.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--fg-faint)", margin: "4px 2px" }}>
            No built lending protocol supports {data.coinSymbol} yet.
          </p>
        )}

        <p className="split-mono" style={{ fontSize: 9.5, color: "var(--fg-faint)", margin: "1px 2px 0", letterSpacing: "0.04em" }}>
          Live APY · the Guardian dry-runs + previews before you sign.
        </p>
      </div>
    </div>
  );
}
