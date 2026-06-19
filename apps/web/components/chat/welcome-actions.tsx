"use client";

/**
 * WelcomeActions — the 4 default action cards under the empty-thread greeting.
 * Each card submits an intent string the parser already recognizes (via onSend) — no
 * bespoke handlers, no new agent code. Shown only on the empty thread.
 *
 * Intent strings (kept in sync with parse-intent.ts):
 *   swap → getSwapForm · "send SUI" → send action form · lend → lend form/picker ·
 *   "my portfolio" → getPortfolio.
 * "send SUI" pre-selects SUI (the native asset) since there is no bare send form;
 * the user still picks amount + recipient in the rendered form.
 */

import { ArrowLeftRight, Send, Landmark, Wallet } from "lucide-react";

interface ActionCard {
  key: string;
  title: string;
  subtitle: string;
  intentText: string;
  Icon: typeof ArrowLeftRight;
}

const ACTIONS: ActionCard[] = [
  { key: "swap", title: "Swap / Sell", subtitle: "Trade one token for another", intentText: "swap", Icon: ArrowLeftRight },
  { key: "send", title: "Send", subtitle: "Transfer to an address or friend", intentText: "send SUI", Icon: Send },
  { key: "lend", title: "Lending", subtitle: "Deposit to earn — NAVI · Suilend", intentText: "lend", Icon: Landmark },
  { key: "portfolio", title: "View Portfolio", subtitle: "Balances & estimated value", intentText: "my portfolio", Icon: Wallet },
];

/** The exact intent strings the cards submit — exported so a test can assert they stay
 *  parseable by the deterministic intent parser (drift guard). */
export const WELCOME_ACTION_INTENTS: string[] = ACTIONS.map((a) => a.intentText);

export function WelcomeActions({ onSend }: { onSend?: (text: string) => void }) {
  if (!onSend) return null;
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(158px, 1fr))", gap: 7, marginTop: 11 }}
    >
      {ACTIONS.map(({ key, title, subtitle, intentText, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onSend(intentText)}
          title={subtitle}
          className="flex items-center gap-2.5 text-left"
          style={{
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--bg-sub)",
            cursor: "pointer",
            transition: "background 120ms, border-color 120ms",
          }}
        >
          <span
            aria-hidden
            className="shrink-0 flex items-center justify-center"
            style={{ width: 27, height: 27, borderRadius: 7, background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Icon size={14} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--fg)", lineHeight: 1.25 }}>{title}</span>
            <span style={{ display: "block", fontSize: "10.5px", color: "var(--fg-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
