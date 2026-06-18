"use client";

/**
 * ActionFormCard — interactive input form rendered when an action is missing details
 * (e.g. "sell SUI" with no amount). Collects amount / recipient / protocol, then
 * composes a COMPLETE canonical command and re-submits it via onSend, so the normal
 * deterministic pipeline (parseIntent → prepareTrade → Guardian) builds the tx.
 */

import { useState } from "react";
import { ArrowRight } from "lucide-react";

export interface ActionFormData {
  formAction: "swap" | "send" | "lend";
  coinInSymbol?: string;
  coinOutSymbol?: string;
  lendVerb?: string;
  amountHuman?: string;
  needs: string[];
  title: string;
}

const LEND_COINS = ["SUI", "USDC", "USDT"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  borderRadius: 9,
  border: "1px solid var(--border)",
  background: "var(--bg-sub)",
  color: "var(--fg)",
  padding: "0 11px",
  fontSize: 13,
  fontFamily: "var(--font-mono)",
  outline: "none",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="split-mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--fg-faint)" }}>
      {children}
    </span>
  );
}

export function ActionFormCard({ form, onSend }: { form: ActionFormData; onSend?: (text: string) => void }) {
  const [amount, setAmount] = useState(form.amountHuman ?? "");
  const [recipient, setRecipient] = useState("");
  const [coin, setCoin] = useState(form.coinInSymbol ?? LEND_COINS[0]);
  const [submitted, setSubmitted] = useState(false);

  const needsAmount = form.needs.includes("amount");
  const needsRecipient = form.needs.includes("recipient");
  const needsCoin = form.needs.includes("coin");

  const amountValid = !needsAmount || /^\d+(\.\d+)?$/.test(amount.trim());
  // Accept a 0x address, a name.sui, OR a bare SuiNS label (auto-resolved to .sui).
  const recipientValid = !needsRecipient || /^(0x[0-9a-fA-F]{6,}|[a-z0-9][a-z0-9_-]{1,62}(\.sui)?)$/i.test(recipient.trim());
  const canSubmit = amountValid && recipientValid && (!needsAmount || amount.trim() !== "") && (!needsRecipient || recipient.trim() !== "");

  function buildCommand(): string {
    const amt = amount.trim();
    if (form.formAction === "swap") {
      return `swap ${amt} ${form.coinInSymbol} to ${form.coinOutSymbol}`;
    }
    if (form.formAction === "send") {
      return `send ${amt} ${form.coinInSymbol} to ${recipient.trim()}`;
    }
    // lend — omit the protocol on purpose: the completed "deposit <amt> <coin>"
    // re-enters and routes to the protocol picker (cards with live APY), so the
    // user never has to pick from a dropdown here.
    const verb = form.lendVerb === "repay" ? "repay" : "deposit";
    const c = needsCoin ? coin : form.coinInSymbol ?? "USDC";
    return `${verb} ${amt} ${c}`;
  }

  function handleSubmit() {
    if (!canSubmit || submitted) return;
    setSubmitted(true);
    onSend?.(buildCommand());
  }

  return (
    <div
      className="w-full"
      style={{
        maxWidth: 380,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-sm)",
        padding: 16,
        fontFamily: "var(--font-mono)",
        opacity: submitted ? 0.6 : 1,
      }}
    >
      <div className="split-mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-muted)", marginBottom: 13 }}>
        {form.title}
      </div>

      <div style={{ display: "grid", gap: 11 }}>
        {needsAmount && (
          <label style={{ display: "grid", gap: 5 }}>
            <FieldLabel>amount{form.coinInSymbol ? ` (${form.coinInSymbol})` : ""}</FieldLabel>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              disabled={submitted}
              style={{ ...inputStyle, borderColor: amount && !amountValid ? "var(--destructive)" : "var(--border)" }}
            />
          </label>
        )}

        {needsCoin && (
          <label style={{ display: "grid", gap: 5 }}>
            <FieldLabel>coin</FieldLabel>
            <select value={coin} onChange={(e) => setCoin(e.target.value)} disabled={submitted} style={inputStyle}>
              {LEND_COINS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}

        {needsRecipient && (
          <label style={{ display: "grid", gap: 5 }}>
            <FieldLabel>recipient (0x… or name.sui)</FieldLabel>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x… or alice.sui"
              disabled={submitted}
              style={{ ...inputStyle, borderColor: recipient && !recipientValid ? "var(--destructive)" : "var(--border)" }}
            />
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || submitted}
        className="flex items-center justify-center gap-2 transition-opacity"
        style={{
          marginTop: 14,
          width: "100%",
          height: 38,
          borderRadius: 10,
          border: "none",
          background: canSubmit && !submitted ? "var(--accent)" : "var(--bg-sub)",
          color: canSubmit && !submitted ? "#fff" : "var(--fg-faint)",
          fontSize: 13,
          fontWeight: 600,
          cursor: canSubmit && !submitted ? "pointer" : "default",
          boxShadow: canSubmit && !submitted ? "var(--shadow-aqua)" : "none",
        }}
      >
        {submitted ? "Submitted" : "Continue"}
        {!submitted && <ArrowRight size={14} aria-hidden />}
      </button>
    </div>
  );
}
