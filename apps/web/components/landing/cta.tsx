"use client";

/**
 * Cta — full-width dark call-to-action section.
 *
 * Phase-2 sizing:
 *  - Section padding: py-24/32 → .section-pad
 *  - Heading: text-4xl/5xl/6xl → --text-display clamp
 *  - Subcopy: text-lg → text-base; mt-5 → mt-3
 *  - CTA buttons: px-7 py-3.5 → px-5 py-2.5; gap-3 → gap-2.5
 *  - Disclaimer: mt-12 → mt-8
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { COPY } from "@/lib/landing/copy";

const { cta: C, footer: F } = COPY;

/** Inline GitHub mark — lucide-react dropped brand icons, so we ship our own. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 014 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Cta() {
  return (
    <section
      className="section-pad relative overflow-hidden"
      style={{ background: "var(--bg-dark)" }}
      aria-labelledby="cta-heading"
    >
      {/* Grid + radial glow */}
      <div className="absolute inset-0 grid-pattern opacity-15" aria-hidden />
      <div className="split-glow" aria-hidden />

      <div className="relative mx-auto max-w-6xl text-center">
        <ScrollReveal>
          {/* Network badge */}
          <p className="split-mono mb-5 text-fg-inverse opacity-40">{F.network}</p>

          <h2
            id="cta-heading"
            className="font-display font-bold tracking-tight text-fg-inverse"
            style={{ fontSize: "var(--text-display)", lineHeight: "var(--lh-heading)" }}
          >
            {C.headline}
          </h2>
          <p
            className="mx-auto mt-3 max-w-lg leading-relaxed text-fg-muted"
            style={{ fontSize: "var(--text-base)", lineHeight: "var(--lh-body)" }}
          >
            {C.sub}
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            {/* Primary */}
            <Link
              href="/app"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-fg-inverse px-5 py-2.5 text-sm font-semibold text-bg-dark shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {C.primary}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>

            {/* Secondary — white outline with GitHub icon */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-dark px-5 py-2.5 text-sm font-semibold text-fg-inverse shadow-sm transition-colors hover:border-accent hover:text-accent"
            >
              <GithubMark className="h-3.5 w-3.5" />
              {C.secondary}
            </a>
          </div>

          {/* Disclaimer */}
          <p className="split-mono mx-auto mt-8 max-w-md leading-relaxed text-fg-faint opacity-60">
            {F.disclaimer}
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
