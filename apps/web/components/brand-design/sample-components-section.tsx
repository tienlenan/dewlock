/**
 * Token-driven sample components: buttons, badges, card, mono address row,
 * and the aqua-glow focus ring. All colours come from CSS custom properties;
 * no scattered hex literals.
 */
"use client";

export function SampleComponentsSection() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>

      {/* Buttons */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 22, background: "var(--bg-elev)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 16 }}>
          Buttons
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, alignItems: "flex-start" }}>
          {/* Primary — uses --shadow-aqua for the glow ring */}
          <button
            style={{
              height: 42, padding: "0 18px",
              background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: 9,
              fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
              cursor: "pointer", boxShadow: "var(--shadow-aqua)",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M5 8l2 2 4-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Confirm &amp; Sign
          </button>
          {/* Secondary */}
          <button
            style={{
              height: 42, padding: "0 18px",
              background: "var(--bg-elev)", color: "var(--fg)",
              border: "1px solid var(--border-strong)", borderRadius: 9,
              fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Secondary
          </button>
          {/* Ghost */}
          <button
            style={{
              height: 42, padding: "0 14px",
              background: "transparent", color: "var(--accent-ink)",
              border: "none", borderRadius: 9,
              fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ghost link →
          </button>
          {/* Destructive */}
          <button
            style={{
              height: 42, padding: "0 18px",
              background: "var(--destructive)", color: "#fff",
              border: "none", borderRadius: 9,
              fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
              cursor: "not-allowed", opacity: 0.95,
            }}
          >
            Blocked
          </button>
        </div>
      </div>

      {/* Badges & chips */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 22, background: "var(--bg-elev)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 16 }}>
          Badges &amp; chips
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center", marginBottom: 20 }}>
          {/* Network badge — success dot */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--fg-muted)", border: "1px solid var(--border)",
            background: "var(--bg-sub)", padding: "5px 10px", borderRadius: 99,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--success)" }} />
            sui:mainnet
          </span>
          {/* Warning badge */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--warning)",
            border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
            background: "color-mix(in srgb, var(--warning) 12%, transparent)",
            padding: "5px 10px", borderRadius: 99,
          }}>
            devnet
          </span>
          {/* Blocked badge */}
          <span style={{
            display: "inline-flex", alignItems: "center",
            fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--destructive)",
            border: "1px solid color-mix(in srgb, var(--destructive) 40%, transparent)",
            background: "color-mix(in srgb, var(--destructive) 12%, transparent)",
            padding: "5px 10px", borderRadius: 99,
          }}>
            blocked
          </span>
          {/* Accent pill */}
          <span style={{
            display: "inline-flex", alignItems: "center",
            fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--accent-ink)",
            border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            background: "var(--accent-soft)",
            padding: "5px 10px", borderRadius: 99,
          }}>
            post_only
          </span>
        </div>

        {/* Mono address row */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 10 }}>
          Address chips
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {/* Named contact chip */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--bg-sub)", border: "1px solid var(--border)",
            borderRadius: 99, padding: "6px 12px",
            fontSize: 13, color: "var(--fg)",
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 99,
              background: "var(--accent-soft)", color: "var(--accent-ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700,
            }}>
              8
            </span>
            888.sui
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>
              0x3a4f…c912
            </span>
          </span>
          {/* Raw address chip */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "var(--bg-sub)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "6px 11px",
            fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg)",
          }}>
            0x9c2a…f41b{" "}
            <span style={{ color: "var(--accent-ink)", cursor: "pointer" }}>⧉</span>
          </span>
        </div>
      </div>

      {/* Card sample */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 22, background: "var(--bg-elev)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 16 }}>
          Card · always-dark panel
        </div>
        {/* Elevated card on dark */}
        <div style={{
          background: "var(--bg-ink)", border: "1px solid var(--border-dark)",
          borderRadius: 10, padding: 16,
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent-ink)", marginBottom: 10 }}>
            SUI:MAINNET · TRADE
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, color: "var(--fg-inverse)", marginBottom: 6 }}>
            9,847.00 <span style={{ color: "var(--fg-muted)", fontSize: 14 }}>USDC</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: "var(--lh-body)", marginBottom: 12 }}>
            Swap 10 SUI → USDC at market. Guardian verified.
          </div>
          <div style={{
            background: "var(--bg-dark)", border: "1px solid var(--border-dark)",
            borderRadius: 6, padding: "8px 10px",
            fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)",
            lineHeight: "var(--lh-mono)",
          }}>
            intent › swap 10 SUI → USDC<br />
            blob 3vK…x9q2
          </div>
        </div>

        {/* Aqua focus ring demo */}
        <div style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 10 }}>
          Aqua focus ring — --shadow-aqua
        </div>
        <button style={{
          height: 38, padding: "0 16px",
          background: "var(--bg-elev)", color: "var(--accent-ink)",
          border: "1px solid var(--accent)", borderRadius: 8,
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
          cursor: "pointer",
          /* Persistent aqua ring so it's visible without interaction */
          boxShadow: "var(--shadow-aqua)",
        }}>
          Focused state
        </button>
      </div>

    </div>
  );
}
