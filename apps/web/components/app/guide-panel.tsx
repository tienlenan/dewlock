"use client";

/**
 * GuidePanel — in-app guide: what each feature does + how to use Dewlock.
 * Pure presentation, design-token styled. Rendered in the single-UI content panel.
 */

import { MessageSquare, ShieldCheck, LayoutDashboard, ArrowLeftRight, Trophy, Boxes } from "lucide-react";

interface GuideSection {
  icon: typeof MessageSquare;
  title: string;
  body: string;
  steps?: string[];
}

const SECTIONS: GuideSection[] = [
  {
    icon: MessageSquare,
    title: "Copilot — talk to it in plain language",
    body: "State an intent (\"swap 10 SUI to USDC\", \"send 5 USDC to alice.sui\", \"how's my portfolio?\"). The agent builds one unsigned transaction and renders a card.",
    steps: [
      "Connect your Sui wallet (top-right).",
      "Type an intent or tap an example chip.",
      "Review the preview card, then sign in your own wallet.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "The Guardian — fail-closed by default",
    body: "Before any wallet prompt, the Guardian re-derives + dry-runs the transaction: allowlisted targets, coin-type + provenance checks, min-out, spend caps, SuiNS look-alike detection. If anything is off, it BLOCKS — no fee, no prompt. You sign exactly the bytes it approved (WYSIWYS).",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard — your activity, level & badges",
    body: "Your XP level, ~50 reward badges (earned from your sealed transactions), volume, daily-cap usage, recent receipts, and protocol-wide TVL.",
  },
  {
    icon: ArrowLeftRight,
    title: "Bridge — bring assets into Sui",
    body: "Mayan's cross-chain swap bridges from Ethereum, Solana, Base and more into Sui. Fully wallet-driven — Dewlock never signs the source leg. An advanced path can redeem a raw VAA behind the bridge Guardian.",
  },
  {
    icon: Boxes,
    title: "Protocols (Settings ⚙)",
    body: "See every Sui DeFi protocol Dewlock recognizes and its posture — active + enforced, or excluded (hacked / off-model). Only active, built adapters contribute targets to the enforced allowlist.",
  },
  {
    icon: Trophy,
    title: "Levels & badges — earned, never faked",
    body: "Every sealed action earns XP toward your level and unlocks badges (first swap, Degen, Chain Hopper, High Roller…). Badges derive from your immutable receipts, so they're always accurate.",
  },
];

export function GuidePanel() {
  return (
    <div style={{ maxWidth: 620, width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px", color: "var(--fg)" }}>
          How to use Dewlock
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: 0, lineHeight: 1.55 }}>
          Dewlock is an intent-firewall copilot for Sui DeFi: tell it what you want, it builds one unsigned
          transaction, and the Guardian inspects it before <strong style={{ color: "var(--fg)" }}>you</strong> sign.
        </p>
      </div>

      {SECTIONS.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.title}
            style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)", padding: 16, display: "flex", gap: 14 }}
          >
            <div
              style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Icon size={18} color="var(--accent-ink)" aria-hidden />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--fg)", marginBottom: 4 }}>{s.title}</div>
              <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0, lineHeight: 1.5 }}>{s.body}</p>
              {s.steps && (
                <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  {s.steps.map((step) => <li key={step} style={{ marginTop: 3 }}>{step}</li>)}
                </ol>
              )}
            </div>
          </div>
        );
      })}

      <p className="split-mono" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.08em", textAlign: "center", marginTop: 4 }}>
        hackathon preview · unaudited · you always sign in your own wallet
      </p>
    </div>
  );
}
