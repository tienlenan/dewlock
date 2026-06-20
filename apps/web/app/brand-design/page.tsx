/**
 * /brand-design — living style guide for the Dewlock design system.
 *
 * Dev/brand reference only; not linked from the main nav.
 * All token values are read live from CSS custom properties — nothing
 * here hard-codes hex literals that could drift from globals.css.
 */

import { ColorSwatchesWrapper } from "@/components/brand-design/color-swatches-wrapper";
import { TypeScaleSection } from "@/components/brand-design/type-scale-section";
import { SpacingShadowsSection } from "@/components/brand-design/spacing-shadows-section";
import { SampleComponentsSection } from "@/components/brand-design/sample-components-section";
import { ThinkingLoadersSection } from "@/components/brand-design/thinking-loaders-section";
import { BrandLogo } from "@/components/brand/brand-logo";

export const metadata = {
  title: "Brand Design — Dewlock Design System",
  description: "Living style guide: tokens, type scale, spacing, and sample components.",
};

type SectionProps = {
  title: string;
  sub?: string;
  children: React.ReactNode;
};

function Section({ title, sub, children }: SectionProps) {
  return (
    <section style={{ marginBottom: 56 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--fg)",
          }}
        >
          {title}
        </h2>
        {sub && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--fg-faint)",
            }}
          >
            {sub}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export default function BrandDesignPage() {
  return (
    <div
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        minHeight: "100vh",
        fontFamily: "var(--font-sans)",
        letterSpacing: "-0.01em",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "color-mix(in srgb, var(--bg) 82%, transparent)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "18px clamp(20px, 5vw, 40px)",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* Dewlock logo mark — canonical BrandLogo (theme-aware dewdrop) */}
          <BrandLogo variant="mark" height={28} />
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "-0.03em",
                color: "var(--fg)",
              }}
            >
              dew<span style={{ color: "var(--accent)" }}>lock</span>{" "}
              <span style={{ color: "var(--fg-faint)", fontWeight: 500 }}>
                / design system
              </span>
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--fg-subtle)",
            }}
          >
            Tokens · one set, two themes
          </div>
        </div>
      </header>

      {/* Body */}
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "clamp(36px, 6vw, 64px) clamp(20px, 5vw, 40px)",
        }}
      >
        {/* Intro */}
        <div style={{ maxWidth: 640, marginBottom: 56 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--accent-ink)",
            }}
          >
            Tokens · one set, two themes
          </span>
          <h1
            style={{
              margin: "14px 0 0",
              fontSize: "clamp(30px, 5vw, 46px)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.02,
              color: "var(--fg)",
            }}
          >
            A calm, precise system for moving real money.
          </h1>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--fg-muted)",
            }}
          >
            Cool near-white canvas, one confident Sui-blue, pastel multi-tints,
            always-dark water-ink panels. Every token flips cleanly between light
            and dark — both themes shown simultaneously in each section.
          </p>
        </div>

        {/* 1. Color */}
        <Section title="Color" sub="flips light · dark">
          {/* ColorSwatchesWrapper is a client component that resolves computed values */}
          <ColorSwatchesWrapper />
        </Section>

        {/* 2. Typography */}
        <Section title="Typography" sub="Plus Jakarta Sans · JetBrains Mono">
          <TypeScaleSection />
        </Section>

        {/* 3. Spacing, radius, elevation */}
        <Section title="Spacing, radius & elevation" sub="4px base · 0.25rem radius">
          <SpacingShadowsSection />
        </Section>

        {/* 4. Sample components — shown in dual-theme side-by-side */}
        <Section title="Components" sub="buttons · badges · card · address row">
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--fg-faint)",
              marginBottom: 18,
            }}
          >
            Rendered below in the page&apos;s current theme. Toggle via next-themes
            dev tools or append{" "}
            <code
              style={{
                background: "var(--bg-sub)",
                padding: "1px 5px",
                borderRadius: 3,
                fontFamily: "var(--font-mono)",
              }}
            >
              ?theme=dark
            </code>{" "}
            to the URL to switch.
          </p>
          <SampleComponentsSection />
        </Section>

        {/* 5. Thinking loaders — dot-matrix wait indicators */}
        <Section title="Thinking loaders" sub="dot-matrix · random per request">
          <ThinkingLoadersSection />
        </Section>
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--bg-sub)",
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "22px clamp(20px, 5vw, 40px)",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--fg-faint)",
          }}
        >
          dewlock design tokens · globals.css · light-default, dark flip
        </div>
      </footer>
    </div>
  );
}
