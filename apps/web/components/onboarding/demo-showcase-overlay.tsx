"use client";

/**
 * DemoShowcaseOverlay — a scripted, read-only walkthrough of what Dewlock produces.
 *
 * SAFETY: renders the REAL card components (TxPreviewCard, ChainPlanCard, PortfolioCard,
 * BlockCard) so the UI is pixel-identical to live usage, but with MOCK data and INERT
 * handlers. It deliberately bypasses the live signing/composite wrappers
 * (TxPreviewCardWithSigning / ChainPlanWithComposite), so no transaction can ever be
 * built or signed from here. Action buttons surface an explanatory notice instead.
 * "Try it for real" chips hand a real command to the live composer.
 */

import { useState } from "react";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { TxPreviewCard } from "@/components/tx-preview-card";
import { ChainPlanCard } from "@/components/chat/chain-plan-card";
import { PortfolioCard } from "@/components/portfolio-card";
import { BlockCard } from "@/components/block-card";
import {
  buildDemoPortfolio,
  buildDemoSwapPreview,
  buildDemoChainPlan,
  buildDemoBlock,
  DEMO_WALLET_ADDRESS,
} from "@/lib/demo/onboarding-demo-cards";
import { DemoUserBubble, DemoAssistantRow } from "./demo-chat-primitives";

interface DemoShowcaseOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Connected address (falls back to a demo address for the mock cards). */
  walletAddress?: string;
  /** Hand a real command to the live composer (used by the "try it for real" chips). */
  onRunCommand: (text: string) => void;
}

const TRY_COMMANDS: string[] = [
  "How's my portfolio?",
  "Swap 10 SUI to USDC then lend the USDC on NAVI",
  "Swap 1 SUI to USDC",
  "Send 5 USDC to a friend",
];

export function DemoShowcaseOverlay({ open, onClose, walletAddress, onRunCommand }: DemoShowcaseOverlayProps) {
  const [notice, setNotice] = useState<string | null>(null);
  if (!open) return null;

  const addr = walletAddress ?? DEMO_WALLET_ADDRESS;
  const portfolio = buildDemoPortfolio(addr);
  const preview = buildDemoSwapPreview(addr);
  const plan = buildDemoChainPlan(addr);
  const block = buildDemoBlock();

  // Inert action — demo cards never execute; explain and point at the live composer.
  const inert = () => setNotice("This is a demo preview — nothing executes here. Pick a command below to do it for real.");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "color-mix(in srgb, var(--bg-dark) 62%, transparent)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "min(6vh, 48px) 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Dewlock demo walkthrough"
        style={{
          width: "100%",
          maxWidth: 720,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-md)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-elev)",
          }}
        >
          <Sparkles size={16} style={{ color: "var(--accent-ink)" }} aria-hidden />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--fg)" }}>See Dewlock in action</div>
            <div style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>
              Example outputs — every card is a demo preview, nothing executes.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close demo"
            style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              border: "1px solid var(--border)", background: "var(--bg-elev)",
              color: "var(--fg-muted)", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        {/* Notice banner (shown when a demo action button is clicked) */}
        {notice && (
          <div style={{ padding: "10px 18px", fontSize: 12.5, color: "var(--accent-ink)", background: "var(--accent-soft)", borderBottom: "1px solid var(--border)" }}>
            {notice}
          </div>
        )}

        {/* Scripted conversation — identical card UI to the live thread */}
        <div style={{ maxHeight: "62vh", overflowY: "auto", padding: "20px 18px" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            <DemoUserBubble text="How's my portfolio?" />
            <DemoAssistantRow text="Here's a snapshot of your holdings — values are illustrative.">
              <PortfolioCard {...portfolio} onAction={inert} />
            </DemoAssistantRow>

            <DemoUserBubble text="Swap 10 SUI to USDC, then lend the USDC on NAVI" />
            <DemoAssistantRow text="One intent → one atomic plan. Review it, then sign just once.">
              <ChainPlanCard plan={plan} onRunAtomic={inert} />
            </DemoAssistantRow>

            <DemoUserBubble text="Swap 1 SUI to USDC" />
            <DemoAssistantRow text="Here's the exact transaction the Guardian approved — what you see is what you sign.">
              <TxPreviewCard preview={preview} onConfirm={inert} onCancel={inert} />
            </DemoAssistantRow>

            <DemoUserBubble text="Send 5 USDC to 888.sui" />
            <DemoAssistantRow blocked text="The Guardian caught a look-alike address and BLOCKED it — before any signature, no fee.">
              <BlockCard reasons={block.reasons} gates={block.gates} />
            </DemoAssistantRow>
          </div>
        </div>

        {/* Prepared commands — hand a real intent to the live composer */}
        <div style={{ padding: "12px 18px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-elev)" }}>
          <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 8 }}>
            TRY IT FOR REAL
          </div>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {TRY_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => onRunCommand(cmd)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 12px", borderRadius: 9, fontSize: 12.5,
                  border: "1px solid var(--border)", background: "var(--bg)",
                  color: "var(--fg)", cursor: "pointer",
                }}
              >
                {cmd}
                <ArrowRight size={13} aria-hidden style={{ color: "var(--accent-ink)" }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
