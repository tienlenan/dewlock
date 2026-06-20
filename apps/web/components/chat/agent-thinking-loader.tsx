"use client";

/**
 * AgentThinkingLoader — the "thinking" indicator shown in the gap between a
 * request being sent and the first response token arriving.
 *
 * Uses the vendored dot-matrix loaders (dotmatrix.zzzzshawn.cloud). One of a
 * small pool is chosen at random — but only AFTER mount: the server and the first
 * client render use the same deterministic entry (index 0), then a useEffect rolls
 * the random pick. Picking with Math.random() during render would diverge between
 * SSR and hydration (different variant → different markup) and throw a hydration
 * mismatch on any server-rendered page (e.g. /brand-design).
 *
 * Themed via `color: var(--accent)`; the loaders default to `currentColor`, so
 * the dots inherit the app accent and track light/dark automatically.
 */

import { useState, useEffect } from "react";
import type { ComponentType } from "react";

import { DotmSquare3 } from "@/components/ui/dotm-square-3";
import { DotmSquare5 } from "@/components/ui/dotm-square-5";
import { DotmSquare6 } from "@/components/ui/dotm-square-6";
import type { DotMatrixCommonProps } from "@/components/ui/dotmatrix-core";

// The rotation pool. Each is visually distinct: inward spiral, diagonal sweep,
// alternating columns. Add/remove entries to change the variety.
const LOADERS: ReadonlyArray<ComponentType<DotMatrixCommonProps>> = [
  DotmSquare3,
  DotmSquare5,
  DotmSquare6,
];

// Friendly wait-phrases, rolled per request alongside the loader so the gap
// reads a little livelier than a static "Thinking…". A couple lean on-chain
// to fit the Sui copilot voice.
const PHRASES: readonly string[] = [
  "On it…",
  "Working it out…",
  "Crunching the chain…",
  "Reading the chain…",
  "Cooking…",
];

export function AgentThinkingLoader() {
  // Deterministic on the server + first client render (index 0) so SSR markup
  // matches hydration; then roll a random loader + phrase once, after mount.
  const [loaderIdx, setLoaderIdx] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    setLoaderIdx(Math.floor(Math.random() * LOADERS.length));
    setPhraseIdx(Math.floor(Math.random() * PHRASES.length));
  }, []);
  const Loader = LOADERS[loaderIdx]!;
  const phrase = PHRASES[phraseIdx]!;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
        gap: 4,
        color: "var(--accent)",
        animation: "fadeUp 0.25s ease both",
      }}
    >
      <Loader size={18} dotSize={3} ariaLabel="Thinking" />
      <span
        style={{
          fontSize: 12,
          // line-height 1 so the text box hugs the glyphs — otherwise the default
          // line leading lifts the visible text above the loader's bottom edge and
          // flex-end can't actually bottom-align them.
          lineHeight: 1,
          color: "var(--fg-muted)",
          animation: "pulse 1.4s ease-in-out infinite",
        }}
      >
        {phrase}
      </span>
    </div>
  );
}
