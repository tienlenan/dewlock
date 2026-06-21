"use client";

/**
 * LimitOrderFormCard — DeepBook limit-order picker rendered when the user types a
 * bare/partial "place limit order". Layout: a pair selector (whitelisted pools), a
 * BUY/SELL toggle, a price input (quote/base), an amount input (base), an expiry
 * selector, and a CTA that composes a COMPLETE `limit <side> <qty> <base> at <price>
 * <quote> on <POOL>` command (carrying a deterministic [[limit:…]] marker) → prepareTrade.
 *
 * This card never builds or signs — the Guardian re-validates tick/lot + USD caps and
 * the tx-preview shows the live mid-price before the user confirms.
 */

import { useMemo, useState } from "react";
import { CoinLogo } from "./asset-logos";

export interface LimitPoolCoin {
  symbol: string;
  coinType: string;
  decimals: number;
  logoUrl?: string;
}

export interface LimitPool {
  poolKey: string;
  base: LimitPoolCoin;
  quote: LimitPoolCoin;
}

export interface LimitOrderFormData {
  pools: LimitPool[];
  defaultExpiryDays: number;
  poolKey?: string;
  side?: "BUY" | "SELL";
}

const EXPIRY_OPTIONS: Array<{ label: string; days: number }> = [
  { label: "1D", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
];

const isPositiveNum = (s: string) => /^\d+(\.\d+)?$/.test(s.trim()) && Number(s) > 0;

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  render,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => React.ReactNode;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className="flex-1"
            style={{
              padding: "7px 10px",
              borderRadius: 10,
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              background: active ? "var(--accent-soft)" : "var(--bg-sub)",
              color: active ? "var(--fg)" : "var(--fg-muted)",
              fontSize: 12.5,
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            {render(opt)}
          </button>
        );
      })}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="split-mono"
      style={{ fontSize: 9.5, letterSpacing: "0.12em", color: "var(--fg-faint)", textTransform: "uppercase", marginBottom: 6 }}
    >
      {children}
    </div>
  );
}

export function LimitOrderFormCard({ data, onSend }: { data: LimitOrderFormData; onSend?: (text: string) => void }) {
  const pools = data.pools;
  const byKey = useMemo(() => new Map(pools.map((p) => [p.poolKey, p])), [pools]);

  const [poolKey, setPoolKey] = useState<string>(
    (data.poolKey && byKey.has(data.poolKey) ? data.poolKey : pools[0]?.poolKey) ?? "",
  );
  const [side, setSide] = useState<"BUY" | "SELL">(data.side ?? "BUY");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [expiryDays, setExpiryDays] = useState<number>(data.defaultExpiryDays || 7);
  const [submitted, setSubmitted] = useState(false);

  const pool = byKey.get(poolKey) ?? pools[0];
  const priceValid = isPositiveNum(price);
  const qtyValid = isPositiveNum(qty);
  const canSubmit = !!pool && priceValid && qtyValid && !submitted;

  const notional = priceValid && qtyValid ? Number(price) * Number(qty) : null;

  function submit() {
    if (!canSubmit || !pool) return;
    setSubmitted(true);
    const p = price.trim();
    const q = qty.trim();
    // Absolute expiry (unix ms) — computed client-side so the order carries a concrete deadline.
    const exp = Date.now() + expiryDays * 86_400_000;
    // The trailing marker carries the EXACT pool/side/price/qty/expiry so the server binds
    // the order deterministically (the LLM never re-parses); stripped from the visible bubble.
    const bind = `[[limit:pool=${pool.poolKey}|side=${side}|price=${p}|qty=${q}|exp=${exp}]]`;
    onSend?.(`limit ${side} ${q} ${pool.base.symbol} at ${p} ${pool.quote.symbol} on ${pool.poolKey} ${bind}`);
  }

  return (
    <div
      className="w-full"
      style={{ maxWidth: 420, border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-elev)", boxShadow: "var(--shadow-md)", padding: 14, opacity: submitted ? 0.7 : 1 }}
    >
      <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--accent-ink)", textTransform: "uppercase", marginBottom: 11 }}>
        DeepBook Limit Order
      </div>

      {/* Pair selector */}
      <FieldLabel>Pair</FieldLabel>
      <Segmented
        options={pools.map((p) => p.poolKey)}
        value={poolKey}
        onChange={setPoolKey}
        render={(key) => {
          const p = byKey.get(key)!;
          return (
            <span className="flex items-center justify-center gap-1.5">
              <CoinLogo symbol={p.base.symbol} logoUrl={p.base.logoUrl} size={16} />
              {p.base.symbol}/{p.quote.symbol}
            </span>
          );
        }}
      />

      {/* Side toggle */}
      <div style={{ marginTop: 12 }}>
        <FieldLabel>Side</FieldLabel>
        <Segmented
          options={["BUY", "SELL"] as const}
          value={side}
          onChange={setSide}
          render={(s) => (
            <span style={{ color: !submitted ? (s === side ? (s === "BUY" ? "var(--success)" : "var(--destructive)") : "var(--fg-muted)") : undefined }}>
              {s}
            </span>
          )}
        />
      </div>

      {/* Price + amount */}
      {pool && (
        <div className="flex gap-2" style={{ marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Price ({pool.quote.symbol})</FieldLabel>
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.0"
              disabled={submitted}
              className="mono"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", background: "var(--bg-sub)", borderRadius: 10, padding: "9px 11px", outline: "none", fontSize: 16, fontWeight: 600, color: "var(--fg)" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Amount ({pool.base.symbol})</FieldLabel>
            <input
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0.0"
              disabled={submitted}
              className="mono"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", background: "var(--bg-sub)", borderRadius: 10, padding: "9px 11px", outline: "none", fontSize: 16, fontWeight: 600, color: "var(--fg)" }}
            />
          </div>
        </div>
      )}

      {/* Expiry */}
      <div style={{ marginTop: 12 }}>
        <FieldLabel>Expires in</FieldLabel>
        <Segmented
          options={EXPIRY_OPTIONS.map((o) => o.days)}
          value={expiryDays}
          onChange={setExpiryDays}
          render={(days) => EXPIRY_OPTIONS.find((o) => o.days === days)?.label ?? `${days}D`}
        />
      </div>

      {/* Notional + POST_ONLY note */}
      <div className="flex items-center justify-between" style={{ marginTop: 11, minHeight: 16 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
          {pool && notional != null ? `≈ ${notional.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${pool.quote.symbol}` : ""}
        </span>
        <span className="split-mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: "0.06em" }}>POST_ONLY · MAKER</span>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="flex items-center justify-center"
        style={{ marginTop: 11, width: "100%", height: 44, borderRadius: 12, border: "none", background: canSubmit ? "var(--accent)" : "var(--bg-sub)", color: canSubmit ? "#fff" : "var(--fg-faint)", fontSize: 14.5, fontWeight: 650, cursor: canSubmit ? "pointer" : "default", boxShadow: canSubmit ? "var(--shadow-aqua)" : "none" }}
      >
        {submitted ? "Submitted" : !priceValid ? "Enter a price" : !qtyValid ? "Enter an amount" : "Review order"}
      </button>
    </div>
  );
}
