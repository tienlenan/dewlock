"use client";

/**
 * BlockTeaser — "Proof a BLOCK happened" section.
 *
 * Layout: 2-column (copy left, dark verdict panel right).
 * Card matches the mockup's guardian·dry-run·re-derive style:
 *   - Dark bg-ink panel with mac-style traffic-light dots header
 *   - "guardian · dry-run" / "re-derive on" header labels
 *   - You typed / SuiNS resolved rows
 *   - Guardian detected row (red highlight)
 *   - Lookalike explanation paragraph
 *   - Min-out re-derive row (red)
 *   - BLOCKED stamp rotated −4°
 */

import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { COPY } from "@/lib/landing/copy";

const { blockTeaser: C } = COPY;

export function BlockTeaser() {
  return (
    <section
      id="block-teaser"
      className="section-pad relative overflow-hidden bg-transparent"
      aria-labelledby="block-teaser-heading"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2">

          {/* LEFT — copy */}
          <ScrollReveal>
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent-ink">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              {C.eyebrow}
            </p>
            <h2
              id="block-teaser-heading"
              className="font-display font-bold tracking-tight text-fg"
              style={{ fontSize: "var(--text-display)", lineHeight: "var(--lh-heading)" }}
            >
              Proof a{" "}
              <span style={{ color: "var(--destructive)" }}>BLOCK</span>{" "}
              happened.
            </h2>
            <p
              className="mt-4 max-w-md leading-relaxed text-fg-muted"
              style={{ fontSize: "var(--text-body)", lineHeight: "var(--lh-body-lg)" }}
            >
              {C.sub}
            </p>

            {/* 2 numbered bullets */}
            <div className="mt-6 space-y-3 max-w-[30em]">
              <div className="flex items-start gap-3">
                <span
                  className="flex-none flex h-[22px] w-[22px] items-center justify-center rounded-md font-bold text-accent-ink"
                  style={{ background: "var(--accent-soft)", fontSize: "var(--text-sm)" }}
                >
                  1
                </span>
                <span
                  className="leading-relaxed text-fg-muted"
                  style={{ fontSize: "var(--text-base)", lineHeight: "var(--lh-body)" }}
                >
                  <b className="font-semibold text-fg">Independently checkable.</b>{" "}
                  The raw 0x mismatch is shown so anyone can verify the block was real.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span
                  className="flex-none flex h-[22px] w-[22px] items-center justify-center rounded-md font-bold text-accent-ink"
                  style={{ background: "var(--accent-soft)", fontSize: "var(--text-sm)" }}
                >
                  2
                </span>
                <span
                  className="leading-relaxed text-fg-muted"
                  style={{ fontSize: "var(--text-base)", lineHeight: "var(--lh-body)" }}
                >
                  <b className="font-semibold text-fg">Anchored on-chain.</b>{" "}
                  An immutable Walrus near-miss receipt is written async — never blocking the hard stop.
                </span>
              </div>
            </div>
          </ScrollReveal>

          {/* RIGHT — Guardian verdict card (dark console) */}
          <ScrollReveal delay={0.12}>
            <GuardianBlockCard />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

/**
 * GuardianBlockCard — dark mono panel styled like the mockup's Guardian console.
 * Shows: header with traffic-light dots, intent label, address rows,
 * Guardian detected row in red, lookalike paragraph, BLOCKED stamp.
 */
function GuardianBlockCard() {
  return (
    <div
      className="w-full overflow-hidden rounded-2xl border border-border-dark bg-bg-ink shadow-card font-mono"
      style={{ boxShadow: "var(--shadow-lg)" }}
      role="img"
      aria-label="Guardian block card showing a lookalike address detected and transaction blocked"
    >
      {/* Mac-style traffic-light header */}
      <div className="flex items-center gap-2 border-b border-border-dark px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff5f57" }} aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#febc2e" }} aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#28c840" }} aria-hidden />
        <span
          className="ml-2 uppercase tracking-[0.12em] text-fg-faint"
          style={{ fontSize: "var(--text-xs)" }}
        >
          guardian · dry-run
        </span>
        <span
          className="ml-auto text-accent-2"
          style={{ fontSize: "var(--text-xs)", letterSpacing: "0.1em" }}
        >
          re-derive on
        </span>
      </div>

      {/* Intent line */}
      <div className="px-4 pt-4 pb-0">
        <div
          className="text-fg-faint"
          style={{ fontSize: "var(--text-sm)", lineHeight: "var(--lh-mono)" }}
        >
          <span className="text-accent-2">intent ›</span>{" "}
          swap 10 SUI → USDC, send to 888.sui
        </div>
      </div>

      {/* Address verification rows */}
      <div className="px-4 pt-4 space-y-2" style={{ fontSize: "var(--text-sm)" }}>
        {/* You typed */}
        <div className="flex justify-between gap-3">
          <span style={{ color: "hsl(210 12% 56%)" }}>You typed</span>
          <span className="text-fg-inverse">888.sui</span>
        </div>
        {/* SuiNS resolved */}
        <div className="flex justify-between gap-3">
          <span style={{ color: "hsl(210 12% 56%)" }}>SuiNS resolved</span>
          <span className="text-fg-inverse">0x3a4f…c912</span>
        </div>
        {/* Guardian detected — red highlight row */}
        <div
          className="flex justify-between gap-3 rounded-lg px-3 py-2"
          style={{
            background: "color-mix(in srgb, var(--destructive) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--destructive) 45%, transparent)",
          }}
        >
          <span className="text-destructive">Guardian detected</span>
          <span className="font-semibold text-destructive">0x3a4f…c913</span>
        </div>
      </div>

      {/* Lookalike explanation */}
      <p
        className="px-4 pt-3 pb-0 leading-relaxed"
        style={{ fontSize: "var(--text-sm)", lineHeight: "1.5", color: "hsl(210 14% 64%)" }}
      >
        Lookalike{" "}
        <span className="text-fg-inverse">888-l.sui</span>{" "}
        resolved to a different address. Refused before signature — no wallet prompt, no fee.
      </p>

      {/* Min-out re-derive */}
      <div
        className="mx-4 mt-3 rounded-lg px-3 py-2"
        style={{
          background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--destructive) 35%, transparent)",
          fontSize: "var(--text-sm)",
        }}
      >
        <div className="flex justify-between gap-3">
          <span className="text-destructive">min-out re-derived</span>
          <span className="font-semibold text-destructive">9,847 vs 847 USDC</span>
        </div>
        <div
          className="mt-1 text-right"
          style={{ color: "hsl(210 14% 54%)", fontSize: "var(--text-xs)" }}
        >
          90% slippage · hard block
        </div>
      </div>

      {/* BLOCKED stamp + caption */}
      <div className="flex items-center gap-4 px-4 pt-4 pb-5">
        {/* Rotated stamp — matches mockup −4° rotate */}
        <span
          className="inline-block border-2 border-destructive px-4 py-2 font-bold text-destructive"
          style={{
            borderRadius: "7px",
            transform: "rotate(-4deg)",
            fontSize: "var(--text-card)",
            letterSpacing: "0.06em",
            animation: "stampIn 0.45s cubic-bezier(0.16,1,0.3,1) both",
          }}
          aria-label="Transaction BLOCKED"
        >
          BLOCKED
        </span>
        <span
          className="leading-snug"
          style={{ fontSize: "var(--text-xs)", color: "hsl(210 14% 64%)" }}
        >
          Transaction refused.<br />No wallet prompt. No fee.
        </span>
      </div>
    </div>
  );
}
