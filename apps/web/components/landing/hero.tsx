"use client";

/**
 * Hero — Dewlock landing hero section.
 *
 * Layout: 2-column on desktop (left = copy + stat strip + CTAs,
 * right = tx-preview card mock). Stacks to single column on mobile
 * (text above, card below). Left column is left-aligned, not centered.
 *
 * Motion: NONE on initial render. All elements start visible (opacity:1).
 * Using initial={false} everywhere so motion never applies opacity:0 inline
 * styles. This prevents the blank-page bug where motion's animate() RAF
 * never advanced the opacity from 0 to 1.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { COPY } from "@/lib/landing/copy";

const { hero: C } = COPY;

export function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden border-b border-border pt-24 pb-8 sm:pt-28"
      aria-labelledby="hero-heading"
    >
      {/* Aurora pastel backdrop */}
      <div className="aurora-bg" aria-hidden />

      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        {/* 2-col grid — stacks on mobile */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-14">

          {/* LEFT — copy, stat strip, CTAs */}
          <div className="flex-1 lg:max-w-[540px]">
            {/* Pill badge */}
            <div>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 py-1 pl-3 pr-4 text-xs font-medium text-fg-muted shadow-sm backdrop-blur">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                {C.eyebrow}
              </span>
            </div>

            {/* Headline */}
            <h1
              id="hero-heading"
              className="font-display font-bold tracking-[-0.035em] text-fg leading-[1.04]"
              style={{ fontSize: "var(--text-display)", lineHeight: "var(--lh-display)" }}
            >
              Every transaction,
              <br />
              <span className="text-gradient">sealed</span>{" "}
              before you sign.
            </h1>

            {/* Subcopy */}
            <p
              className="mt-4 max-w-[34em] leading-relaxed text-fg-muted"
              style={{ fontSize: "var(--text-body)", lineHeight: "var(--lh-body-lg)" }}
            >
              {C.sub}
            </p>

            {/* Dual CTA */}
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Link
                href="/app"
                className="group inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-aqua)] transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                {C.cta.primary}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>

              <a
                href={C.secondaryHref}
                className="inline-flex items-center rounded-xl border border-border-strong bg-card/70 px-5 py-2.5 text-sm font-semibold text-fg shadow-sm backdrop-blur transition-colors hover:bg-secondary"
              >
                {C.cta.secondary}
              </a>
            </div>

            {/* Stat strip — 3 honest facts about the current PTB state.
                Left-aligned under CTAs per the 2-col hero design. */}
            <div className="mt-8 split-cells cells-3 max-w-[480px]">
              {C.stats.map((stat) => (
                <div key={stat.label} className="bg-card px-4 py-3.5">
                  <div
                    className="font-mono uppercase tracking-[0.1em] text-accent-ink"
                    style={{ fontSize: "var(--text-2xs)" }}
                  >
                    {stat.label}
                  </div>
                  <div
                    className="mt-1.5 leading-snug text-fg-muted"
                    style={{ fontSize: "var(--text-sm)", lineHeight: "var(--lh-body)" }}
                  >
                    {stat.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — tx-preview card, always visible */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <TxPreviewCard />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * TxPreviewCard — mockup of the tx-preview / swap confirmation card shown
 * before the user signs. Mirrors the mockup's "Tx preview · swap" layout:
 * You pay / You receive blocks, then Min received / Destination / Network gas
 * detail rows, then a Confirm & Sign CTA.
 */
function TxPreviewCard() {
  return (
    <div
      className="w-full max-w-[390px] overflow-hidden rounded-2xl border border-border bg-card/88 shadow-card backdrop-blur-sm"
      role="img"
      aria-label="Tx preview card showing a swap of 10 SUI to approximately 38.42 USDC"
    >
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <span className="split-mono text-fg-muted">Tx preview · swap</span>
        <span className="font-mono text-[10px] tracking-wide text-success">dry-run ✓</span>
      </div>

      {/* Main body */}
      <div className="card-pad space-y-0">
        {/* You pay */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-bg-sub px-4 py-3.5">
          <div>
            <div className="split-mono text-fg-faint">You pay</div>
            <div
              className="mt-1 font-bold text-fg"
              style={{ fontSize: "var(--text-card)" }}
            >
              10.0{" "}
              <span
                className="font-semibold text-fg-muted"
                style={{ fontSize: "var(--text-base)" }}
              >
                SUI
              </span>
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-ink text-base select-none">
            ↓
          </div>
        </div>

        {/* You receive */}
        <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-bg-sub px-4 py-3.5">
          <div>
            <div className="split-mono text-fg-faint">You receive</div>
            <div
              className="mt-1 font-bold text-fg"
              style={{ fontSize: "var(--text-card)" }}
            >
              ~38.42{" "}
              <span
                className="font-semibold text-fg-muted"
                style={{ fontSize: "var(--text-base)" }}
              >
                USDC
              </span>
            </div>
          </div>
          <span className="font-mono text-[11px] text-success">+38.42</span>
        </div>

        {/* Detail rows */}
        <div className="mt-4 space-y-2.5">
          {DETAIL_ROWS.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <span
                className="text-fg-muted"
                style={{ fontSize: "var(--text-base)" }}
              >
                {row.label}
              </span>
              <span
                className="mono text-right text-fg"
                style={{ fontSize: "var(--text-base)" }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Sign CTA — visual only, not interactive in this mockup */}
        <button
          disabled
          aria-hidden
          className="mt-5 flex w-full cursor-default items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white opacity-90"
        >
          {/* Checkmark icon */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M5 8l2 2 4-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Confirm &amp; Sign in wallet
        </button>

        <p
          className="mt-3 text-center text-fg-faint"
          style={{ fontSize: "var(--text-xs)" }}
        >
          You sign the exact artifact shown above.
        </p>
      </div>
    </div>
  );
}

const DETAIL_ROWS = [
  { label: "Min received", value: "38.04 USDC" },
  { label: "Destination",  value: "0x9c2a…f41b" },
  { label: "Network gas",  value: "0.0021 SUI" },
] as const;
