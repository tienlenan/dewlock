"use client";

/**
 * Presentational chat primitives for the onboarding demo overlay — a faithful copy of
 * the real ChatThread's user bubble + assistant avatar row (chat-thread.tsx), so the
 * demo looks pixel-identical without importing the live thread (which wires signing).
 * Pure display: no hooks, no callbacks that execute anything.
 */

import type { ReactNode } from "react";

/** Dewdrop avatar — copied from ChatThread's local DewdropAvatar (it isn't exported). */
export function DemoAvatar({ variant = "normal" }: { variant?: "normal" | "blocked" }) {
  const bg =
    variant === "blocked"
      ? "color-mix(in srgb, var(--destructive) 14%, transparent)"
      : "var(--accent-soft)";
  const fill = variant === "blocked" ? "var(--destructive)" : "var(--accent)";
  return (
    <div
      className="shrink-0 flex items-center justify-center"
      style={{ width: 30, height: 30, borderRadius: 9, background: bg }}
      aria-hidden
    >
      <svg width="13" height="21" viewBox="0 0 16 26" fill="none">
        <path d="M8 2C8 2 2 8.5 2 13a6 6 0 0 0 12 0C14 8.5 8 2 8 2Z" fill={fill} />
        {variant === "normal" && (
          <rect x="5" y="15" width="6" height="6" rx="1.2" fill="var(--accent-soft)" stroke={fill} strokeWidth="1.5" />
        )}
      </svg>
    </div>
  );
}

/** Right-aligned user message bubble — matches ChatThread's user row. */
export function DemoUserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        style={{
          maxWidth: "78%",
          background: "var(--accent-soft)",
          color: "var(--accent-ink)",
          padding: "10px 14px",
          borderRadius: "14px 14px 4px 14px",
          fontSize: "14px",
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** Assistant row — avatar + text + cards, matches ChatThread's assistant message. */
export function DemoAssistantRow({
  text,
  blocked = false,
  children,
}: {
  text: string;
  blocked?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <DemoAvatar variant={blocked ? "blocked" : "normal"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="dewlock-md"
          style={{ fontSize: "14px", color: "var(--fg)", marginBottom: 10, lineHeight: 1.55, overflowWrap: "anywhere" }}
        >
          {text}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}
