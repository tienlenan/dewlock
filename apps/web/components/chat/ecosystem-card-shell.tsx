"use client";

/**
 * Shared scaffolding for the three Sui-ecosystem discovery cards (yields / TVL /
 * tokens). Owns the self-fetch hook, the loading / empty / error+retry states,
 * the attribution badge ("via {source} · {asOf}", stale-aware), the not-financial-
 * advice footer, and the "View all ↗" deep link — so each card stays presentational.
 *
 * Visual tokens mirror components/protocols/protocol-list.tsx so the cards read as
 * native (no new design system). All outbound links are noopener/noreferrer.
 */

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { fetchJsonWithRetry } from "@/lib/fetch-with-retry";
import { relativeTime } from "@/lib/ecosystem/format";
import type { EcosystemEnvelope } from "@/lib/ecosystem/types";

export type EcosystemState = "loading" | "ready" | "empty" | "error";

interface UseEcosystemResult<T> {
  state: EcosystemState;
  items: T[];
  asOf?: string;
  source?: string;
  stale?: boolean;
  retry: () => void;
}

/** Self-fetch a /api/ecosystem/* route → discriminated render state. */
export function useEcosystemData<T>(url: string): UseEcosystemResult<T> {
  const [env, setEnv] = useState<EcosystemEnvelope<T> | null>(null);
  const [errored, setErrored] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setEnv(null);
    setErrored(false);
    // Auto-retry (cold serverless path can exceed one attempt); manual Retry below.
    fetchJsonWithRetry<EcosystemEnvelope<T>>(url, { attempts: 3, timeoutMs: 9000, signal: ctrl.signal })
      .then((d) => { if (!cancelled) setEnv(d); })
      .catch(() => { if (!cancelled && !ctrl.signal.aborted) setErrored(true); });
    return () => { cancelled = true; ctrl.abort(); };
  }, [url, reloadKey]);

  const retry = useCallback(() => {
    setEnv(null);
    setErrored(false);
    setReloadKey((k) => k + 1);
  }, []);

  if (errored) return { state: "error", items: [], retry };
  if (!env) return { state: "loading", items: [], retry };
  if ("unavailable" in env) return { state: "error", items: [], retry };
  return {
    state: env.items.length === 0 ? "empty" : "ready",
    items: env.items,
    asOf: env.asOf,
    source: env.source,
    stale: env.stale,
    retry,
  };
}

function Attribution({ source, asOf, stale }: { source?: string; asOf?: string; stale?: boolean }) {
  const rel = relativeTime(asOf);
  if (stale) {
    return (
      <span title="Served from cache after a brief source hiccup" style={{ fontSize: 10, color: "var(--warning)", whiteSpace: "nowrap" }}>
        updated {rel || "a while ago"}
      </span>
    );
  }
  if (!source) return null;
  return (
    <span style={{ fontSize: 10, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
      via {source}{rel ? ` · ${rel}` : ""}
    </span>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
          <div style={{ flex: 1, height: 11, borderRadius: 4, background: "var(--bg-sub)" }} />
          <div style={{ width: 56, height: 11, borderRadius: 4, background: "var(--bg-sub)" }} />
        </div>
      ))}
    </div>
  );
}

function StatusRow({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2.5" style={{ padding: "18px", borderTop: "1px solid var(--border)", color: "var(--fg-muted)", fontSize: 13 }}>
      <span>{text}</span>
      <button
        type="button"
        onClick={onRetry}
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

/** A clickable row → external page (noopener), with a trailing ↗ affordance. */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderTop: "1px solid var(--border)", textDecoration: "none", color: "var(--fg)" }}
    >
      {children}
      <span aria-hidden style={{ fontSize: 11, color: "var(--fg-faint)", flexShrink: 0 }}>↗</span>
    </a>
  );
}

/** Logo (protocol icon / token image) with a lettered fallback when the source
 *  image is missing or 404s. Shared by the TVL + tokens cards. */
export function EcoLogo({ src, label, size = 24 }: { src: string | null; label: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const letter = (label || "?").charAt(0).toUpperCase();
  if (!src || broken) {
    return (
      <div
        aria-hidden
        style={{ width: size, height: size, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.46), fontWeight: 700, flexShrink: 0 }}
      >
        {letter}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setBroken(true)}
      style={{ width: size, height: size, borderRadius: 999, flexShrink: 0, objectFit: "cover", background: "var(--bg-sub)" }}
    />
  );
}

/** Right-aligned rank index. */
export function Rank({ n }: { n: number }) {
  return (
    <span className="split-mono" style={{ width: 16, textAlign: "right", fontSize: 11, color: "var(--fg-faint)", flexShrink: 0 }}>
      {n}
    </span>
  );
}

interface ShellProps {
  title: string;
  source?: string;
  asOf?: string;
  stale?: boolean;
  state: EcosystemState;
  onRetry: () => void;
  footerLabel: string;
  footerHref: string;
  emptyText: string;
  errorText?: string;
  loadingRows?: number;
  children?: ReactNode;
}

export function EcosystemCardShell({
  title, source, asOf, stale, state, onRetry, footerLabel, footerHref, emptyText, errorText, loadingRows, children,
}: ShellProps) {
  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 560, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>{title}</div>
        <Attribution source={source} asOf={asOf} stale={stale} />
      </div>

      {state === "loading" && <SkeletonRows n={loadingRows ?? 5} />}
      {state === "error" && <StatusRow text={errorText ?? "Couldn’t load this right now."} onRetry={onRetry} />}
      {state === "empty" && <StatusRow text={emptyText} onRetry={onRetry} />}
      {state === "ready" && <div>{children}</div>}

      <div style={{ borderTop: "1px solid var(--border)", padding: "9px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10.5, color: "var(--fg-faint)", lineHeight: 1.4 }}>
          Informational only, not financial advice — APYs and prices are volatile.
        </div>
        <a
          href={footerHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11.5, color: "var(--accent-ink)", textDecoration: "none", fontWeight: 600 }}
        >
          {footerLabel} ↗
        </a>
      </div>
    </div>
  );
}
