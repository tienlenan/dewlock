"use client";

/**
 * SecurityTrust — 6 Guardian gates.
 *
 * Header cluster left-aligned (eyebrow + h2 + subcopy), matching hero rhythm.
 * Cards: monochrome surface, no colour tints/gradients, card-hover for
 * pastel-sky reveal on interaction. Icon colour uses --accent-ink.
 */

import {
  KeyRound,
  RefreshCcw,
  Coins,
  ScanSearch,
  AlertOctagon,
  ListChecks,
} from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { COPY } from "@/lib/landing/copy";

const { security: C } = COPY;

const GATE_META = [
  { Icon: KeyRound     },
  { Icon: RefreshCcw   },
  { Icon: Coins        },
  { Icon: ScanSearch   },
  { Icon: AlertOctagon },
  { Icon: ListChecks   },
] as const;

export function SecurityTrust() {
  return (
    <section
      id="security"
      className="section-pad bg-transparent"
      aria-labelledby="security-heading"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section heading — LEFT-aligned to match hero + walrus-receipts */}
        <ScrollReveal className="mb-8">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent-ink">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {C.eyebrow}
          </p>
          <h2
            id="security-heading"
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

          {/* "Sealed" disambiguation — Guardian metaphor, not the Seal encryption product */}
          <div
            className="mt-4 max-w-xl rounded-xl border border-border bg-card/70 px-4 py-3 shadow-sm backdrop-blur"
            style={{ borderLeftWidth: "3px", borderLeftColor: "var(--accent)" }}
          >
            <p
              className="font-semibold text-fg"
              style={{ fontSize: "var(--text-sm)", lineHeight: "var(--lh-body)" }}
            >
              {C.note.lead}
            </p>
            <p
              className="mt-1 leading-relaxed text-fg-muted"
              style={{ fontSize: "var(--text-sm)", lineHeight: "var(--lh-body)" }}
            >
              {C.note.body}
            </p>
          </div>
        </ScrollReveal>

        {/* Gates grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 items-stretch auto-rows-fr">
          {C.gates.map((gate, i) => {
            const { Icon } = GATE_META[i];
            return (
              <ScrollReveal key={gate.label} delay={i * 0.07} className="h-full">
                <GateCard gate={gate} Icon={Icon} />
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface GateCardProps {
  gate: (typeof C.gates)[number];
  Icon: React.ElementType;
}

/**
 * GateCard — monochrome surface, no colour gradient background.
 * card-hover applies pastel-sky reveal on pointer interaction.
 */
function GateCard({ gate, Icon }: GateCardProps) {
  return (
    <div
      className={[
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border",
        "card-pad bg-card shadow-card card-hover",
      ].join(" ")}
    >
      {/* Icon — single accent colour */}
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
        {gate.label}
      </h3>

      {/* Description */}
      <p
        className="relative mt-2 flex-1 leading-relaxed text-fg-muted"
        style={{ fontSize: "var(--text-base)", lineHeight: "var(--lh-body)" }}
      >
        {gate.desc}
      </p>
    </div>
  );
}
