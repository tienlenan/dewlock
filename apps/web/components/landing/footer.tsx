"use client";

/**
 * Footer — Dewlock mark, tagline, network badge, external links.
 * Stays on water-ink so the dark stage carries through to page bottom.
 * Consistent with sales-ai footer visual weight.
 */

import Image from "next/image";
import Link from "next/link";
import { COPY } from "@/lib/landing/copy";

const { footer: C, nav } = COPY;

export function Footer() {
  return (
    <footer
      className="border-t border-border-dark"
      style={{ background: "var(--bg-dark)" }}
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          {/* Brand side */}
          <div className="flex flex-col gap-3">
            {/* Footer is always dark — use the light-text lockup unconditionally */}
            <Image
              src="/brand/logo-full-dark.svg"
              alt="Dewlock"
              width={Math.round(22 * (332 / 88))}
              height={22}
              priority
            />
            <p className="max-w-xs text-sm leading-relaxed text-fg-muted">{C.tagline}</p>
            <span
              className="split-mono flex items-center gap-1.5 text-xs text-fg-faint"
              aria-label="Network status"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              {nav.networkBadge}
            </span>
          </div>

          {/* Links */}
          <nav aria-label="Footer navigation">
            <ul className="flex list-none flex-col items-start gap-4 p-0 sm:flex-row sm:items-center sm:gap-6">
              {C.links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("http") ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="split-mono text-fg-subtle transition-colors duration-150 hover:text-accent"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="split-mono text-fg-subtle transition-colors duration-150 hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom strip */}
        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border-dark pt-6 sm:flex-row sm:items-center">
          <p className="split-mono text-xs text-fg-faint">
            © {new Date().getFullYear()} Dewlock · Sui Overflow 2026
          </p>
          <p className="split-mono text-xs text-fg-faint opacity-60">{C.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
