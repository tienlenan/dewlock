/**
 * Type scale showcase — renders each --text-* token as a live sample line.
 * Font size labels are resolved from getComputedStyle so they stay in sync
 * with whatever globals.css declares; no hardcoded px values here.
 */
"use client";

import { useEffect, useState } from "react";

type TypeStep = {
  token: string;        // --text-* custom property
  label: string;        // human name
  sample: string;       // demo text
  weight?: number;
  letterSpacing?: string;
  lineHeightToken?: string;
  mono?: boolean;
  uppercase?: boolean;
};

const TYPE_STEPS: TypeStep[] = [
  {
    token: "--text-display",
    label: "Display",
    sample: "Sealed.",
    weight: 800,
    letterSpacing: "-0.035em",
    lineHeightToken: "--lh-display",
  },
  {
    token: "--text-section",
    label: "Section heading",
    sample: "Section heading",
    weight: 700,
    letterSpacing: "-0.03em",
    lineHeightToken: "--lh-heading",
  },
  {
    token: "--text-card",
    label: "Card title",
    sample: "Card title",
    weight: 600,
    letterSpacing: "-0.02em",
  },
  {
    token: "--text-body-lg",
    label: "Body large",
    sample: "State your intent in plain language.",
    lineHeightToken: "--lh-body-lg",
  },
  {
    token: "--text-body",
    label: "Body",
    sample: "The Guardian re-derives the math before you sign.",
    lineHeightToken: "--lh-body",
  },
  {
    token: "--text-md",
    label: "Body small",
    sample: "Effects visible before confirming.",
    lineHeightToken: "--lh-body",
  },
  {
    token: "--text-base",
    label: "Caption",
    sample: "Effects visible before confirming.",
    lineHeightToken: "--lh-body",
  },
  {
    token: "--text-xs",
    label: "Mono label (uppercase)",
    sample: "SUI:MAINNET · LABEL",
    mono: true,
    uppercase: true,
    letterSpacing: "0.14em",
    lineHeightToken: "--lh-mono",
  },
  {
    token: "--text-2xs",
    label: "Mono caption",
    sample: "tracking 0.12em · uppercase",
    mono: true,
    uppercase: true,
    letterSpacing: "0.12em",
  },
];

function useTokenPx(token: string): string {
  const [value, setValue] = useState("…");
  useEffect(() => {
    if (!token) { setValue(""); return; }
    const root = document.documentElement;
    const raw = getComputedStyle(root).getPropertyValue(token).trim();
    setValue(raw || "—");
  }, [token]);
  return value;
}

function TypeRow({ step }: { step: TypeStep }) {
  const sizePx = useTokenPx(step.token);
  // Always call the hook; pass an empty string when there is no lineHeightToken
  // so the hook count stays stable across renders (Rules of Hooks).
  const lineHRaw = useTokenPx(step.lineHeightToken ?? "");
  const lineH = step.lineHeightToken ? lineHRaw : undefined;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 24,
        padding: "14px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* meta column */}
      <div style={{ width: 120, flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--fg-subtle)",
            marginBottom: 2,
          }}
        >
          {step.token}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            color: "var(--fg-faint)",
          }}
        >
          {sizePx}{lineH ? ` / ${lineH}` : ""}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>
          {step.label}
        </div>
      </div>
      {/* sample text */}
      <div
        style={{
          fontSize: `var(${step.token})`,
          fontWeight: step.weight ?? 400,
          fontFamily: step.mono ? "var(--font-mono)" : "var(--font-sans)",
          letterSpacing: step.letterSpacing,
          textTransform: step.uppercase ? "uppercase" : undefined,
          lineHeight: step.lineHeightToken
            ? `var(${step.lineHeightToken})`
            : undefined,
          color: "var(--fg)",
          flex: 1,
        }}
      >
        {step.sample}
      </div>
    </div>
  );
}

export function TypeScaleSection() {
  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--fg-faint)",
          marginBottom: 16,
        }}
      >
        Plus Jakarta Sans · JetBrains Mono — sizes resolve from{" "}
        <code style={{ background: "var(--bg-sub)", padding: "1px 4px", borderRadius: 3 }}>
          --text-*
        </code>{" "}
        tokens
      </p>
      {TYPE_STEPS.map((s) => (
        <TypeRow key={s.token} step={s} />
      ))}
    </div>
  );
}
