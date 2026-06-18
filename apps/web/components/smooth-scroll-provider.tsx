"use client";

/**
 * Lenis smooth scroll provider.
 * Wraps the page with Lenis and syncs it with requestAnimationFrame.
 * Adds .lenis and .lenis-smooth classes to <html> for the CSS integration in globals.css.
 *
 * Scoped to marketing/document-flow routes only. The /app shell is a fixed
 * 100vh layout with its own native inner scroll containers (chat thread,
 * sidebar). Lenis hijacks wheel events globally and preventDefaults them while
 * driving the non-scrollable window, which blocks those inner containers — so
 * Lenis is disabled on /app. Navigating in/out re-inits or destroys it.
 */

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const enabled = !pathname?.startsWith("/app");

  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [enabled]);

  return <>{children}</>;
}
