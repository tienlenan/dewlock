/**
 * Dot-matrix thinking loaders showcase — the indicators shown in the gap
 * between an agent request and the first response token.
 *
 * Three visually distinct variants live in a rotation pool; AgentThinkingLoader
 * picks one (plus a wait-phrase) at random per request. Captions/labels read
 * from design tokens — no hardcoded hex that could drift from globals.css.
 */
"use client";

import type { ComponentType } from "react";

import { AgentThinkingLoader } from "@/components/chat/agent-thinking-loader";
import { DotmSquare3 } from "@/components/ui/dotm-square-3";
import { DotmSquare5 } from "@/components/ui/dotm-square-5";
import { DotmSquare6 } from "@/components/ui/dotm-square-6";
import type { DotMatrixCommonProps } from "@/components/ui/dotmatrix-core";

const VARIANTS: ReadonlyArray<{
  Loader: ComponentType<DotMatrixCommonProps>;
  label: string;
}> = [
  { Loader: DotmSquare3, label: "square-3 · Core Spiral" },
  { Loader: DotmSquare5, label: "square-5 · Prism Sweep" },
  { Loader: DotmSquare6, label: "square-6 · Flux Columns" },
];

const monoLabel = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "var(--fg-faint)",
};

export function ThinkingLoadersSection() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 18,
        color: "var(--accent)",
      }}
    >
      {/* Variant pool */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          background: "var(--bg-elev)",
        }}
      >
        <div style={{ ...monoLabel, marginBottom: 18 }}>Rotation pool</div>
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap", alignItems: "flex-start" }}>
          {VARIANTS.map(({ Loader, label }) => (
            <figure key={label} style={{ display: "grid", gap: 12, justifyItems: "center", margin: 0 }}>
              <Loader size={48} dotSize={6} />
              <figcaption
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  color: "var(--fg-subtle)",
                }}
              >
                {label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {/* In-context indicator */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          background: "var(--bg-elev)",
        }}
      >
        <div style={{ ...monoLabel, marginBottom: 18 }}>
          AgentThinkingLoader — random pick per request
        </div>
        <AgentThinkingLoader />
      </div>
    </div>
  );
}
