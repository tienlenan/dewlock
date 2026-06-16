/**
 * BrandLogo — theme-aware Dewlock logo component.
 *
 * Renders the correct SVG asset based on variant and the active CSS theme:
 *   - Light theme: logo-full-light.svg (dark text on light bg)
 *   - Dark  theme: logo-full-dark.svg  (light text on dark bg)
 *
 * Theme detection is pure CSS via Tailwind's `dark:` modifier — no JS, no
 * flash. The parent must supply the `dark` class (either on <html> via
 * next-themes, or on a subtree root as the /app shell does).
 *
 * variant="mark": renders the icon-only mark. On dark backgrounds the mark's
 * keyhole is recolored to light (#f2f5f7) via logo-mark-dark.svg so it stays
 * visible. On light backgrounds logo-mark.svg (dark keyhole) is used.
 */

import Image from "next/image";

interface BrandLogoProps {
  /** "full" = mark + wordmark · "mark" = icon only */
  variant?: "full" | "mark";
  /** Rendered height in px — width scales proportionally */
  height?: number;
  className?: string;
}

// Aspect ratios from the SVG viewBoxes: full=332×88, mark=76×88
const FULL_RATIO = 332 / 88; // ≈ 3.77
const MARK_RATIO = 76 / 88;  // ≈ 0.864

export function BrandLogo({
  variant = "full",
  height = 28,
  className,
}: BrandLogoProps) {
  const width =
    variant === "full"
      ? Math.round(height * FULL_RATIO)
      : Math.round(height * MARK_RATIO);

  if (variant === "mark") {
    return (
      <span className={`inline-flex items-center ${className ?? ""}`}>
        {/* Light background — dark keyhole mark */}
        <Image
          src="/brand/logo-mark.svg"
          alt="Dewlock"
          width={width}
          height={height}
          priority
          className="block dark:hidden"
        />
        {/* Dark background — light keyhole mark */}
        <Image
          src="/brand/logo-mark-dark.svg"
          alt="Dewlock"
          width={width}
          height={height}
          priority
          className="hidden dark:block"
        />
      </span>
    );
  }

  // Full lockup — wordmark changes color between themes
  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      {/* Light theme: dark text wordmark */}
      <Image
        src="/brand/logo-full-light.svg"
        alt="Dewlock"
        width={width}
        height={height}
        priority
        className="block dark:hidden"
      />
      {/* Dark theme: light text wordmark */}
      <Image
        src="/brand/logo-full-dark.svg"
        alt="Dewlock"
        width={width}
        height={height}
        priority
        className="hidden dark:block"
      />
    </span>
  );
}
