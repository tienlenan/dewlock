/**
 * Wraps any children in a forced light panel and a forced dark panel
 * side-by-side so both themes are visible simultaneously — proving
 * dark is a first-class theme, not an afterthought.
 *
 * Technique: the inner div carries className="dark" which cascades the
 * .dark custom-property overrides from globals.css into that subtree,
 * independent of the page-level next-themes value.
 */
"use client";

import { ReactNode } from "react";

type Props = {
  children: (theme: "light" | "dark") => ReactNode;
  label: string;
};

export function DualThemePanel({ children, label }: Props) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--fg-faint)",
          marginBottom: 12,
        }}
      >
        {label} — rendered in both themes simultaneously
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 2,
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Light panel — no forced class, inherits page theme defaults */}
        <div style={{ background: "hsl(205 38% 99%)", padding: 20 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "hsl(212 10% 68%)",
              marginBottom: 14,
            }}
          >
            ☀ Light
          </div>
          {/* Render into a non-.dark subtree so light tokens apply */}
          <div>{children("light")}</div>
        </div>

        {/* Dark panel — .dark class cascades overrides from globals.css */}
        <div className="dark" style={{ background: "hsl(213 26% 9%)", padding: 20 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "hsl(213 10% 38%)",
              marginBottom: 14,
            }}
          >
            ☾ Dark
          </div>
          {children("dark")}
        </div>
      </div>
    </div>
  );
}
