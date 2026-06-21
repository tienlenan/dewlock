"use client";

/**
 * SwapFormCard — from→to swap picker rendered when the user types a bare/partial
 * "swap". DEX layout: a "You pay" panel (token + amount), a direction toggle, a
 * "You receive" panel (token + live estimated-out per source), a source selector
 * (Cetus Aggregator vs Aftermath Router), a rate line, and a CTA that composes a
 * COMPLETE `swap <amt> <from> to <to> via <source>` command → prepareTrade.
 *
 * The estimated-out is an INDICATIVE self-fetched quote (/api/swap-quote, fail-soft);
 * the Guardian re-derives min-out at build. This card never builds or signs.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ChevronDown, Route } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { CoinLogo } from "./asset-logos";
import { useCoinBalance } from "@/lib/use-coin-balance";
import { fetchJsonWithRetry } from "@/lib/fetch-with-retry";

// Keep ~0.05 SUI for gas when using MAX/50% on the native gas coin.
const SUI_GAS_RESERVE_NATIVE = 50_000_000n;
function isSuiCoin(coinType: string): boolean {
  return coinType.endsWith("::sui::SUI");
}

/** Native units → a plain decimal string (no separators, trimmed) for an input. */
function nativeToPlain(native: bigint, decimals: number): string {
  if (native <= 0n) return "";
  const s = native.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  const frac = decimals ? s.slice(s.length - decimals).replace(/0+$/, "") : "";
  return frac ? `${whole}.${frac}` : whole;
}

export interface SwapCoin {
  symbol: string;
  coinType: string;
  decimals: number;
  logoUrl?: string;
}

export interface SwapFormData {
  coins: SwapCoin[];
  coinTypeIn?: string;
  coinTypeOut?: string;
  amountHuman?: string;
}

type SwapSource = "aggregator" | "aftermath";

const SOURCE_LABELS: Record<SwapSource, string> = {
  aggregator: "Cetus Aggregator",
  aftermath: "Aftermath Router",
};

interface SourceQuote {
  available: boolean;
  estimatedAmountOut?: string;
  minAmountOut?: string;
  routeProviders?: string[];
  error?: string;
}

function humanToNative(human: string, decimals: number): string | null {
  if (!/^\d+(\.\d+)?$/.test(human.trim())) return null;
  const [whole, frac = ""] = human.trim().split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  try {
    return (BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0")).toString();
  } catch {
    return null;
  }
}

function nativeToHuman(native: string, decimals: number): string {
  const n = Number(BigInt(native)) / 10 ** decimals;
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 4 });
}

function TokenSelect({
  coins,
  value,
  exclude,
  onChange,
}: {
  coins: SwapCoin[];
  value: SwapCoin;
  exclude?: string;
  onChange: (c: SwapCoin) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    // shrink:0 so the token pill keeps its size and the amount input absorbs any
    // width squeeze — the pill must never get pushed past the panel edge.
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 transition-colors"
        style={{ padding: "5px 8px 5px 5px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--bg-elev)", boxShadow: "var(--shadow-sm)", cursor: "pointer", maxWidth: 150 }}
      >
        <CoinLogo symbol={value.symbol} logoUrl={value.logoUrl} size={24} />
        <span style={{ fontSize: 14, fontWeight: 650, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{value.symbol}</span>
        <ChevronDown size={14} style={{ color: "var(--fg-faint)", flexShrink: 0 }} aria-hidden />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 11, minWidth: 150,
              background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 12,
              boxShadow: "var(--shadow-lg)", padding: 5, maxHeight: 220, overflowY: "auto",
            }}
          >
            {coins.map((c) => {
              const disabled = c.coinType === exclude;
              return (
                <button
                  key={c.coinType}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(c); setOpen(false); }}
                  className="flex items-center gap-2 w-full text-left"
                  style={{ padding: "7px 8px", borderRadius: 8, border: "none", background: c.coinType === value.coinType ? "var(--accent-soft)" : "transparent", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1 }}
                >
                  <CoinLogo symbol={c.symbol} logoUrl={c.logoUrl} size={22} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>{c.symbol}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-sub)", border: "1px solid var(--border)", borderRadius: 13, padding: "11px 13px" }}>
      <div className="split-mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", color: "var(--fg-faint)", textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <div className="flex items-center justify-between gap-2">{children}</div>
    </div>
  );
}

/** Source tab selector — shows per-source estimated out. */
function SourceSelector({
  sources,
  selected,
  toDecimals,
  onSelect,
}: {
  sources: Partial<Record<SwapSource, SourceQuote>>;
  selected: SwapSource;
  toDecimals: number;
  onSelect: (s: SwapSource) => void;
}) {
  const tabs: SwapSource[] = ["aggregator", "aftermath"];
  return (
    <div className="flex gap-1.5" style={{ marginTop: 8 }}>
      {tabs.map((src) => {
        const q = sources[src];
        const isSelected = src === selected;
        const out = q?.available && q.estimatedAmountOut
          ? nativeToHuman(q.estimatedAmountOut, toDecimals)
          : null;
        return (
          <button
            key={src}
            type="button"
            onClick={() => onSelect(src)}
            className="flex-1 text-left"
            style={{
              padding: "7px 10px",
              borderRadius: 10,
              border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
              background: isSelected ? "var(--accent-soft)" : "var(--bg-sub)",
              cursor: "pointer",
            }}
          >
            <div className="split-mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: isSelected ? "var(--accent-ink)" : "var(--fg-faint)", textTransform: "uppercase", marginBottom: 2 }}>
              {SOURCE_LABELS[src]}
            </div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 650, color: isSelected ? "var(--fg)" : "var(--fg-muted)" }}>
              {q == null ? "…" : out ?? (q.available ? "…" : "—")}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function SwapFormCard({ data, onSend }: { data: SwapFormData; onSend?: (text: string) => void }) {
  const coins = data.coins;
  const byType = useMemo(() => new Map(coins.map((c) => [c.coinType, c])), [coins]);
  const fallbackFrom = coins[0];
  const fallbackTo = coins.find((c) => c.coinType !== fallbackFrom?.coinType) ?? coins[1] ?? fallbackFrom;

  const [from, setFrom] = useState<SwapCoin>(byType.get(data.coinTypeIn ?? "") ?? fallbackFrom);
  const [to, setTo] = useState<SwapCoin>(byType.get(data.coinTypeOut ?? "") ?? fallbackTo);
  const [amount, setAmount] = useState(data.amountHuman ?? "");
  const [selectedSource, setSelectedSource] = useState<SwapSource>("aggregator");
  const [sourceQuotes, setSourceQuotes] = useState<Partial<Record<SwapSource, SourceQuote>>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Live balance of the "You pay" coin for the connected wallet (MAX / 50%).
  const account = useCurrentAccount();
  const { native: fromBalanceNative } = useCoinBalance(account?.address, from?.coinType);

  const amountValid = /^\d+(\.\d+)?$/.test(amount.trim()) && Number(amount) > 0;
  // Both sides must be resolved, verified coins — guards against ever emitting a
  // "swap … to undefined" command if the form lands in a degenerate state.
  const bothResolved = Boolean(from?.coinType && to?.coinType);
  const sameCoin = from?.coinType === to?.coinType;
  const canSubmit = amountValid && bothResolved && !sameCoin && !submitted;

  /** Amount usable for MAX/50% — full balance, minus a gas reserve for native SUI. */
  function spendableNative(): bigint {
    const bal = fromBalanceNative ? BigInt(fromBalanceNative) : 0n;
    if (!isSuiCoin(from.coinType)) return bal;
    return bal > SUI_GAS_RESERVE_NATIVE ? bal - SUI_GAS_RESERVE_NATIVE : 0n;
  }
  function applyPercent(pct: number) {
    if (submitted) return;
    const amt = (spendableNative() * BigInt(pct)) / 100n;
    setAmount(nativeToPlain(amt, from.decimals));
  }
  const hasBalance = fromBalanceNative != null && BigInt(fromBalanceNative) > 0n;

  // Live indicative quotes from both sources (debounced, fail-soft).
  useEffect(() => {
    if (!amountValid || sameCoin || !from || !to) {
      setSourceQuotes({});
      return;
    }
    const native = humanToNative(amount, from.decimals);
    if (!native) return;
    setQuotesLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      type ApiResponse = {
        sources?: Array<{ source: string; available: boolean; estimatedAmountOut?: string; minAmountOut?: string; routeProviders?: string[]; error?: string }>;
        best?: string | null;
        // legacy fallback fields
        available?: boolean;
        estimatedAmountOut?: string;
        routeProviders?: string[];
      };
      // Auto-retry the indicative quote (2×) so a cold-path miss still shows a route
      // without the user re-typing; the signal cancels stale retries on the next keystroke.
      fetchJsonWithRetry<ApiResponse>(
        `/api/swap-quote?in=${encodeURIComponent(from.coinType)}&out=${encodeURIComponent(to.coinType)}&amount=${native}`,
        { attempts: 2, timeoutMs: 8000, signal: ctrl.signal },
      )
        .then((d) => {
          const quotes: Partial<Record<SwapSource, SourceQuote>> = {};
          if (d.sources) {
            for (const s of d.sources) {
              const key = s.source as SwapSource;
              if (key === "aggregator" || key === "aftermath") {
                quotes[key] = { available: s.available, estimatedAmountOut: s.estimatedAmountOut, minAmountOut: s.minAmountOut, routeProviders: s.routeProviders, error: s.error };
              }
            }
            // Auto-select the best source returned by the API.
            if (d.best === "aggregator" || d.best === "aftermath") {
              setSelectedSource(d.best);
            }
          } else {
            // Legacy single-source response — treat as aggregator.
            quotes.aggregator = { available: d.available ?? false, estimatedAmountOut: d.estimatedAmountOut, routeProviders: d.routeProviders };
          }
          setSourceQuotes(quotes);
          setQuotesLoading(false);
        })
        .catch(() => {
          // Ignore a cancel from the next keystroke (a fresh fetch is already starting).
          if (ctrl.signal.aborted) return;
          setSourceQuotes({ aggregator: { available: false }, aftermath: { available: false } });
          setQuotesLoading(false);
        });
    }, 350);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [amount, from, to, amountValid, sameCoin]);

  function flip() {
    setFrom(to);
    setTo(from);
  }

  function submit() {
    if (!canSubmit) return;
    setSubmitted(true);
    // Thread the chosen source into the command so prepareTrade + Guardian both route to the
    // same source and re-derive min-out consistently. The trailing marker carries the EXACT
    // allowlisted coin types so the server binds tokens deterministically (the LLM never re-maps
    // a ticker); it is stripped from the visible bubble by use-copilot-chat.
    const bind = `[[swap:in=${from.coinType}|out=${to.coinType}|src=${selectedSource}]]`;
    onSend?.(`swap ${amount.trim()} ${from.symbol} to ${to.symbol} via ${selectedSource} ${bind}`);
  }

  const activeQuote = sourceQuotes[selectedSource];
  const outDisplay = quotesLoading ? "…" : (activeQuote?.available && activeQuote.estimatedAmountOut)
    ? nativeToHuman(activeQuote.estimatedAmountOut, to.decimals)
    : null;
  const rate = outDisplay && amountValid
    ? `1 ${from.symbol} ≈ ${(Number(outDisplay) / Number(amount)).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${to.symbol}`
    : null;

  return (
    <div className="w-full" style={{ maxWidth: 420, border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-elev)", boxShadow: "var(--shadow-md)", padding: 14, opacity: submitted ? 0.7 : 1 }}>
      <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--accent-ink)", textTransform: "uppercase", marginBottom: 11 }}>Swap</div>

      <div style={{ position: "relative", display: "grid", gap: 6 }}>
        {/* You pay — with live balance + percentage shortcuts */}
        <div style={{ background: "var(--bg-sub)", border: "1px solid var(--border)", borderRadius: 13, padding: "11px 13px" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 7, gap: 8 }}>
            <span className="split-mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", color: "var(--fg-faint)", textTransform: "uppercase", flexShrink: 0 }}>You pay</span>
            {hasBalance && (
              <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                  {nativeToHuman(fromBalanceNative!, from.decimals)} {from.symbol}
                </span>
                {[["50%", 50], ["MAX", 100]].map(([label, pct]) => (
                  <button
                    key={label as string}
                    type="button"
                    onClick={() => applyPercent(pct as number)}
                    disabled={submitted}
                    className="split-mono"
                    style={{ fontSize: 9, letterSpacing: "0.04em", color: "var(--accent-ink)", background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", padding: "2px 6px", borderRadius: 6, cursor: submitted ? "default" : "pointer", flexShrink: 0 }}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              disabled={submitted}
              className="mono"
              style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", fontSize: 24, fontWeight: 650, color: "var(--fg)" }}
            />
            <TokenSelect coins={coins} value={from} exclude={to?.coinType} onChange={setFrom} />
          </div>
        </div>

        {/* Direction toggle */}
        <button
          type="button"
          onClick={flip}
          aria-label="Swap direction"
          className="flex items-center justify-center"
          style={{ position: "absolute", top: "calc(50% - 15px)", left: "calc(50% - 15px)", width: 30, height: 30, borderRadius: 9, background: "var(--bg-elev)", border: "2px solid var(--bg-elev)", outline: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", color: "var(--accent)", cursor: "pointer", zIndex: 2 }}
        >
          <ArrowDown size={15} aria-hidden />
        </button>

        <Panel label="You receive">
          <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: 24, fontWeight: 650, color: outDisplay ? "var(--fg)" : "var(--fg-faint)", overflow: "hidden", textOverflow: "ellipsis" }}>
            {quotesLoading ? "…" : (activeQuote?.available !== false ? (outDisplay ?? "0.0") : "—")}
          </span>
          <TokenSelect coins={coins} value={to} exclude={from?.coinType} onChange={setTo} />
        </Panel>
      </div>

      {/* Source selector — compare Cetus Aggregator vs Aftermath Router */}
      {(amountValid && !sameCoin) && (
        <SourceSelector
          sources={sourceQuotes}
          selected={selectedSource}
          toDecimals={to.decimals}
          onSelect={setSelectedSource}
        />
      )}

      {/* Rate line */}
      <div className="flex items-center justify-between" style={{ marginTop: 10, minHeight: 16 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
          {sameCoin ? "Pick two different tokens" : rate ?? (activeQuote?.available === false ? "No route for this pair" : "")}
        </span>
        {rate && <span className="split-mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: "0.06em" }}>INDICATIVE</span>}
      </div>

      {/* Route badge — shows chosen source + venues */}
      {rate && (
        <div className="flex items-center justify-between" style={{ marginTop: 8, gap: 8, padding: "8px 11px", borderRadius: 10, background: "var(--bg-sub)", border: "1px solid var(--border)" }}>
          <span className="flex items-center gap-1.5 split-mono shrink-0" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--fg-faint)", textTransform: "uppercase" }}>
            <Route size={11} aria-hidden /> Route · best execution
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${SOURCE_LABELS[selectedSource]}${activeQuote?.routeProviders?.length ? ` · ${activeQuote.routeProviders.join(" → ")}` : ""}`}>
            {SOURCE_LABELS[selectedSource]}{activeQuote?.routeProviders?.length ? ` · ${activeQuote.routeProviders.join(" → ")}` : ""}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="flex items-center justify-center gap-2"
        style={{ marginTop: 11, width: "100%", height: 44, borderRadius: 12, border: "none", background: canSubmit ? "var(--accent)" : "var(--bg-sub)", color: canSubmit ? "#fff" : "var(--fg-faint)", fontSize: 14.5, fontWeight: 650, cursor: canSubmit ? "pointer" : "default", boxShadow: canSubmit ? "var(--shadow-aqua)" : "none" }}
      >
        {submitted ? "Submitted" : sameCoin ? "Select tokens" : !amountValid ? "Enter an amount" : "Review swap"}
      </button>
    </div>
  );
}
