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
import { GithubMark } from "@/components/landing/github-mark";
import { COPY } from "@/lib/landing/copy";

const { cta: C, footer: F } = COPY;

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
              href="https://github.com/tienlenan/dewlock"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-dark px-5 py-2.5 text-sm font-semibold text-fg-inverse shadow-sm transition-colors hover:border-accent hover:text-accent"
            >
              <GithubMark className="h-3.5 w-3.5" />
              {C.secondary}
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
