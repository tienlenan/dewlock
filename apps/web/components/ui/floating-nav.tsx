"use client";

/**
 * FloatingNav — floating pill navigation bar.
 * Matches the sales-ai floating-navbar pattern:
 *   - White pill with backdrop-blur and soft shadow
 *   - Auto-hides on scroll-down, reappears on scroll-up
 *   - Dewlock mark + section anchors + theme toggle
 * Uses `motion/react` (installed as `motion` package).
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Sun, Moon, ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";
import { BrandLogo } from "@/components/brand/brand-logo";
import { COPY } from "@/lib/landing/copy";

const { nav } = COPY;

export function FloatingNav() {
  const [visible, setVisible] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY;
      if (y < 60) {
        setVisible(true);
      } else {
        setVisible(y < lastY); // show on scroll-up, hide on scroll-down
      }
      setLastY(y);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastY]);

  if (!mounted) return null;

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="floating-nav"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-5 md:top-7 inset-x-0 z-50 flex justify-center pointer-events-none"
          >
            {/* Pill container */}
            <nav
              aria-label="Primary navigation"
              className={[
                "pointer-events-auto",
                "flex items-center gap-2 md:gap-6 pl-4 pr-2 py-1.5 md:py-2",
                "rounded-2xl border border-border",
                "bg-card/80 backdrop-blur-xl",
                "shadow-nav",
                /* Full-width on mobile, max-fit on md+ */
                "w-[94%] md:w-auto md:max-w-fit mx-4",
              ].join(" ")}
            >
              {/* Brand mark — full lockup replaces separate mark + text */}
              <Link
                href="/"
                aria-label="Dewlock home"
                className="flex items-center group flex-shrink-0"
              >
                <BrandLogo variant="full" height={22} />
              </Link>

              {/* Desktop anchors */}
              <div className="hidden md:flex items-center gap-0.5">
                {nav.anchors.map((a) => (
                  <a
                    key={a.href}
                    href={a.href}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-fg-muted hover:text-fg hover:bg-foreground/5 transition-all duration-150"
                  >
                    {a.label}
                  </a>
                ))}
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-1 ml-auto md:ml-0">
                {/* Network badge — desktop */}
                <span
                  className="hidden md:flex items-center gap-1.5 split-mono text-fg-subtle text-xs mr-2"
                  aria-label={`Network: ${nav.networkBadge}`}
                >
                  <span className="inline-block w-1.5 h-1.5 bg-accent rounded-full animate-pulse" aria-hidden />
                  {nav.networkBadge}
                </span>

                {/* Theme toggle */}
                <button
                  type="button"
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:text-fg transition-colors"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" aria-hidden />
                  ) : (
                    <Moon className="h-4 w-4" aria-hidden />
                  )}
                </button>

                {/* Launch app CTA — desktop */}
                <Link
                  href="/app"
                  className={[
                    "group hidden md:inline-flex items-center gap-1.5 ml-1",
                    "px-4 py-2 rounded-lg text-sm font-semibold",
                    "bg-foreground text-background",
                    "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)] hover:-translate-y-0.5",
                    "transition-all duration-150 active:translate-y-0",
                  ].join(" ")}
                >
                  {nav.launchApp}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>

                {/* Mobile hamburger */}
                <button
                  type="button"
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  aria-controls="mobile-nav-dropdown"
                  className="md:hidden flex flex-col gap-1 p-2 text-fg"
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  {/* Animated hamburger lines — decorative, button label is the accessible name */}
                  <span aria-hidden className={`block w-5 h-px bg-current transition-transform duration-150 ${menuOpen ? "translate-y-1.5 rotate-45" : ""}`} />
                  <span aria-hidden className={`block w-5 h-px bg-current transition-opacity duration-150 ${menuOpen ? "opacity-0" : ""}`} />
                  <span aria-hidden className={`block w-5 h-px bg-current transition-transform duration-150 ${menuOpen ? "-translate-y-1.5 -rotate-45" : ""}`} />
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile dropdown — outside the pill so it can be full-width */}
      {menuOpen && (
        <nav
          id="mobile-nav-dropdown"
          aria-label="Mobile navigation"
          className="fixed top-[5rem] inset-x-4 z-40 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-nav px-4 py-4 flex flex-col gap-3 md:hidden"
        >
          {nav.anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="split-mono text-fg-muted hover:text-accent transition-colors text-sm py-2"
              onClick={() => setMenuOpen(false)}
            >
              {a.label}
            </a>
          ))}
          <Link
            href="/app"
            className="mt-2 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold"
            onClick={() => setMenuOpen(false)}
          >
            {nav.launchApp} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </nav>
      )}
    </>
  );
}
