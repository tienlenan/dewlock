"use client";

/**
 * SessionList — sidebar conversation history.
 *
 * Renders REAL persisted conversations (Walrus-backed, per-wallet) passed from
 * the app shell. The active session is highlighted; each row can be deleted.
 * Honest empty state when there are none (or persistence is unavailable).
 */

import { Trash2, Loader2 } from "lucide-react";

export interface SessionEntry {
  id: string;
  title: string;
}

interface SessionListProps {
  sessions: SessionEntry[];
  activeId?: string | null;
  /** The conversation currently loading (shows a spinner on its row). */
  loadingId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClearAll?: () => void;
}

export function SessionList({ sessions, activeId = null, loadingId = null, onSelect, onDelete, onClearAll }: SessionListProps) {
  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ minHeight: 0 }}>
      <div className="flex items-center justify-between px-2 pb-1.5 pt-3.5">
        <span
          className="split-mono"
          style={{ fontSize: "9.5px", color: "var(--fg-faint)", letterSpacing: "0.14em" }}
        >
          Recent
        </span>
        {onClearAll && sessions.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="split-mono transition-colors"
            style={{ fontSize: "9.5px", color: "var(--fg-faint)", letterSpacing: "0.1em" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--destructive)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-faint)"; }}
            title="Delete all saved conversations"
          >
            Clear all
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div style={{ padding: "8px 11px", fontSize: "11.5px", color: "var(--fg-faint)", lineHeight: 1.45 }}>
          No saved conversations yet.
        </div>
      ) : (
        sessions.map((s) => {
          const isActive = s.id === activeId;
          const isLoading = s.id === loadingId;
          return (
            <div
              key={s.id}
              className="group flex items-center gap-1 rounded-lg"
              style={{
                background: isActive ? "var(--bg-elev)" : "transparent",
                border: isActive ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              <button
                type="button"
                onClick={() => onSelect?.(s.id)}
                className="flex-1 flex items-center gap-2 text-left rounded-lg px-3 py-2.5 text-sm transition-colors min-w-0"
                style={{ color: isActive ? "var(--fg)" : "var(--fg-muted)", fontWeight: isActive ? 500 : 400 }}
                title={s.title}
              >
                {isLoading && <Loader2 size={13} className="shrink-0 animate-spin" style={{ color: "var(--accent)" }} aria-hidden />}
                <span className="truncate">{s.title}</span>
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  aria-label={`Delete conversation: ${s.title}`}
                  className="flex shrink-0 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded px-1.5 py-1"
                  style={{ color: "var(--fg-faint)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--destructive)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-faint)"; }}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
