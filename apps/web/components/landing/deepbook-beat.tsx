"use client";

/**
 * DeepbookBeat — "wait at your price, don't market-buy."
 *
 * Header: left-aligned eyebrow + h2 + subcopy (editorial rhythm).
 * Comparison cards: two-tone treatment — AMM card uses peach tint (bad path),
 * CLOB card uses mint/sky tint (good path). Matching icon + badge + verdict colors.
 * Pipeline panel: right column, rebalanced with min-height + extra padding-top
 * so it sits vertically centred against the taller left column content.
 */

import { TrendingUp, Clock } from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { COPY } from "@/lib/landing/copy";

const { deepbook: C } = COPY;

/**
 * Per-card color treatment. Both cards are white surfaces with a soft top-down
 * pastel wash (tint color-mixed toward transparent): AMM (bad=true) → peach
 * caution wash, CLOB (bad=false) → sky positive wash. Icon / badge / verdict
 * accents carry the matching hue.
 */
const CARD_META = {
  bad: {
    tint: "--tint-peach",
    mixPct: 60,
    /** orange-peach icon to signal caution */
    iconColor: "text-[hsl(28_80%_50%)] dark:text-[hsl(28_80%_68%)]",
    badgeColor: "text-[hsl(28_80%_50%)] dark:text-[hsl(28_80%_68%)] border-[hsl(28_60%_78%)] dark:border-[hsl(28_24%_32%)]",
    verdictColor: "text-[hsl(28_80%_50%)] dark:text-[hsl(28_80%_68%)]",
    borderTop: "border-[hsl(28_60%_82%)] dark:border-[hsl(28_22%_30%)]",
  },
  good: {
    tint: "--tint-sky",
    mixPct: 60,
    /** sky-blue icon to signal positive path */
    iconColor: "text-[hsl(205_90%_42%)] dark:text-accent-ink",
    badgeColor: "text-[hsl(205_90%_42%)] dark:text-accent-ink border-[hsl(205_80%_78%)] dark:border-[hsl(205_30%_32%)]",
    verdictColor: "text-[hsl(205_90%_42%)] dark:text-accent-ink",
    borderTop: "border-[hsl(205_70%_82%)] dark:border-[hsl(205_26%_28%)]",
  },
} as const;

/** Vertical pastel wash over a white card base — tint fades to transparent by 46%. */
const cardWash = (tint: string, pct: number) =>
  `linear-gradient(180deg, color-mix(in srgb, var(${tint}) ${pct}%, transparent) 0%, transparent 46%)`;

export function DeepbookBeat() {
  return (
    <section
      id="deepbook"
      className="section-pad bg-transparent"
      aria-labelledby="deepbook-heading"
    >
      <div className="mx-auto max-w-6xl">
        {/* items-stretch so both columns can use h-full inside; lg:gap-12 gives panel room */}
        <div className="grid items-stretch gap-10 lg:grid-cols-2 lg:gap-12">

          {/* Left — copy + comparison cards */}
          <div>
            <ScrollReveal>
              <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent-ink">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                {C.eyebrow}
              </p>
              <h2
                id="deepbook-heading"
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

            {/* AMM vs CLOB comparison cards */}
            <ScrollReveal delay={0.1} className="mt-7">
              <div className="grid grid-cols-2 gap-3 items-stretch auto-rows-fr">
                {C.comparison.map((item) => {
                  const Icon = item.bad ? TrendingUp : Clock;
                  const meta = item.bad ? CARD_META.bad : CARD_META.good;
                  return (
                    <div
                      key={item.label}
                      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card card-pad shadow-card card-hover"
                      style={{ backgroundImage: cardWash(meta.tint, meta.mixPct) }}
                    >
                      <div className="mb-2.5 mt-1 flex items-center justify-between gap-2">
                        <Icon
                          className={["h-5 w-5", meta.iconColor].join(" ")}
                          strokeWidth={1.3}
                          aria-hidden
                        />
                        <span
                          className={["split-mono rounded border px-1.5 py-0.5", meta.badgeColor].join(" ")}
                        >
                          {item.bad ? "AMM" : "CLOB"}
                        </span>
                      </div>
                      <h3
                        className="font-semibold text-fg"
                        style={{ fontSize: "var(--text-base)" }}
                      >
                        {item.label}
                      </h3>
                      <p
                        className="mt-1.5 flex-1 leading-relaxed text-fg-muted"
                        style={{ fontSize: "var(--text-base)", lineHeight: "var(--lh-body)" }}
                      >
                        {item.detail}
                      </p>
                      <p
                        className={["mono mt-3 border-t pt-2.5", meta.verdictColor, meta.borderTop].join(" ")}
                        style={{ fontSize: "var(--text-xs)" }}
                      >
                        → {item.verdict}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="split-mono mt-3 text-fg-subtle">{C.caption}</p>
            </ScrollReveal>
          </div>

          {/* Right — intent→PTB code snippet, rebalanced:
               - h-full on the ScrollReveal wrapper so it stretches to column height
               - min-h-[280px] prevents it collapsing too short on small content
               - pt-10 nudges the panel down to optically centre against the left column */}
          <ScrollReveal delay={0.18} className="flex flex-col pt-10 lg:pt-10">
            <div className="flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border border-border-dark shadow-card">
              {/* Terminal header */}
              <div className="flex items-center gap-2 border-b border-white/10 bg-bg-ink px-5 py-2.5">
                <span className="h-2 w-2 rounded-full bg-white/20" aria-hidden />
                <span className="h-2 w-2 rounded-full bg-white/20" aria-hidden />
                <span className="h-2 w-2 rounded-full" style={{ background: "hsl(205 96% 72%)" }} aria-hidden />
                <span className="split-mono ml-2 text-fg-faint">intent → PTB pipeline</span>
              </div>
              {/* Code body — flex-1 so it fills remaining height */}
              <pre
                className="mono flex-1 overflow-x-auto whitespace-pre bg-bg-ink px-5 py-6 leading-7"
                style={{ fontSize: "var(--text-xs)" }}
                aria-label="Example: natural language intent flowing through the PTB pipeline"
              >
                {C.codeSnippet.split("\n").map((line, i) => {
                  const color =
                    line.startsWith("intent:") ? "hsl(205 90% 70%)"
                    : line.includes("Guardian") ? "hsl(206 90% 48%)"
                    : line.includes("wallet signs") ? "hsl(205 25% 96%)"
                    : line.includes("fill") ? "hsl(210 12% 62%)"
                    : "hsl(212 12% 46%)";
                  return (
                    <span key={i} className="block" style={{ color }}>
                      {line}
                    </span>
                  );
                })}
              </pre>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
