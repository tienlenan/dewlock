"use client";

/**
 * Footer — Dewlock mark, tagline, network badge, external links.
 * Stays on water-ink so the dark stage carries through to page bottom.
 * Layout: brand block (left) + a vertical link column (right); bottom strip carries
 * the copyright (left) and the Privacy / Terms dialogs (right).
 */

import Image from "next/image";
import Link from "next/link";
import { COPY } from "@/lib/landing/copy";
import { LegalLinks } from "./legal-dialog";
import { GithubMark } from "./github-mark";

const { footer: C, nav } = COPY;

export function Footer() {
  return (
    <footer
      style={{ background: "var(--bg-dark)" }}
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-start">
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
            <p className="split-mono text-xs text-fg-faint opacity-60">
              Built for Sui Overflow 2026 · hackathon submission
            </p>
          </div>

          {/* Links — stacked vertically, right-aligned on desktop */}
          <nav aria-label="Footer navigation">
            <ul className="flex list-none flex-col items-start gap-3 p-0 sm:items-end">
              {C.links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("http") ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="split-mono text-fg-subtle transition-colors duration-150 hover:text-accent"
                    >
                      {link.label === "GitHub" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <GithubMark className="h-[13px] w-[13px]" />
                          {link.label}
                        </span>
                      ) : (
                        link.label
                      )}
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

        {/* Bottom strip — copyright (left) · Privacy / Terms dialogs (right) */}
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border-dark pt-6 sm:flex-row sm:items-center">
          <p className="split-mono text-xs text-fg-faint">
            © {new Date().getFullYear()} Dewlock
          </p>
          <ul className="flex list-none items-center gap-5 p-0">
            <LegalLinks />
          </ul>
        </div>
      </div>
    </footer>
  );
}
