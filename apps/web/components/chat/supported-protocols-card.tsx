"use client";

/**
 * SupportedProtocolsCard — compact "what Dewlock can route through" card for the empty
 * thread. Sourced from /api/protocols (the registry SSOT), filtered to active + built —
 * the same protocols whose Move targets feed the enforced allowlist. Real brand logos via
 * <ProtocolLogo> (img-first, inline-mark/monogram fallback). "View all" opens the full
 * registry card. Display-only.
 */

import { useEffect, useState } from "react";
import { ProtocolLogo } from "./asset-logos";
import type { ApiResponse, ProtocolDto } from "@/components/protocols/protocol-list";

interface SupportedProtocol {
  id: string;
  name: string;
  category: string;
}

// Last-resort render list if /api/protocols is unreachable. Mirrors the active+built set
// in protocol-registry-data.ts; the live fetch is authoritative when it succeeds.
const FALLBACK: SupportedProtocol[] = [
  { id: "cetus", name: "Cetus", category: "dex" },
  { id: "deepbook", name: "DeepBook V3", category: "dex" },
  { id: "cetus-aggregator", name: "Cetus Aggregator", category: "aggregator" },
  { id: "aftermath", name: "Aftermath", category: "aggregator" },
  { id: "navi", name: "NAVI", category: "lending" },
  { id: "suilend", name: "Suilend", category: "lending" },
  { id: "wormhole", name: "Wormhole", category: "bridge" },
];

/** Project the registry's active list to only active + built protocols (exported for tests). */
export function toSupported(active: ProtocolDto[]): SupportedProtocol[] {
  return active
    .filter((p) => p.status === "active" && p.buildState === "built")
    .map((p) => ({ id: p.id, name: p.name, category: p.category }));
}

export function SupportedProtocolsCard({ onSend }: { onSend?: (text: string) => void }) {
  const [items, setItems] = useState<SupportedProtocol[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch("/api/protocols", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ApiResponse) => {
        if (!cancelled && Array.isArray(d.active)) setItems(toSupported(d.active));
      })
      .catch(() => {
        /* keep FALLBACK */
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--bg-elev)",
        overflow: "hidden",
      }}
    >
      <div className="flex items-center justify-between" style={{ padding: "12px 14px 8px" }}>
        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--fg)" }}>Supported protocols</span>
        {onSend && (
          <button
            type="button"
            onClick={() => onSend("protocols")}
            style={{ fontSize: "11.5px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            View all →
          </button>
        )}
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, padding: "0 14px 14px" }}
      >
        {items.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2.5"
            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-sub)" }}
          >
            <ProtocolLogo id={p.id} size={26} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </span>
              <span className="split-mono" style={{ display: "block", fontSize: "9.5px", letterSpacing: "0.08em", color: "var(--fg-muted)" }}>
                {p.category}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
