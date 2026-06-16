/**
 * Color swatches panel — renders every color token as a swatch with its
 * name and a script-resolved computed value. No hex literals here; all
 * colours come from live CSS custom properties via getComputedStyle.
 */
"use client";

import { useEffect, useRef, useState } from "react";

type SwatchDef = {
  token: string;
  label: string;
};

const SURFACE_TOKENS: SwatchDef[] = [
  { token: "--bg", label: "canvas" },
  { token: "--bg-sub", label: "recessed" },
  { token: "--bg-elev", label: "card surface" },
  { token: "--bg-dark", label: "hero · cta (always-dark)" },
  { token: "--bg-ink", label: "console · cards (always-dark)" },
];

const TEXT_TOKENS: SwatchDef[] = [
  { token: "--fg", label: "primary text" },
  { token: "--fg-muted", label: "body" },
  { token: "--fg-subtle", label: "captions" },
  { token: "--fg-faint", label: "disabled" },
  { token: "--fg-inverse", label: "text on dark panels" },
];

const BORDER_TOKENS: SwatchDef[] = [
  { token: "--border", label: "hairline" },
  { token: "--border-strong", label: "strong" },
  { token: "--border-dark", label: "on dark panels" },
];

const ACCENT_TOKENS: SwatchDef[] = [
  { token: "--accent", label: "primary action" },
  { token: "--accent-hover", label: "hover state" },
  { token: "--accent-ink", label: "text · AA" },
  { token: "--accent-soft", label: "tint fill" },
  { token: "--accent-2", label: "highlight" },
];

const TINT_TOKENS: SwatchDef[] = [
  { token: "--tint-sky", label: "sky" },
  { token: "--tint-periwinkle", label: "periwinkle" },
  { token: "--tint-blush", label: "blush" },
  { token: "--tint-peach", label: "peach" },
  { token: "--tint-mint", label: "mint" },
];

const STATUS_TOKENS: SwatchDef[] = [
  { token: "--success", label: "positive delta" },
  { token: "--warning", label: "caution" },
  { token: "--destructive", label: "block · negative" },
];

/** Reads a CSS custom property from the document root at render time. */
function useTokenValue(token: string, rootEl: HTMLElement | null): string {
  const [value, setValue] = useState("…");
  useEffect(() => {
    if (!rootEl) return;
    const v = getComputedStyle(rootEl).getPropertyValue(token).trim();
    setValue(v || "—");
  }, [token, rootEl]);
  return value;
}

function Swatch({
  token,
  label,
  rootEl,
}: {
  token: string;
  label: string;
  rootEl: HTMLElement | null;
}) {
  const value = useTokenValue(token, rootEl);
  return (
    <div
      style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}
    >
      <div
        style={{
          height: 56,
          background: `var(${token})`,
          borderBottom: "1px solid var(--border)",
        }}
      />
      <div style={{ padding: "8px 10px", background: "var(--bg-elev)" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            fontWeight: 600,
            color: "var(--fg)",
            marginBottom: 2,
          }}
        >
          {token}
        </div>
        <div style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-subtle)" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function SwatchGroup({
  title,
  tokens,
  rootEl,
}: {
  title: string;
  tokens: SwatchDef[];
  rootEl: HTMLElement | null;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--fg-subtle)",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: 10,
        }}
      >
        {tokens.map((t) => (
          <Swatch key={t.token} rootEl={rootEl} {...t} />
        ))}
      </div>
    </div>
  );
}

export function ColorSwatches({ rootEl }: { rootEl: HTMLElement | null }) {
  return (
    <div>
      <SwatchGroup title="Surfaces" tokens={SURFACE_TOKENS} rootEl={rootEl} />
      <SwatchGroup title="Ink / text" tokens={TEXT_TOKENS} rootEl={rootEl} />
      <SwatchGroup title="Borders" tokens={BORDER_TOKENS} rootEl={rootEl} />
      <SwatchGroup title="Accent — Sui sky-blue" tokens={ACCENT_TOKENS} rootEl={rootEl} />
      <SwatchGroup title="Pastel multi-tints" tokens={TINT_TOKENS} rootEl={rootEl} />
      <SwatchGroup title="Status — balance deltas & Guardian verdicts only" tokens={STATUS_TOKENS} rootEl={rootEl} />
    </div>
  );
}
