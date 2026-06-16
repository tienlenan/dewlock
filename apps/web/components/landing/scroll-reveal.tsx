"use client";

/**
 * ScrollReveal — transparent pass-through wrapper.
 *
 * Content is always visible (opacity:1) — no dependency on JS animations,
 * IntersectionObserver, or motion/react RAF advancing. The previous approach
 * using motion.div initial={{ opacity:0 }} caused blank pages when motion's
 * animate() never fired. This wrapper is a plain div; the children render
 * normally in SSR and on hydration.
 *
 * The delay/yOffset props are kept for API compatibility but have no effect.
 * Entrance animations can be re-added as CSS @keyframes in globals.css if
 * desired — with the BASE state being opacity:1 so content is never hidden.
 */

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  yOffset?: number;
}

export function ScrollReveal({ children, className }: ScrollRevealProps) {
  return <div className={className}>{children}</div>;
}
