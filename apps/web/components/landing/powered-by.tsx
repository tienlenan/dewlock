"use client";

/**
 * PoweredBy — minimal "powered by" logo strip, sits directly under the hero.
 *
 * Centered title + two-line description, then one centered row of brand logos
 * with NO background chips. All logos render monochrome (ink in light mode,
 * inverted to light in dark mode) for a cohesive logo-wall look. Mastra/Gemini
 * are inline marks + wordmark; Sui/Walrus/Memwal are static SVG lockups from
 * /public/logos (mark + wordmark baked in).
 */

import { TECH_MARKS, type TechMarkKey } from "@/components/landing/tech-logos";
import { COPY } from "@/lib/landing/copy";

const { poweredBy: C } = COPY;

export function PoweredBy() {
  return (
    <section
      className="border-b border-border bg-transparent py-14 sm:py-16"
      aria-labelledby="powered-by-heading"
    >
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2
          id="powered-by-heading"
          className="font-display font-bold tracking-tight text-fg"
          style={{ fontSize: "var(--text-section)", lineHeight: "var(--lh-heading)" }}
        >
          {C.title}
        </h2>
        <p
          className="mx-auto mt-3 max-w-[52ch] leading-relaxed text-fg-muted"
          style={{ fontSize: "var(--text-body)", lineHeight: "var(--lh-body)" }}
        >
          {C.sub}
        </p>
      </div>

      {/* Logo wall — uniform height, no background, centered, wraps on mobile */}
      <ul className="mx-auto mt-9 flex max-w-5xl list-none flex-wrap items-center justify-center gap-x-10 gap-y-6 px-6">
        {C.items.map((item) => (
          <li key={item.key}>
            <BrandLogo item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

type BrandItem = (typeof C.items)[number];

/**
 * Per-logo optical height (px). Brand lockups bake their wordmark at different
 * proportions, so a single shared height makes wordmark-heavy marks (Walrus)
 * loom over mark-heavy ones (Sui). These are tuned by eye for even visual weight.
 */
const LOGO_HEIGHT: Record<string, number> = {
  mastra: 32,
  gemini: 32,
  sui: 30,
  walrus: 22,
  seal: 20,
  memwal: 40,
};

function BrandLogo({ item }: { item: BrandItem }) {
  const common =
    "flex items-center opacity-70 transition-opacity duration-200 hover:opacity-100";
  const h = LOGO_HEIGHT[item.key] ?? 26;

  // Static SVG lockup (mark + wordmark baked in) — invert in dark mode.
  if (item.kind === "img" && "src" in item) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={common} aria-label={item.name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.src}
          alt={item.name}
          width={item.w}
          height={item.h}
          style={{ height: h }}
          // Flatten each lockup to a single ink tone so the wall reads evenly and
          // stays legible on both themes: pure ink in light, white in dark.
          className="w-auto [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)]"
          loading="lazy"
        />
      </a>
    );
  }

  // Inline mark + wordmark (Mastra / Gemini) — currentColor adapts to theme.
  const Mark = TECH_MARKS[item.key as TechMarkKey];
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className={`${common} gap-2 text-fg`}
      aria-label={item.name}
    >
      <Mark style={{ height: h, width: h }} />
      <span className="font-display font-semibold tracking-tight" style={{ fontSize: 21 }}>
        {item.name}
      </span>
    </a>
  );
}
