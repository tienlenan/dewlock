"use client";

/**
 * ChatInput — text input bar + demo quick-action buttons.
 *
 * Quick-action buttons call /api/prepare-trade directly (deterministic, no LLM)
 * so the stage demo path is immune to LLM latency/flakiness.
 *
 * Demo actions:
 *  "Send 1 SUI to alice.sui"      → PASS (safe transfer, within caps)
 *  "Send 5 USDC to 888-l.sui"     → BLOCK (lookalike of 888.sui)
 *
 * Visual: matches mockup input bar — pill border-radius input, accent send
 * button, chip-style scenario buttons, disclaimer footer.
 */

import React, { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Demo payloads — identical to original; only presentation changes
// ---------------------------------------------------------------------------

const USDC_TYPE =
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

const SUI_TYPE =
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";

export interface DemoAction {
  label: string;
  description: string;
  expectation: "pass" | "block";
  /**
   * When set, the action calls /api/prepare-trade with only
   * { walletAddress, actionType: "near_miss_fixture" } to get the deterministic
   * fixture BLOCK result. The rest of `payload` is unused.
   */
  fixtureMode?: "near_miss";
  payload: {
    actionType: "transfer" | "swap" | "near_miss_fixture";
    coinTypeIn?: string;
    coinTypeOut?: string;
    recipientInput?: string;
    amountInNative?: string;
    argProvenance?: {
      recipient?: "user_turn" | "derived";
      amount?: "user_turn" | "derived";
      coinType?: "user_turn" | "derived";
    };
    verifiedContacts?: string[];
    slippageBps?: number;
  };
}

const DEMO_ACTIONS: DemoAction[] = [
  {
    label: "Send 1 SUI → alice.sui",
    description: "Safe transfer — Guardian approves",
    expectation: "pass",
    payload: {
      actionType: "transfer",
      coinTypeIn: SUI_TYPE,
      recipientInput: "alice.sui",
      amountInNative: "1000000000",
      argProvenance: { recipient: "user_turn", amount: "user_turn", coinType: "user_turn" },
      verifiedContacts: ["alice.sui"],
    },
  },
  {
    label: "Send 5 USDC to 888-l.sui [BLOCK]",
    description: "Lookalike of 888.sui — Guardian blocks",
    expectation: "block",
    payload: {
      actionType: "transfer",
      coinTypeIn: USDC_TYPE,
      recipientInput: "888-l.sui",
      amountInNative: "5000000",
      argProvenance: { recipient: "user_turn", amount: "user_turn", coinType: "user_turn" },
      verifiedContacts: ["888.sui"],
    },
  },
  {
    label: "See the BLOCK [demo]",
    description: "Near-miss lookalike attack — fixture BLOCK with full typed/resolved/lookalike diff",
    expectation: "block",
    fixtureMode: "near_miss",
    payload: {
      actionType: "near_miss_fixture",
    },
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatInputProps {
  onSendText: (text: string) => void;
  onDemoResult: (action: DemoAction, result: unknown) => void;
  walletAddress: string;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Send arrow icon matching the mockup
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
// Component
// ---------------------------------------------------------------------------

export function ChatInput({
  onSendText,
  onDemoResult,
  walletAddress,
  disabled = false,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [demoLoading, setDemoLoading] = useState<number | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || disabled) return;
      onSendText(trimmed);
      setText("");
    },
    [text, disabled, onSendText],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || disabled) return;
        onSendText(trimmed);
        setText("");
      }
    },
    [text, disabled, onSendText],
  );

  const handleDemoAction = useCallback(
    async (action: DemoAction, idx: number) => {
      if (demoLoading !== null) return;
      setDemoLoading(idx);
      try {
        const res = await fetch("/api/prepare-trade", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ walletAddress, ...action.payload }),
        });
        const data: unknown = await res.json();
        onDemoResult(action, data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onDemoResult(action, {
          ok: false,
          reasons: [`Network error: ${msg}`],
          gates: ["network"],
        });
      } finally {
        setDemoLoading(null);
      }
    },
    [demoLoading, walletAddress, onDemoResult],
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
        {/* Demo scenario chips */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {DEMO_ACTIONS.map((action, idx) => {
            const isActive = demoLoading === idx;
            const isBlock = action.expectation === "block";
            return (
              <button
                key={idx}
                type="button"
                disabled={demoLoading !== null || disabled}
                onClick={() => void handleDemoAction(action, idx)}
                title={action.description}
                style={{
                  padding: "7px 13px",
                  border: isBlock
                    ? "1px solid color-mix(in srgb, var(--destructive) 40%, transparent)"
                    : "1px solid var(--border)",
                  background: isBlock
                    ? "color-mix(in srgb, var(--destructive) 5%, transparent)"
                    : "var(--bg-sub)",
                  color: isBlock ? "var(--destructive)" : "var(--fg-muted)",
                  borderRadius: 99,
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  cursor: demoLoading !== null || disabled ? "not-allowed" : "pointer",
                  opacity: demoLoading !== null && !isActive ? 0.5 : 1,
                  transition: "opacity 120ms, background 120ms",
                }}
              >
                {isActive ? "…" : action.label}
              </button>
            );
          })}
        </div>

        {/* Text input row — pill style matching mockup */}
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
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="State your intent in plain language…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
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
