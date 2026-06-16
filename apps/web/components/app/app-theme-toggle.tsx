"use client";

/**
 * AppThemeToggle — local light/dark toggle scoped to the /app shell.
 *
 * Independent from next-themes global provider used by the landing.
 * Reads/writes localStorage key "dewlock-app-theme".
 * Calls onToggle so the /app shell can apply the `dark` class to its root.
 */

import { cn } from "@/lib/utils";

interface AppThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  className?: string;
}

export function AppThemeToggle({ isDark, onToggle, className }: AppThemeToggleProps) {
  return (
    <button
      type="button"
      aria-label={isDark ? "Switch app to light mode" : "Switch app to dark mode"}
      onClick={onToggle}
      className={cn(
        "w-8 h-8 flex items-center justify-center border border-border text-fg-muted",
        "hover:border-accent hover:text-accent",
        "transition-colors duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        className,
      )}
      style={{ borderRadius: "var(--radius-1)" }}
    >
      {isDark ? (
        /* Sun — switch to light */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon — switch to dark */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
