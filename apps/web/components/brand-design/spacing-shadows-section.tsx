/**
 * Spacing scale, radius variants, and shadow elevation showcase.
 * Visual bars/boxes are sized from --space-* tokens read via CSS vars;
 * no hardcoded pixel values that could drift from globals.css.
 */
"use client";

const SPACE_STEPS = [
  { token: "--space-1", label: "4px" },
  { token: "--space-2", label: "8px" },
  { token: "--space-3", label: "12px" },
  { token: "--space-4", label: "16px" },
  { token: "--space-5", label: "24px" },
  { token: "--space-6", label: "32px" },
  { token: "--space-7", label: "48px" },
  { token: "--space-8", label: "64px" },
];

const RADIUS_STEPS = [
  { px: "4px", label: "0.25rem · button / input" },
  { px: "8px", label: "0.5rem" },
  { px: "10px", label: "10px · card variant" },
  { px: "12px", label: "12px · showcase card" },
  { px: "9999px", label: "pill / badge" },
];

const SHADOW_STEPS = [
  { token: "--shadow-sm", label: "sm · subtle lift" },
  { token: "--shadow-md", label: "md · card elevation" },
  { token: "--shadow-lg", label: "lg · modal / popover" },
  { token: "--shadow-aqua", label: "aqua · focus ring / CTA glow" },
];

export function SpacingShadowsSection() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>

      {/* Spacing scale */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          background: "var(--bg-elev)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--fg-faint)",
            marginBottom: 16,
          }}
        >
          Spacing scale — 4px base
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {SPACE_STEPS.map(({ token, label }) => (
            <div key={token} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--fg-subtle)",
                  width: 52,
                  flexShrink: 0,
                }}
              >
                {label}
              </span>
              <div
                style={{
                  height: 10,
                  width: `var(${token})`,
                  background: "var(--accent)",
                  borderRadius: 2,
                  minWidth: 4,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  color: "var(--fg-faint)",
                }}
              >
                {token}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Radius + elevation */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          background: "var(--bg-elev)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--fg-faint)",
            marginBottom: 14,
          }}
        >
          Radius — --radius base 0.25rem
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 24 }}>
          {RADIUS_STEPS.map(({ px, label }) => (
            <div key={px} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: "var(--accent-soft)",
                  border: "1px solid var(--accent)",
                  borderRadius: px,
                }}
              />
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--fg-subtle)",
                  marginTop: 5,
                  maxWidth: 52,
                  wordBreak: "break-word",
                }}
              >
                {px}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--fg-faint)",
            marginBottom: 14,
          }}
        >
          Elevation shadows
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {SHADOW_STEPS.map(({ token, label }) => (
            <div key={token} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 60,
                  height: 44,
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: `var(${token})`,
                }}
              />
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--fg-subtle)",
                  marginTop: 6,
                  maxWidth: 64,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
