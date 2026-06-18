"use client";

/**
 * WhySui — "Built on Sui" section.
 *
 * Layout: title + subtitle above a horizontal row of 4 cards.
 * Cards stack to 2-col on sm, single col on mobile.
 *
 * Color scheme: 4 distinct pastel tints per card (sky / periwinkle / peach / mint).
 * Each card has a 3px colored top-bar accent + matching icon color.
 * Section background: transparent (seamless with page canvas) — no gray bg-sub.
 * Dark mode: tints flip to --tint-* dark values via .dark token overrides.
 */

import { Wallet, BookOpen, Database, Bot } from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { COPY } from "@/lib/landing/copy";

const { whySui: C } = COPY;

/**
 * Per-card tint config — sky / periwinkle / peach / mint.
 * Each card is a white surface with a soft top-down pastel wash: the tint is
 * color-mixed toward transparent so it fades out by ~46% of the card height.
 * Periwinkle is a vivid hue, so it mixes at a lower strength than the others.
 */
const TRACK_META = [
  { Icon: Wallet,   tint: "--tint-sky",        mixPct: 60, iconColor: "text-[hsl(205_90%_48%)]", iconColorDark: "dark:text-accent-ink" },
  { Icon: BookOpen, tint: "--tint-periwinkle", mixPct: 26, iconColor: "text-[hsl(218_65%_50%)]", iconColorDark: "dark:text-[hsl(218_70%_72%)]" },
  { Icon: Database, tint: "--tint-peach",      mixPct: 60, iconColor: "text-[hsl(28_80%_50%)]",  iconColorDark: "dark:text-[hsl(28_80%_68%)]" },
  { Icon: Bot,      tint: "--tint-mint",       mixPct: 60, iconColor: "text-[hsl(150_52%_38%)]", iconColorDark: "dark:text-[hsl(150_52%_58%)]" },
] as const;

/** Vertical pastel wash over a white card base — tint fades to transparent by 46%. */
const cardWash = (tint: string, pct: number) =>
  `linear-gradient(180deg, color-mix(in srgb, var(${tint}) ${pct}%, transparent) 0%, transparent 46%)`;

export function WhySui() {
  return (
    <section
      className="section-pad border-b border-border bg-transparent"
      aria-labelledby="why-sui-heading"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section header — left-aligned, consistent with rest of landing */}
        <ScrollReveal className="mb-8">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent-ink">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {C.eyebrow}
          </p>
          <h2
            id="why-sui-heading"
            className="font-display font-bold tracking-tight text-fg"
            style={{ fontSize: "var(--text-display)", lineHeight: "var(--lh-heading)" }}
          >
            {C.headline}
          </h2>
          <p
            className="mt-4 max-w-[36em] leading-relaxed text-fg-muted"
            style={{ fontSize: "var(--text-body)", lineHeight: "var(--lh-body-lg)" }}
          >
            {C.sub}
          </p>
        </ScrollReveal>

        {/* Single horizontal row of 4 cards — stacks on smaller viewports */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch auto-rows-fr">
          {C.tracks.map((track, i) => {
            const meta = TRACK_META[i];
            return (
              <ScrollReveal key={track.label} delay={i * 0.06} className="h-full">
                <TrackCard track={track} meta={meta} />
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface TrackCardProps {
  track: (typeof C.tracks)[number];
  meta: (typeof TRACK_META)[number];
}

/**
 * TrackCard — white surface with a soft top-down pastel wash (token-driven, so
 * it adapts to light/dark automatically). No top-bar stripe.
 */
function TrackCard({ track, meta }: TrackCardProps) {
  const { Icon, tint, mixPct, iconColor, iconColorDark } = meta;
  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card card-pad shadow-card card-hover"
      style={{ backgroundImage: cardWash(tint, mixPct) }}
    >
      {/* Icon — tint-matched color per card */}
      <Icon
        className={["relative mt-1 h-7 w-7", iconColor, iconColorDark].join(" ")}
        strokeWidth={1.2}
        aria-hidden
      />

      {/* Track label */}
      <p
        className="relative mt-3.5 font-semibold text-fg"
        style={{ fontSize: "var(--text-body)" }}
      >
        {track.label}
      </p>

      {/* Tech stack — mono label with left border */}
      <p
        className="mono relative mt-1 border-l-2 border-accent/30 pl-2.5 leading-relaxed text-fg-subtle"
        style={{ fontSize: "var(--text-xs)", letterSpacing: "0.04em" }}
      >
        {track.tech}
      </p>

      {/* Description */}
      <p
        className="relative mt-3 flex-1 leading-relaxed text-fg-muted"
        style={{ fontSize: "var(--text-base)", lineHeight: "var(--lh-body)" }}
      >
        {track.desc}
      </p>
    </div>
  );
}
