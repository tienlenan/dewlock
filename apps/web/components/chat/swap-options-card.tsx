"use client";

/**
 * SwapOptionsCard — renders getSwapOptions results so the user picks a venue.
 *
 * Display-first: shows each source's estimated output + route + the best pick.
 * If `onChoose` is provided, a "Use this source" button sends a follow-up that
 * drives prepareTrade with the chosen swapSource (value path stays in the
 * Guardian). Read-only otherwise — this card never builds or signs.
 */

export interface SwapOption {
  source: "cetus" | "aggregator";
  available: boolean;
  estimatedAmountOut?: string;
  minAmountOut?: string;
  routeProviders?: string[];
  error?: string;
}

export interface SwapOptionsData {
  coinTypeIn: string;
  coinTypeOut: string;
  amountInNative: string;
  options: SwapOption[];
  best?: "cetus" | "aggregator";
}

export interface SwapOptionsCardProps {
  data: SwapOptionsData;
  /** Optional: pick a source → sends a follow-up swap with that swapSource. */
  onChoose?: (source: "cetus" | "aggregator") => void;
}

const DECIMALS: Record<string, number> = {
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI": 9,
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": 6,
  "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT": 6,
};
function ticker(t: string): string {
  return t.split("::").pop() ?? t;
}
function human(native: string | undefined, coinType: string): string {
  if (!native) return "—";
  const d = DECIMALS[coinType] ?? 9;
  return (Number(BigInt(native)) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: 6 });
}
const SOURCE_LABEL: Record<string, string> = { cetus: "Cetus (direct)", aggregator: "Aggregator (best route)" };

export function SwapOptionsCard({ data, onChoose }: SwapOptionsCardProps) {
  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <span className="split-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-muted)" }}>
          Swap options · {human(data.amountInNative, data.coinTypeIn)} {ticker(data.coinTypeIn)} → {ticker(data.coinTypeOut)}
        </span>
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {data.options.map((o) => {
          const isBest = o.available && data.best === o.source;
          return (
            <div
              key={o.source}
              className="flex items-center justify-between"
              style={{
                padding: "11px 13px",
                borderRadius: 10,
                border: isBest ? "1px solid color-mix(in srgb, var(--accent) 45%, transparent)" : "1px solid var(--border)",
                background: isBest ? "var(--accent-soft)" : "var(--bg-sub)",
                opacity: o.available ? 1 : 0.55,
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 13, fontWeight: 650, color: "var(--fg)" }}>{SOURCE_LABEL[o.source]}</span>
                  {isBest && (
                    <span className="split-mono" style={{ fontSize: 9, color: "var(--accent-ink)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", padding: "1px 6px", borderRadius: 99 }}>
                      best
                    </span>
                  )}
                </div>
                {o.available ? (
                  <div className="mono" style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                    ~{human(o.estimatedAmountOut, data.coinTypeOut)} {ticker(data.coinTypeOut)}
                    {o.routeProviders?.length ? ` · ${o.routeProviders.join(" → ")}` : ""}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>unavailable</div>
                )}
              </div>
              {o.available && onChoose && (
                <button
                  type="button"
                  onClick={() => onChoose(o.source)}
                  className="split-mono shrink-0"
                  style={{ fontSize: 10, color: "var(--accent-ink)", background: "var(--bg-elev)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", padding: "5px 10px", borderRadius: 8, cursor: "pointer" }}
                >
                  Use this
                </button>
              )}
            </div>
          );
        })}
        {!onChoose && (
          <p style={{ fontSize: 11, color: "var(--fg-faint)", margin: "2px 0 0" }}>
            Say e.g. “swap via {data.best ?? "aggregator"}” to proceed — the Guardian re-derives min-out from that source.
          </p>
        )}
      </div>
    </div>
  );
}
