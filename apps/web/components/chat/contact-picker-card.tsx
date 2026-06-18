"use client";

/**
 * ContactPickerCard — rendered when a friend name matches 2+ saved contacts. The user
 * picks one; the card re-submits a COMPLETE send command with that contact's exact 0x via
 * onSend, so the normal pipeline (parseIntent → prepareTrade → Guardian) builds the tx.
 *
 * The candidate addresses are route-authoritative (the server resolved them from the user's
 * address book and supplied them in the directive) — the card shows the full 0x so the user
 * can visually confirm before signing (the explicit transcription backstop).
 */

import { useState } from "react";
import { ArrowRight } from "lucide-react";

export interface ContactPickerData {
  query: string;
  amountHuman: string;
  coinSymbol: string;
  candidates: { name: string; address: string }[];
  title: string;
}

export function ContactPickerCard({
  data,
  onSend,
}: {
  data: ContactPickerData;
  onSend?: (text: string) => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  function pick(address: string) {
    if (submitted) return;
    setSubmitted(true);
    onSend?.(`send ${data.amountHuman} ${data.coinSymbol} to ${address}`);
  }

  function useSuiNS() {
    if (submitted) return;
    setSubmitted(true);
    onSend?.(`send ${data.amountHuman} ${data.coinSymbol} to ${data.query}.sui`);
  }

  return (
    <div
      className="w-full"
      style={{
        maxWidth: 420,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-sm)",
        padding: 16,
        fontFamily: "var(--font-mono)",
        opacity: submitted ? 0.6 : 1,
      }}
    >
      <div className="split-mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-muted)", marginBottom: 4 }}>
        {data.title}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg-faint)", marginBottom: 13 }}>
        Sending {data.amountHuman} {data.coinSymbol} — pick the right friend, then confirm the address.
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {data.candidates.map((c) => (
          <button
            key={c.address}
            type="button"
            onClick={() => pick(c.address)}
            disabled={submitted}
            className="flex flex-col transition-opacity"
            style={{
              textAlign: "left",
              gap: 4,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-sub)",
              cursor: submitted ? "default" : "pointer",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{c.name}</span>
            <span style={{ fontSize: 10.5, color: "var(--fg-faint)", wordBreak: "break-all", lineHeight: 1.4 }}>
              {c.address}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={useSuiNS}
        disabled={submitted}
        className="flex items-center gap-1.5 transition-opacity"
        style={{
          marginTop: 12,
          background: "none",
          border: "none",
          padding: 0,
          fontSize: 11.5,
          color: "var(--fg-muted)",
          cursor: submitted ? "default" : "pointer",
        }}
      >
        Not listed? Send to {data.query}.sui instead
        {!submitted && <ArrowRight size={12} aria-hidden />}
      </button>
    </div>
  );
}
