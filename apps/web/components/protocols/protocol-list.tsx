"use client";

/**
 * ProtocolList — Dewlock's protocol registry surface.
 *
 * Renders the security posture of every Sui DeFi protocol Dewlock knows about:
 * which are ACTIVE (and whether an adapter is built so their Move targets feed
 * the enforced allowlist) vs EXCLUDED (hacked / off-model — listed for honesty,
 * never built, contribute no targets). Each excluded entry shows its incident.
 *
 * Reads GET /api/protocols. Pure presentation of public posture data.
 */

import { useEffect, useState, useCallback } from "react";
import { fetchJsonWithRetry } from "@/lib/fetch-with-retry";

interface Incident {
  date: string;
  amountUsd?: number;
  rootCauseClass?: string;
  summary?: string;
}

export interface ProtocolDto {
  id: string;
  name: string;
  category: string;
  status: "active" | "listed-excluded" | "hacked";
  buildState: "built" | "deferred" | "excluded";
  sdkPackage?: string;
  lastIncident?: Incident;
  guardianNotes?: string;
  targetCount: number;
}

export interface ApiResponse {
  active: ProtocolDto[];
  excluded: ProtocolDto[];
}

function Badge({
  label,
  tone,
  title,
}: {
  label: string;
  tone: "success" | "accent" | "muted" | "warning" | "danger";
  title?: string;
}) {
  const map: Record<string, { fg: string; bg: string; bd: string }> = {
    success: { fg: "var(--success)", bg: "color-mix(in srgb, var(--success) 12%, transparent)", bd: "color-mix(in srgb, var(--success) 30%, transparent)" },
    accent: { fg: "var(--accent-ink)", bg: "var(--accent-soft)", bd: "color-mix(in srgb, var(--accent) 25%, transparent)" },
    warning: { fg: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 12%, transparent)", bd: "color-mix(in srgb, var(--warning) 30%, transparent)" },
    danger: { fg: "var(--destructive)", bg: "color-mix(in srgb, var(--destructive) 12%, transparent)", bd: "color-mix(in srgb, var(--destructive) 35%, transparent)" },
    muted: { fg: "var(--fg-muted)", bg: "var(--bg-sub)", bd: "var(--border)" },
  };
  const c = map[tone];
  return (
    <span
      className="split-mono shrink-0"
      title={title}
      style={{ fontSize: "10px", color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: "2px 8px", borderRadius: 99 }}
    >
      {label}
    </span>
  );
}

function ProtocolRow({ p }: { p: ProtocolDto }) {
  const statusTone = p.status === "active" ? "success" : p.status === "hacked" ? "danger" : "warning";
  const statusLabel = p.status === "active" ? "active" : p.status === "hacked" ? "hacked" : "excluded";
  return (
    <div className="flex items-start gap-3" style={{ padding: "13px 18px", borderTop: "1px solid var(--border)" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ fontSize: "14px", fontWeight: 650, color: "var(--fg)" }}>{p.name}</span>
          <Badge label={p.category} tone="muted" />
          {p.status === "active" && p.buildState === "built" && (
            <Badge label={`enforced · ${p.targetCount} targets`} tone="accent" title="Move targets feed the enforced allowlist" />
          )}
          {p.status === "active" && p.buildState === "deferred" && (
            <Badge label="adapter pending" tone="muted" title="recognized + audit-clean; no adapter built yet" />
          )}
        </div>
        {p.lastIncident && (
          <div className="mono" style={{ fontSize: "11px", color: "var(--fg-muted)", marginTop: 4 }}>
            incident {p.lastIncident.date}
            {p.lastIncident.amountUsd ? ` · ~$${(p.lastIncident.amountUsd / 1_000_000).toFixed(p.lastIncident.amountUsd % 1_000_000 === 0 ? 0 : 1)}M` : ""}
            {p.lastIncident.rootCauseClass ? ` · ${p.lastIncident.rootCauseClass}` : ""}
          </div>
        )}
        {p.guardianNotes && (
          <p style={{ fontSize: "11.5px", color: "var(--fg-faint)", margin: "4px 0 0", lineHeight: 1.45 }}>{p.guardianNotes}</p>
        )}
      </div>
      <Badge label={statusLabel} tone={statusTone} />
    </div>
  );
}

function Section({ title, subtitle, items }: { title: string; subtitle: string; items: ProtocolDto[] }) {
  return (
    <div className="w-full overflow-hidden" style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}>
      <div style={{ padding: "16px 18px 12px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg)" }}>{title}</div>
        <div className="split-mono" style={{ fontSize: "10px", letterSpacing: "0.1em", color: "var(--fg-muted)", marginTop: 3 }}>{subtitle}</div>
      </div>
      {items.map((p) => (
        <ProtocolRow key={p.id} p={p} />
      ))}
    </div>
  );
}

export function ProtocolList({ data: initial }: { data?: ApiResponse } = {}) {
  const [data, setData] = useState<ApiResponse | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bumped by the Retry button

  useEffect(() => {
    if (initial) return; // data supplied (e.g. from a chat tool result) — skip the fetch
    let cancelled = false;
    const ctrl = new AbortController();
    setError(null);
    // Auto-retry up to 3× (cold path can exceed the per-attempt timeout); manual Retry below.
    fetchJsonWithRetry<ApiResponse>("/api/protocols", { attempts: 3, timeoutMs: 8000, signal: ctrl.signal })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled && !ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Failed to load"); });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [initial, reloadKey]);

  const retry = useCallback(() => { setData(null); setError(null); setReloadKey((k) => k + 1); }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3" style={{ padding: "24px", textAlign: "center", color: "var(--destructive)", fontSize: 13 }}>
        <span>Couldn’t load the protocol registry.</span>
        <button
          type="button"
          onClick={retry}
          className="split-mono transition-colors"
          style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--fg-muted)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 12px" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)"; }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="split-mono" style={{ padding: "24px", textAlign: "center", color: "var(--fg-faint)", fontSize: 11, letterSpacing: "0.1em" }}>
        loading registry…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: 560, width: "100%" }}>
      <Section
        title="Active protocols"
        subtitle={`${data.active.length} listed · only built adapters enforce targets`}
        items={data.active}
      />
      <Section
        title="Excluded protocols"
        subtitle={`${data.excluded.length} listed · hacked or off-model · never built`}
        items={data.excluded}
      />
    </div>
  );
}
