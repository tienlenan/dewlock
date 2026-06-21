"use client";

/**
 * BlockCard — renders a Guardian BLOCK verdict.
 *
 * WHY visually strong: the BLOCK is the product's core security story.
 * Destructive red + the rotated "BLOCKED" stamp signal immediately that
 * no funds moved and the Guardian refused to build the tx.
 *
 * Security affordances (must never be removed):
 *  - "You typed" shows raw input
 *  - "Saved contact" shows the expected 0x address
 *  - "Resolved now" shows what SuiNS actually resolved to (the diff)
 *  - "Lookalike" note with the differing character
 *
 * Visual: matches mockup "guardian · verdict · BLOCKED" — bg-ink dark panel,
 * rotated stamp, destructive border, monospace grid.
 */

export interface BlockCardProps {
  reasons: string[];
  gates: string[];
}

/** Highlight raw 0x addresses in monospace for visual diff. */
function ReasonText({ text }: { text: string }) {
  const parts = text.split(/(0x[0-9a-fA-F]{8,})/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("0x") ? (
          <code
            key={i}
            className="mono"
            style={{
              fontSize: "11px",
              background: "color-mix(in srgb, var(--destructive) 16%, transparent)",
              padding: "1px 4px",
              borderRadius: 3,
              wordBreak: "break-all",
            }}
          >
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

function gateLabel(gate: string): string {
  const labels: Record<string, string> = {
    suins_lookalike: "Lookalike address",
    tx_cap: "Spend cap exceeded",
    daily_cap: "Daily limit exceeded",
    allowlist: "Unauthorized contract",
    coin_type: "Unknown coin type",
    coin_type_out: "Unknown output coin",
    coin_allowlist: "Unverified token",
    slippage_tolerance: "Slippage too high",
    low_liquidity: "Low liquidity",
    injection_provenance: "Unverified origin",
    trusted_price: "No trusted price",
    min_out: "Min-out mismatch",
    dry_run: "Simulation failed",
    cap_config: "Cap config error",
    build: "Transaction build error",
    input_validation: "Invalid input",
  };
  return labels[gate] ?? gate;
}

/**
 * Parse structured fields from reasons for mockup-style grid display.
 * Falls back to raw reason list for unknown formats.
 */
function parseBlockFields(reasons: string[]): {
  typed?: string;
  savedContact?: string;
  resolvedNow?: string;
  lookalike?: string;
} {
  const fields: ReturnType<typeof parseBlockFields> = {};
  for (const r of reasons) {
    const lower = r.toLowerCase();
    if (lower.includes("typed") || lower.includes("you sent")) {
      const m = r.match(/["']?([^"']+)["']?\s*(?:→|->|to\s)/i);
      if (m) fields.typed = m[1].trim();
    }
    // Only a real address / .sui name is a "saved contact". Requiring an
    // address-like value stops false matches such as the swap shape-gate reason
    // "an unexpected value-moving command…" (substring "expected") from being
    // mis-rendered as a contact row, which would hide the real reason text.
    if (lower.includes("saved contact") || lower.includes("expected")) {
      const m = r.match(/(?:saved contact|expected)[:\s]+(0x[0-9a-fA-F]{6,}|[^\s,]+\.sui)/i);
      if (m) fields.savedContact = m[1].trim();
    }
    if (lower.includes("resolved") && !lower.includes("already")) {
      const m = r.match(/resolved[^0x]*(0x[0-9a-fA-F]+)/i);
      if (m) fields.resolvedNow = m[1];
    }
    if (lower.includes("lookalike") || lower.includes("similar")) {
      const m = r.match(/lookalike[:\s]+([^\s.]+)/i);
      if (m) fields.lookalike = m[1].trim();
    }
  }
  return fields;
}

export function BlockCard({ reasons, gates }: BlockCardProps) {
  const fields = parseBlockFields(reasons);
  const hasStructured = fields.typed || fields.savedContact || fields.resolvedNow;

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        maxWidth: "440px",
        border: "1px solid color-mix(in srgb, var(--destructive) 38%, transparent)",
        borderRadius: "14px",
        background: "var(--bg-ink)",
        boxShadow: "var(--shadow-md)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* ── Header — "guardian · verdict" + rotated BLOCKED stamp ── */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "13px 16px", borderBottom: "1px solid var(--border-dark)" }}
      >
        <span
          className="split-mono"
          style={{ fontSize: "10px", letterSpacing: "0.12em", color: "hsl(210 12% 56%)" }}
        >
          guardian · verdict
        </span>
        {/* Rotated stamp — role="status" announces the verdict to screen readers
            when this component mounts (aria-live implicit on role=status). */}
        <span
          role="status"
          aria-label="Transaction blocked by Guardian"
          style={{
            display: "inline-block",
            padding: "5px 12px",
            border: "2px solid var(--destructive)",
            borderRadius: "7px",
            transform: "rotate(-3deg)",
            color: "var(--destructive)",
            fontWeight: 700,
            fontSize: "14px",
            letterSpacing: "0.06em",
            animation: "stampIn 0.4s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          BLOCKED
        </span>
      </div>

      {/* ── Body ── */}
      <div
        style={{
          padding: "16px",
          display: "grid",
          gap: "10px",
          fontSize: "12.5px",
          color: "hsl(205 18% 86%)",
        }}
      >
        {/* Structured fields — mockup grid style */}
        {hasStructured ? (
          <>
            {fields.typed && (
              <BlockRow label="You typed" value={fields.typed} />
            )}
            {fields.savedContact && (
              <BlockRow label="Saved contact" value={fields.savedContact} />
            )}
            {fields.resolvedNow && (
              /* Highlight row — destructive tint, exact mockup */
              <div
                className="flex items-center justify-between"
                style={{
                  padding: "9px 11px",
                  background: "color-mix(in srgb, var(--destructive) 16%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--destructive) 45%, transparent)",
                  borderRadius: "8px",
                }}
              >
                <span style={{ color: "var(--destructive)" }}>Resolved now</span>
                <span style={{ color: "var(--destructive)", fontWeight: 600 }}>
                  {fields.resolvedNow}
                </span>
              </div>
            )}
            {fields.lookalike && (
              <p style={{ fontSize: "11.5px", color: "hsl(210 14% 64%)", lineHeight: 1.5, margin: 0 }}>
                Lookalike{" "}
                <span style={{ color: "#fff" }}>{fields.lookalike}</span>
                {" "}· differs at the last char. Transaction refused — no wallet prompt, no fee.
              </p>
            )}
          </>
        ) : (
          /* Fallback: raw reasons list */
          reasons.map((reason, i) => (
            <div
              key={i}
              style={{
                borderLeft: "2px solid color-mix(in srgb, var(--destructive) 40%, transparent)",
                paddingLeft: 10,
                lineHeight: 1.45,
                color: "hsl(205 18% 86%)",
              }}
            >
              <ReasonText text={reason} />
            </div>
          ))
        )}

        {/* Gate badges */}
        {gates.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {gates.map((gate) => (
              <span
                key={gate}
                className="split-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--destructive)",
                  background: "color-mix(in srgb, var(--destructive) 14%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--destructive) 38%, transparent)",
                  padding: "3px 8px",
                  borderRadius: 99,
                }}
              >
                {gateLabel(gate)}
              </span>
            ))}
          </div>
        )}

        {/* "What to do" note */}
        <div
          style={{
            padding: "10px 12px",
            background: "color-mix(in srgb, var(--bg-dark) 60%, transparent)",
            border: "1px solid var(--border-dark)",
            borderRadius: "8px",
            fontSize: "11.5px",
            color: "hsl(210 12% 56%)",
            lineHeight: 1.5,
          }}
        >
          Transaction refused —{" "}
          <span style={{ color: "hsl(205 18% 86%)" }}>no wallet prompt, no fee.</span>
          {" "}Review the reason above and correct your intent.
        </div>
      </div>
    </div>
  );
}

function BlockRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "hsl(210 12% 56%)" }}>{label}</span>
      <span style={{ color: "#fff" }}>{value}</span>
    </div>
  );
}
