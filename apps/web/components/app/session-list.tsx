"use client";

/**
 * SessionList — sidebar session history entries.
 *
 * SAMPLE/PREVIEW data only — sessions are not persisted on the backend yet
 * (persistence is a future roadmap item). Entries are clearly labeled as
 * sample to avoid presenting them as real on-chain state.
 *
 * The active session is distinguished with an elevated bg and "active session" label.
 */

export interface SessionEntry {
  id: string;
  label: string;
  active?: boolean;
}

// Sample entries matching the mockup — labeled as non-live
const SAMPLE_SESSIONS: SessionEntry[] = [
  { id: "active", label: "Portfolio & swap", active: true },
  { id: "lp-review", label: "SUI/USDC LP review" },
  { id: "blocked", label: "Near-miss · blocked transfer" },
];

interface SessionListProps {
  /** Called when a session entry is clicked. No-op until sessions are persisted. */
  onSelect?: (id: string) => void;
}

export function SessionList({ onSelect }: SessionListProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {/* Section label — matches mockup "RECENT" mono cap */}
      <div
        className="split-mono px-2 pb-1.5 pt-3.5"
        style={{ fontSize: "9.5px", color: "var(--fg-faint)", letterSpacing: "0.14em" }}
      >
        Recent
      </div>

      {SAMPLE_SESSIONS.map((session) =>
        session.active ? (
          /* Active session — elevated bg + sub-label */
          <div
            key={session.id}
            className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2.5"
            style={{ background: "var(--bg-elev)" }}
          >
            <span className="text-sm text-fg font-medium leading-snug">{session.label}</span>
            <span style={{ fontSize: "11px", color: "var(--fg-faint)" }}>active session</span>
          </div>
        ) : (
          /* Inactive session entry */
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect?.(session.id)}
            className="text-left rounded-lg px-3 py-2.5 text-sm transition-colors"
            style={{ color: "var(--fg-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-elev)";
              (e.currentTarget as HTMLElement).style.color = "var(--fg)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "";
              (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)";
            }}
          >
            {session.label}
          </button>
        ),
      )}

      {/* Preview label — honest disclosure */}
      <div
        className="mt-1 px-2 py-1 rounded"
        style={{ fontSize: "10px", color: "var(--fg-faint)" }}
      >
        sample · session history coming soon
      </div>
    </div>
  );
}
