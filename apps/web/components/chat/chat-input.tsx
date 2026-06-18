"use client";

/**
 * ChatInput — text composer + example-prompt chips.
 *
 * Example chips send real text straight through the live agent (`onSendText` →
 * /api/agent → Guardian), exactly as if the user typed it. No fixtures, no
 * demo-only path — the chips ARE the real feature, pre-filled.
 */

import React, { useState, useCallback } from "react";
import type { Suggestion } from "@/lib/suggestions";

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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatInput({ onSendText, disabled = false, suggestions }: ChatInputProps) {
  const [text, setText] = useState("");
  // Dynamic chips when context is available; otherwise the static example set.
  const chips: ExamplePrompt[] =
    suggestions && suggestions.length > 0
      ? suggestions.map((s) => ({ label: s.label, text: s.text }))
      : EXAMPLE_PROMPTS;

  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSendText(trimmed);
      setText("");
    },
    [disabled, onSendText],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      submit(text);
    },
    [text, submit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit(text);
      }
    },
    [text, submit],
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

        {/* Text input row */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            border: "1px solid var(--border-strong)",
            borderRadius: "12px",
            background: "var(--bg)",
            padding: "8px 8px 8px 16px",
          }}
        >
          <label htmlFor="chat-text-input" className="sr-only">Message</label>
          <input
            id="chat-text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="State your intent in plain language…"
            aria-label="Message"
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
