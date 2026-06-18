"use client";

/**
 * MentionMenu — friends context menu shown when typing `@` in the composer.
 * Pure presentation: the parent owns the filtered items, active index, and selection.
 * Anchored above the input. Keyboard nav (↑/↓/Enter/Tab/Esc) is handled by the parent.
 */

import { truncateAddress } from "@/lib/chat/recipient-detect";
import type { MentionContact } from "@/lib/chat/mention";

interface MentionMenuProps {
  items: MentionContact[];
  activeIndex: number;
  onSelect: (contact: MentionContact) => void;
  onHover: (index: number) => void;
}

export function MentionMenu({ items, activeIndex, onSelect, onHover }: MentionMenuProps) {
  return (
    <div
      role="listbox"
      aria-label="Friends"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "calc(100% + 6px)",
        zIndex: 20,
        maxHeight: 240,
        overflowY: "auto",
        background: "var(--bg-elev)",
        border: "1px solid var(--border-strong)",
        borderRadius: 12,
        boxShadow: "var(--shadow-md)",
        padding: 5,
      }}
    >
      {items.length === 0 ? (
        <div style={{ padding: "10px 12px", fontSize: "12.5px", color: "var(--fg-faint)" }}>
          No friends match — add one from the Friend list.
        </div>
      ) : (
        items.map((c, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={`${c.name}-${c.address}`}
              type="button"
              role="option"
              aria-selected={active}
              // onMouseDown (not onClick) so selection fires before the input blurs.
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(c);
              }}
              onMouseEnter={() => onHover(i)}
              className="flex items-center justify-between w-full"
              style={{
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                background: active ? "var(--accent-soft)" : "transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: "13.5px", fontWeight: 550, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                @{c.name}
              </span>
              <span style={{ fontSize: "11.5px", color: "var(--fg-faint)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                {truncateAddress(c.address)}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
