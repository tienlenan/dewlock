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

import type { ReactNode } from "react";
import { ArrowLeftRight, CandlestickChart, Send, Landmark, Wallet, Percent, BarChart3, Flame } from "lucide-react";

interface ActionCard {
  key: string;
  title: string;
  subtitle: string;
  intentText: string;
  Icon: typeof ArrowLeftRight;
}

const ACTIONS: ActionCard[] = [
  { key: "swap", title: "Swap / Sell", subtitle: "Trade one token for another", intentText: "swap", Icon: ArrowLeftRight },
  { key: "limit", title: "Limit Order", subtitle: "Place a DeepBook limit order", intentText: "place limit order", Icon: CandlestickChart },
  { key: "send", title: "Send", subtitle: "Transfer to an address or friend", intentText: "send SUI", Icon: Send },
  { key: "lend", title: "Lending", subtitle: "Deposit to earn — NAVI · Suilend", intentText: "lend", Icon: Landmark },
  { key: "portfolio", title: "View Portfolio", subtitle: "Balances & estimated value", intentText: "my portfolio", Icon: Wallet },
];

// Read-only Sui-ecosystem discovery prompts — distinct from the value actions above.
// Each string is one the deterministic intent parser routes to its ecosystem tool.
const DISCOVER: ActionCard[] = [
  { key: "yields", title: "Best yields", subtitle: "Top stablecoin APY on Sui", intentText: "best stablecoin yields on Sui", Icon: Percent },
  { key: "tvl", title: "Top TVL", subtitle: "Biggest protocols on Sui", intentText: "top TVL on Sui", Icon: BarChart3 },
  { key: "memes", title: "Trending tokens", subtitle: "Hot Sui meme coins", intentText: "trending tokens on Sui", Icon: Flame },
];

/** The exact intent strings the cards submit — exported so a test can assert they stay
 *  parseable by the deterministic intent parser (drift guard). */
export const WELCOME_ACTION_INTENTS: string[] = ACTIONS.map((a) => a.intentText);
export const DISCOVER_ACTION_INTENTS: string[] = DISCOVER.map((a) => a.intentText);

function ActionButton({ card, onSend }: { card: ActionCard; onSend: (text: string) => void }) {
  const { title, subtitle, intentText, Icon } = card;
  return (
    <button
      type="button"
      onClick={() => onSend(intentText)}
      title={subtitle || title}
      className="flex items-center gap-2 text-left"
      style={{
        padding: "9px 11px",
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
      <span
        style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
      >
        {title}
      </span>
    </button>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="split-mono"
      style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--fg-faint)", margin: "13px 0 7px" }}
    >
      {children}
    </div>
  );
}

export function WelcomeActions({ onSend }: { onSend?: (text: string) => void }) {
  if (!onSend) return null;
  return (
    <>
      {/* Value actions — 4-up on large screens, 2-up on small (viewport breakpoint). */}
      <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 8, marginTop: 11 }}>
        {ACTIONS.map((card) => (
          <ActionButton key={card.key} card={card} onSend={onSend} />
        ))}
      </div>

      {/* Read-only discovery prompts — explore the Sui ecosystem (no wallet move). */}
      <GroupLabel>Discover the Sui ecosystem</GroupLabel>
      <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 8 }}>
        {DISCOVER.map((card) => (
          <ActionButton key={card.key} card={card} onSend={onSend} />
        ))}
      </div>
    </>
  );
}
