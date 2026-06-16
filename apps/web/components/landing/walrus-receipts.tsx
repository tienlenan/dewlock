"use client";

/**
 * WalrusReceipts — content-addressed immutable receipt + Sui-object anchor.
 *
 * Layout: 2-column (copy + numbered feature list LEFT, receipt card mock RIGHT).
 * Matches the mockup's arrangement: copy/features on left, card on right.
 * The numbered list uses 01/02/03 mono labels (mockup style).
 */

import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { COPY } from "@/lib/landing/copy";

const { walrus: C } = COPY;

export function WalrusReceipts() {
  return (
    <section
      id="receipts"
      className="section-pad border-b border-border bg-transparent"
      aria-labelledby="receipts-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2">

          {/* LEFT — copy + numbered feature list */}
          <div>
            <ScrollReveal>
              <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent-ink">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                {C.eyebrow}
              </p>
              <h2
                id="receipts-heading"
                className="font-display font-bold tracking-tight text-fg"
                style={{ fontSize: "var(--text-display)", lineHeight: "var(--lh-heading)" }}
              >
                {/* Break after the period so "On-chain anchored." sits on its own line */}
                Content-addressed.
                <br />
                On-chain anchored.
              </h2>
              <p
                className="mt-4 max-w-lg leading-relaxed text-fg-muted"
                style={{ fontSize: "var(--text-body)", lineHeight: "var(--lh-body-lg)" }}
              >
                {C.sub}
              </p>
            </ScrollReveal>

            {/* Numbered feature list — 01/02/03 mono labels, mockup style */}
            <ScrollReveal delay={0.1} className="mt-7 space-y-4">
              {C.features.map((f, i) => (
                <div key={f.label} className="flex gap-3">
                  <span
                    className="flex-none font-mono text-accent-ink pt-0.5"
                    style={{ fontSize: "var(--text-xs)", minWidth: "1.75rem" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div
                      className="font-semibold text-fg"
                      style={{ fontSize: "var(--text-base)" }}
                    >
                      {f.label}
                    </div>
                    <div
                      className="mt-0.5 leading-relaxed text-fg-muted"
                      style={{ fontSize: "var(--text-base)", lineHeight: "var(--lh-body)" }}
                    >
                      {f.desc}
                    </div>
                  </div>
                </div>
              ))}
            </ScrollReveal>
          </div>

          {/* RIGHT — receipt card mock */}
          <ScrollReveal delay={0.18}>
            <ReceiptMockCard />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

/**
 * ReceiptMockCard — near-miss receipt card matching the mockup's layout:
 * header (label + BLOCKED badge), mono field rows (blob id / sui object /
 * verdict / timestamp), footer qualifier note.
 */
function ReceiptMockCard() {
  const r = C.receiptCard;
  return (
    <div
      className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-card shadow-card"
      role="img"
      aria-label="Example Walrus near-miss receipt showing a blocked transaction"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <span className="split-mono text-fg-muted">{r.label}</span>
        <span
          className="split-mono rounded-full px-2.5 py-1 text-destructive"
          style={{
            background: "color-mix(in srgb, var(--destructive) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--destructive) 30%, transparent)",
          }}
        >
          {r.status}
        </span>
      </div>

      {/* Fields — mono rows */}
      <div className="space-y-2.5 px-4 py-4 font-mono" style={{ fontSize: "var(--text-sm)" }}>
        <ReceiptRow label="blob id" value={r.blobId} copyable />
        <ReceiptRow label="sui object" value={r.suiObject} copyable />
        <ReceiptRow label="verdict" value={r.verdict} danger />
        <ReceiptRow label="timestamp" value={r.timestamp} />
      </div>

      {/* Qualifier note */}
      <div className="border-t border-border bg-secondary/50 px-4 py-3">
        <p
          className="leading-relaxed text-fg-subtle"
          style={{ fontSize: "var(--text-xs)", lineHeight: "var(--lh-body)" }}
        >
          {r.note}
        </p>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  danger = false,
  copyable = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex-none text-fg-muted" style={{ minWidth: "6rem" }}>{label}</span>
      <span
        className={[
          "text-right break-all",
          danger ? "text-destructive" : "text-fg",
        ].join(" ")}
      >
        {value}
        {copyable && (
          <span className="ml-1.5 cursor-pointer text-accent-ink" aria-hidden>⧉</span>
        )}
      </span>
    </div>
  );
}
