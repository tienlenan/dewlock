"use client";

/**
 * ChatInput — text composer + example-prompt chips, with a live recipient badge and
 * an @mention friends menu.
 *
 * Example chips send real text straight through the live agent (`onSendText` →
 * /api/agent → Guardian), exactly as if the user typed it. No fixtures, no
 * demo-only path — the chips ARE the real feature, pre-filled.
 *
 * Recipient badge: as the user types "…to <recipient>" (a 0x, a .sui name, an @friend,
 * or a saved-contact name) a colored badge below the chips previews the resolution.
 * DISPLAY-ONLY — the Guardian re-resolves server-side and is the security path.
 *
 * @mention: typing "@" opens a friends menu; selecting inserts "@Name". On submit each
 * "@Name" is rewritten to the bare contact name so the existing deterministic resolver
 * (matchContacts → unique name → 1 match) handles the send unchanged.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import type { Suggestion } from "@/lib/suggestions";
import { useRecipientResolution } from "./use-recipient-resolution";
import { RecipientBadge } from "./recipient-badge";
import { MentionMenu } from "./mention-menu";
import {
  activeMentionQuery,
  applyMentionSelection,
  substituteMentions,
  filterContacts,
  type ActiveMention,
  type MentionContact,
} from "@/lib/chat/mention";

// ---------------------------------------------------------------------------
// Example prompts — real intents that map 1:1 to a copilot tool. Clicking one
// runs the live agent (not a fixture). The lookalike example exercises the real
// Guardian BLOCK path.
// ---------------------------------------------------------------------------

interface ExamplePrompt {
  /** Chip label. */
  label: string;
  /** The exact text sent to the agent. */
  text: string;
  /** Tints the chip when it demonstrates a Guardian block. */
  block?: boolean;
}

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  { label: "How's my portfolio?", text: "How's my portfolio doing?" },
  { label: "Swap 10 SUI → USDC", text: "Swap 10 SUI to USDC" },
  { label: "DeepBook limit buy", text: "Limit buy 500 DEEP at 0.0031 USDC on DeepBook" },
  { label: "Trigger a BLOCK", text: "Send 5 USDC to 888-l.sui", block: true },
];

// ---------------------------------------------------------------------------
// Send arrow icon
// ---------------------------------------------------------------------------

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8h9M8 4l4 4-4 4"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatInputProps {
  onSendText: (text: string) => void;
  disabled?: boolean;
  /** Context-aware chips (from portfolio/conversation). Falls back to the static examples. */
  suggestions?: Suggestion[];
  /** Freshest friend book — powers the recipient badge + @mention menu. */
  contacts?: MentionContact[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatInput({ onSendText, disabled = false, suggestions, contacts = [] }: ChatInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // @mention menu state
  const [mention, setMention] = useState<ActiveMention | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuItems = mention ? filterContacts(contacts, mention.query) : [];
  const menuOpen = mention !== null;

  // Live recipient badge (display-only).
  const recipient = useRecipientResolution(text, contacts);

  // Dynamic chips when context is available; otherwise the static example set.
  const chips: ExamplePrompt[] =
    suggestions && suggestions.length > 0
      ? suggestions.map((s) => ({ label: s.label, text: s.text }))
      : EXAMPLE_PROMPTS;

  // Apply a pending caret after a mention insert (text update lands first).
  useEffect(() => {
    if (pendingCaret.current != null && inputRef.current) {
      const pos = pendingCaret.current;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(pos, pos);
      pendingCaret.current = null;
    }
  });

  /** Recompute the active @mention from the live text + caret. */
  const refreshMention = useCallback(
    (value: string, caret: number) => {
      const next = activeMentionQuery(value, caret);
      setMention(next);
      if (next) setActiveIndex(0);
    },
    [],
  );

  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      // Rewrite @mentions to bare contact names → existing deterministic resolver path.
      const finalText = substituteMentions(trimmed, contacts.map((c) => c.name));
      onSendText(finalText);
      setText("");
      setMention(null);
    },
    [disabled, onSendText, contacts],
  );

  const selectMention = useCallback(
    (contact: MentionContact) => {
      if (!mention) return;
      const { text: next, caret } = applyMentionSelection(text, mention, contact.name);
      setText(next);
      setMention(null);
      pendingCaret.current = caret;
    },
    [mention, text],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      submit(text);
    },
    [text, submit],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setText(value);
      refreshMention(value, e.target.selectionStart ?? value.length);
    },
    [refreshMention],
  );

  // Caret-only moves (click / arrow without typing) — keep the mention state in sync.
  const handleSelect = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      refreshMention(el.value, el.selectionStart ?? el.value.length);
    },
    [refreshMention],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Menu navigation takes over the relevant keys only while it has items.
      if (menuOpen && menuItems.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % menuItems.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + menuItems.length) % menuItems.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          selectMention(menuItems[activeIndex]);
          return;
        }
      }
      if (menuOpen && e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
      // Default: Enter sends (menu closed or empty).
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit(text);
      }
    },
    [menuOpen, menuItems, activeIndex, selectMention, submit, text],
  );

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "1px solid var(--border)",
        background: "var(--bg-elev)",
        padding: "14px clamp(16px, 4vw, 40px)",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        {/* Example-prompt chips — each runs the real agent */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {chips.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => submit(p.text)}
              title={p.text}
              style={{
                padding: "7px 13px",
                border: p.block
                  ? "1px solid color-mix(in srgb, var(--destructive) 40%, transparent)"
                  : "1px solid var(--border)",
                background: p.block
                  ? "color-mix(in srgb, var(--destructive) 5%, transparent)"
                  : "var(--bg-sub)",
                color: p.block ? "var(--destructive)" : "var(--fg-muted)",
                borderRadius: 99,
                fontFamily: "var(--font-sans)",
                fontSize: "12.5px",
                fontWeight: 500,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                transition: "opacity 120ms, background 120ms",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Recipient badge — live, display-only preview of the resolved recipient */}
        <RecipientBadge recipient={recipient} />

        {/* Text input row */}
        <form
          onSubmit={handleSubmit}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            border: "1px solid var(--border-strong)",
            borderRadius: "12px",
            background: "var(--bg)",
            padding: "8px 8px 8px 16px",
          }}
        >
          {menuOpen && (
            <MentionMenu
              items={menuItems}
              activeIndex={activeIndex}
              onSelect={selectMention}
              onHover={setActiveIndex}
            />
          )}
          <label htmlFor="chat-text-input" className="sr-only">Message</label>
          <input
            id="chat-text-input"
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onClick={handleSelect}
            disabled={disabled}
            placeholder="State your intent in plain language…"
            aria-label="Message"
            autoComplete="off"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontFamily: "var(--font-sans)",
              fontSize: "14.5px",
              color: "var(--fg)",
              minWidth: 0,
            }}
          />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            style={{
              flexShrink: 0,
              width: 38,
              height: 38,
              borderRadius: 9,
              background: disabled || !text.trim() ? "var(--accent-soft)" : "var(--accent)",
              color: "#fff",
              border: "none",
              cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 120ms",
            }}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </form>

        {/* Disclaimer */}
        <p
          className="text-center mt-2"
          style={{ fontSize: "11px", color: "var(--fg-faint)" }}
        >
          Dewlock builds unsigned transactions only. You sign in your own wallet.
          Hackathon preview — unaudited.
        </p>
      </div>
    </div>
  );
}
