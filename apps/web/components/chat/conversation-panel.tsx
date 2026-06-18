"use client";

/**
 * ConversationPanel — presentational saved-conversation history shown BESIDE the
 * chat thread (not in the global side menu — conversations are a chat-only concern).
 *
 * Stateless: the conversation list + persistence live in the chat shell (so saving
 * keeps working while the panel is collapsed/hidden). When collapsed the shell
 * unmounts this entirely and shows a small expand button in the chat column.
 *
 * Desktop only (md+) — on mobile the chat takes the full width.
 */

import { PanelLeftClose, Plus } from "lucide-react";
import { SessionList, type SessionEntry } from "@/components/app/session-list";

interface ConversationPanelProps {
  sessions: SessionEntry[];
  activeId: string | null;
  loadingId?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onNewConversation: () => void;
  /** Collapse (fully hide) the panel. */
  onCollapse: () => void;
}

export function ConversationPanel({
  sessions,
  activeId,
  loadingId = null,
  onSelect,
  onDelete,
  onClearAll,
  onNewConversation,
  onCollapse,
}: ConversationPanelProps) {
  return (
    <aside
      className="hidden md:flex flex-col gap-2"
      style={{
        width: "232px",
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        // Blend with the page canvas (--bg) instead of the grayer --bg-sub.
        background: "var(--bg)",
        padding: "14px 12px",
        minHeight: 0,
      }}
    >
      {/* Header: label + collapse (inside the conversation area) */}
      <div className="flex items-center justify-between">
        <span className="split-mono" style={{ fontSize: "9.5px", color: "var(--fg-faint)", letterSpacing: "0.12em" }}>
          conversations
        </span>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Hide conversations"
          title="Hide conversations"
          className="flex items-center justify-center transition-colors"
          style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elev)", color: "var(--fg-muted)", cursor: "pointer", flexShrink: 0 }}
        >
          <PanelLeftClose size={15} aria-hidden />
        </button>
      </div>

      <button
        type="button"
        onClick={onNewConversation}
        className="flex items-center gap-2 rounded-lg font-semibold transition-opacity hover:opacity-90"
        style={{ height: "36px", padding: "0 12px", background: "var(--accent)", color: "#fff", border: "none", fontSize: "13px", boxShadow: "var(--shadow-aqua)", cursor: "pointer", flexShrink: 0 }}
      >
        <Plus size={14} aria-hidden />
        New conversation
      </button>

      <SessionList
        sessions={sessions}
        activeId={activeId}
        loadingId={loadingId}
        onSelect={onSelect}
        onDelete={onDelete}
        onClearAll={onClearAll}
      />
    </aside>
  );
}
