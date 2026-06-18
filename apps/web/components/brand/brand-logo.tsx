/**
 * BrandLogo — inline, theme-aware Dewlock logo.
 *
 * Rendered as inline SVG (not <img>) so the wordmark uses the page's
 * Plus Jakarta Sans webfont, and every color tracks the active theme via CSS
 * variables — no asset swap between light/dark, no flash.
 *
 * The mark is a plump dewdrop (var(--accent)) with a keyhole painted on top of
 * the opaque drop. The keyhole uses var(--fg): near-black in the light theme,
 * near-white in the dark theme, so it stays legible on the bright drop in both.
 * A shoulder highlight (var(--accent-2)) gives the dew its sheen.
 *
 * variant="mark" renders the icon alone; "full" adds the "dewlock" wordmark.
 * `height` is the rendered height in px; width scales from the viewBox.
 *
 * Standalone SVG/PNG assets for favicon, og-image and README live in
 * public/brand/ and app/ (regenerate the PNGs with `pnpm gen:icons`).
 */

interface BrandLogoProps {
  /** "full" = mark + wordmark · "mark" = icon only */
  variant?: "full" | "mark";
  /** Rendered height in px — width scales proportionally */
  height?: number;
  className?: string;
  title?: string;
}

// Aspect ratios from the SVG viewBoxes: full=332×88, mark=76×88
const FULL_RATIO = 332 / 88;
const MARK_RATIO = 76 / 88;

// Canonical dewdrop (origin-centered): soft-pointed top, true-circle bulb bottom.
const DROP =
  "M0 -36 C5 -30,35 -16,35 8 A35 35 0 1 1 -35 8 C-35 -16,-5 -30,0 -36 Z";

function Mark() {
  return (
    <g transform="translate(38 44) scale(0.88)">
      <path d={DROP} fill="var(--accent)" />
      {/* keyhole — tracks --fg so it flips dark↔light with the theme */}
      <circle cx="0" cy="6" r="8.7" fill="var(--fg)" />
      <path d="M-4.3 6 L4.3 6 L2.8 30 L-2.8 30 Z" fill="var(--fg)" />
      {/* dew sheen */}
      <circle cx="-13" cy="-5" r="5.3" fill="var(--accent-2)" />
    </g>
  );
}

export function BrandLogo({
  variant = "full",
  height = 28,
  className,
  title = "Dewlock",
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <svg
        height={height}
        width={Math.round(height * MARK_RATIO)}
        viewBox="0 0 76 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={title}
        className={className}
      >
        <Mark />
      </svg>
    );
  }

  // Full lockup — wordmark "dew" tracks --fg, "lock" tracks the brand accent.
  return (
    <svg
      height={height}
      width={Math.round(height * FULL_RATIO)}
      viewBox="0 0 332 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      <Mark />
      <text
        x="86"
        y="71"
        fontFamily="var(--font-jakarta), ui-sans-serif, system-ui, sans-serif"
        fontSize="62"
        fontWeight="500"
        letterSpacing="-1.8"
        fill="var(--fg)"
      >
        dew<tspan fill="var(--accent)">lock</tspan>
      </text>
    </svg>
  );
}
