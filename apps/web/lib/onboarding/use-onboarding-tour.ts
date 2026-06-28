"use client";

/**
 * useOnboardingTour — drives the driver.js product tour.
 *
 * Responsibilities:
 *  - Build a theme-correct driver instance (popover class + overlay color chosen
 *    from the live app theme, because the body-mounted popover can't inherit the
 *    /app shell's `.dark` class — see the `.dewlock-tour` skin in globals.css).
 *  - Pick the desktop vs mobile step set at start time (viewport may change).
 *  - Filter steps whose anchor isn't painted yet so no spotlight lands on nothing.
 *  - Auto-start exactly once on first visit (global flag), and expose `startTour`
 *    for the Guide-panel replay button (which ignores the flag).
 */

import { useCallback, useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { buildTourSteps } from "./tour-steps";
import { hasSeenTour, markTourSeen } from "./tour-storage";

interface UseOnboardingTourOptions {
  /** Live app theme — picks the dark/light popover skin + overlay dim. */
  isDark: boolean;
  /** True only when the connected chat shell (where the anchors live) is mounted. */
  enabled: boolean;
  /** Optional — turns the final step's primary button into a "Show me an example" CTA. */
  onFinishDemo?: () => void;
}

const MOBILE_QUERY = "(max-width: 767px)";
const AUTO_START_DELAY_MS = 600; // let the chat shell paint its anchors first

export function useOnboardingTour({ isDark, enabled, onFinishDemo }: UseOnboardingTourOptions) {
  // Read theme at drive() time via a ref so a mid-session toggle is reflected on replay
  // without re-creating the callback (popover class is fixed once a run starts).
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  // Same ref pattern for the finale CTA handler — keeps runTour stable.
  const onFinishDemoRef = useRef(onFinishDemo);
  onFinishDemoRef.current = onFinishDemo;

  // Guards a single auto-start per mount; reset across mounts is fine (the seen-flag gates re-fire).
  const autoStartedRef = useRef(false);
  // Re-entrancy guard: a second concurrent run (e.g. overlapping StrictMode dev mounts) must
  // not stack a second driver overlay — driver.js does not dedupe instances.
  const tourActiveRef = useRef(false);

  const runTour = useCallback((force: boolean) => {
    if (typeof window === "undefined") return;
    if (tourActiveRef.current) return;
    if (!force && hasSeenTour()) return;

    const dark = isDarkRef.current;
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;

    // Element-less steps (the intro) always pass; element steps must resolve AND be visible
    // (querySelector matches display:none nodes, so check the box model too — robust against
    // a viewport/step-set mismatch pointing at a responsively-hidden anchor).
    const steps = buildTourSteps({ isMobile }).filter((step) => {
      if (!step.element) return true;
      const el = document.querySelector(step.element as string) as HTMLElement | null;
      return !!el && el.offsetParent !== null;
    });
    if (steps.length === 0) return;

    // Forward-declared so the finale CTA's onNextClick can destroy the tour it belongs to.
    let tour: ReturnType<typeof driver> | undefined;

    // Turn the final step's primary button into a "Show me an example" CTA when a handler
    // is provided. The X / ESC still closes without launching the demo.
    const finishDemo = onFinishDemoRef.current;
    if (finishDemo) {
      const lastIdx = steps.length - 1;
      const last = steps[lastIdx];
      steps[lastIdx] = {
        ...last,
        popover: {
          ...last.popover,
          doneBtnText: "Show me an example ▶",
          onNextClick: () => {
            tour?.destroy(); // fires onDestroyed → seen-flag + guard release
            finishDemo();
          },
        },
      };
    }

    tourActiveRef.current = true;
    tour = driver({
      showProgress: true,
      smoothScroll: true,
      allowClose: true,
      overlayColor: dark ? "rgba(0, 0, 0, 0.6)" : "rgba(11, 18, 32, 0.55)",
      popoverClass: `dewlock-tour dewlock-tour--${dark ? "dark" : "light"}`,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      steps,
      // Fires on finish AND on close/ESC — single place to record "seen" + release the guard.
      onDestroyed: () => {
        tourActiveRef.current = false;
        markTourSeen();
      },
    });
    tour.drive();
  }, []);

  // Auto-start: first visit, once the connected chat shell is enabled.
  useEffect(() => {
    if (!enabled || autoStartedRef.current || hasSeenTour()) return;
    autoStartedRef.current = true;
    const timer = window.setTimeout(() => runTour(false), AUTO_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, runTour]);

  // Replay entry point (Guide panel) — bypasses the seen-flag.
  const startTour = useCallback(() => runTour(true), [runTour]);

  return { startTour };
}
