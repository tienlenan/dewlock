/**
 * Onboarding-tour seen-state — a single global localStorage flag.
 *
 * Global (not per-wallet) by product decision: once a person has seen the tour
 * in this browser, it never auto-opens again regardless of which wallet connects.
 * The Guide-panel "Take the tour" button bypasses this flag to replay on demand.
 */

const TOUR_SEEN_KEY = "dewlock:tour-completed";

export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    // localStorage unavailable (private mode) — treat as not seen; tour is harmless.
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}
