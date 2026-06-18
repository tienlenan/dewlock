"use client";

/**
 * MemoryCategoryCard — one memory category: label, description, approximate count,
 * sample entries, and a clear action (only when clearable; otherwise an honest
 * "permanent" note). Presentational — the view owns fetch + signature + clear.
 */

import { Trash2, Lock, Loader2 } from "lucide-react";

export interface MemoryCategoryDto {
  key: string;
  label: string;
  description: string;
  scope: "global" | "user";
  clearable: boolean;
  permanentReason: string | null;
  approxCount: number;
  samples: string[];
}

export function MemoryCategoryCard({
  category,
  clearing,
  onClear,
}: {
  category: MemoryCategoryDto;
  clearing: boolean;
  onClear: (key: string) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--bg-elev)",
        padding: 14,
        display: "grid",
        gap: 8,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>{category.label}</div>
          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.45, marginTop: 2 }}>{category.description}</div>
        </div>
        <span
          className="split-mono"
          style={{ fontSize: 10, color: "var(--fg-faint)", whiteSpace: "nowrap", paddingTop: 2 }}
          title="Approximate — the memory layer has no exact enumerate API"
        >
          ~{category.approxCount}
        </span>
      </div>

      {category.samples.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 3 }}>
          {category.samples.map((s, i) => (
            <li
              key={i}
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--fg-faint)",
                borderLeft: "2px solid var(--border)",
                paddingLeft: 8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-end" style={{ marginTop: 2 }}>
        {category.clearable ? (
          <button
            type="button"
            onClick={() => onClear(category.key)}
            disabled={clearing}
            className="flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 11.5,
              color: clearing ? "var(--fg-faint)" : "var(--destructive)",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "4px 10px",
              cursor: clearing ? "default" : "pointer",
            }}
          >
            {clearing ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Trash2 size={12} aria-hidden />}
            {clearing ? "Clearing…" : "Clear"}
          </button>
        ) : (
          <span className="flex items-center gap-1.5" style={{ fontSize: 10.5, color: "var(--fg-faint)" }} title={category.permanentReason ?? ""}>
            <Lock size={11} aria-hidden />
            {category.permanentReason ?? "Permanent"}
          </span>
        )}
      </div>
    </div>
  );
}
