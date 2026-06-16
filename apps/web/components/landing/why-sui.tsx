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

/** Per-card tint configuration — sky / periwinkle / peach / mint */
const TRACK_META = [
  {
    Icon: Wallet,
    /** sky: matches --tint-sky token */
    topBar: "bg-tint-sky",
    iconColor: "text-[hsl(205_90%_48%)]",
    /** dark: accent-ink on dark-sky tint */
    iconColorDark: "dark:text-accent-ink",
    cardBg: "bg-tint-sky dark:bg-[hsl(205_30%_18%)]",
    border: "border-[hsl(205_80%_82%)] dark:border-[hsl(205_25%_28%)]",
  },
  {
    Icon: BookOpen,
    /** periwinkle: hsl(218 70% 70%) tint */
    topBar: "bg-tint-periwinkle",
    iconColor: "text-[hsl(218_65%_50%)]",
    iconColorDark: "dark:text-[hsl(218_70%_72%)]",
    cardBg: "bg-[hsl(218_80%_96%)] dark:bg-[hsl(218_40%_22%)]",
    border: "border-[hsl(218_60%_84%)] dark:border-[hsl(218_28%_30%)]",
  },
  {
    Icon: Database,
    /** peach: matches --tint-peach token */
    topBar: "bg-tint-peach",
    iconColor: "text-[hsl(28_80%_50%)]",
    iconColorDark: "dark:text-[hsl(28_80%_68%)]",
    cardBg: "bg-tint-peach dark:bg-[hsl(24_26%_18%)]",
    border: "border-[hsl(28_80%_84%)] dark:border-[hsl(28_20%_28%)]",
  },
  {
    Icon: Bot,
    /** mint: matches --tint-mint token */
    topBar: "bg-tint-mint",
    iconColor: "text-[hsl(150_52%_38%)]",
    iconColorDark: "dark:text-[hsl(150_52%_58%)]",
    cardBg: "bg-tint-mint dark:bg-[hsl(150_18%_15%)]",
    border: "border-[hsl(150_48%_80%)] dark:border-[hsl(150_16%_24%)]",
  },
] as const;

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
 * TrackCard — pastel tinted surface with 3px colored top-bar accent.
 * Each of 4 cards uses a distinct tint: sky / periwinkle / peach / mint.
 * Light: soft pastel fill. Dark: muted deep tint via token flip.
 */
function TrackCard({ track, meta }: TrackCardProps) {
  const { Icon, topBar, iconColor, iconColorDark, cardBg, border } = meta;
  return (
    <div
      className={[
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border",
        "card-pad shadow-card card-hover",
        cardBg,
        border,
      ].join(" ")}
    >
      {/* Colored top-bar accent — 3px stripe at the very top */}
      <div
        className={["absolute inset-x-0 top-0 h-[3px]", topBar].join(" ")}
        aria-hidden
      />

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
