"use client";

/**
 * HowItWorks — 4 steps, left-aligned header, monochrome cards + card-hover.
 *
 * Header: left-aligned eyebrow + h2 + subcopy (editorial rhythm, matches hero).
 * Cards: monochrome surface (no colour tint classes), card-hover for
 * pastel-sky reveal. Icon colour uses --accent-ink throughout.
 */

import { MessageCircle, Blocks, ShieldCheck, PenLine } from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { COPY } from "@/lib/landing/copy";

const { howItWorks: C } = COPY;

const STEP_META = [
  { Icon: MessageCircle },
  { Icon: Blocks        },
  { Icon: ShieldCheck   },
  { Icon: PenLine       },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="section-pad bg-transparent"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section heading — left-aligned */}
        <ScrollReveal className="mb-8">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent-ink">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {C.eyebrow}
          </p>
          <h2
            id="how-it-works-heading"
            className="font-display font-bold tracking-tight text-fg"
            style={{ fontSize: "var(--text-display)", lineHeight: "var(--lh-heading)" }}
          >
            {C.headline}
          </h2>
          <p
            className="mt-3 max-w-lg leading-relaxed text-fg-muted"
            style={{ fontSize: "var(--text-base)", lineHeight: "var(--lh-body)" }}
          >
            {C.sub}
          </p>
        </ScrollReveal>

        {/* Cards grid — 4 equal columns on lg, 2 on md, 1 on mobile */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch auto-rows-fr">
          {C.steps.map((step, i) => {
            const { Icon } = STEP_META[i];
            return (
              <ScrollReveal key={step.number} delay={i * 0.08} className="h-full">
                <StepCard step={step} Icon={Icon} />
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface StepCardProps {
  step: (typeof C.steps)[number];
  Icon: React.ElementType;
}

/**
 * StepCard — monochrome surface, pastel-sky hover via .card-hover.
 * Step number + icon in --accent-ink; no per-step colour variation.
 */
function StepCard({ step, Icon }: StepCardProps) {
  return (
    <div
      className={[
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border",
        "card-pad bg-card shadow-card card-hover",
      ].join(" ")}
    >
      {/* Step number */}
      <span
        className="split-mono mb-3 text-accent-ink"
        aria-hidden
      >
        {step.number}
      </span>

      {/* Icon */}
      <Icon
        className="relative h-9 w-9 text-accent-ink"
        strokeWidth={1.0}
        aria-hidden
      />

      {/* Title */}
      <h3
        className="relative mt-4 font-bold tracking-tight text-fg"
        style={{ fontSize: "var(--text-md)" }}
      >
        {step.label}
      </h3>

      {/* Description bullets */}
      <ul className="relative mt-2.5 flex-1 space-y-2">
        {step.desc.split(". ").filter(Boolean).map((sentence, si) => (
          <li
            key={si}
            className="flex items-start gap-2.5 leading-relaxed text-fg-muted"
            style={{ fontSize: "var(--text-base)", lineHeight: "var(--lh-body)" }}
          >
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60"
              aria-hidden
            />
            <span>{sentence.endsWith(".") ? sentence : `${sentence}.`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
