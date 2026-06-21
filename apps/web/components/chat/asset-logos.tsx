"use client";

/**
 * asset-logos — shared brand marks for the swap + lending chat cards.
 *
 *  - CoinLogo: the token's real logo via a multi-source candidate chain
 *    (local self-hosted asset → curated CDN → CoinGecko host swap), falling back to a
 *    tinted monogram only when EVERY source fails. See coin-icon-source.ts.
 *  - ProtocolLogo: designed inline-SVG marks for lending protocols (navi / suilend)
 *    — crisp brand glyphs, not raw letters. Extend `PROTOCOL_MARKS` for new protocols.
 *
 * Pure presentation: display-only, no value path.
 */

import { useState } from "react";
import { resolveCoinIconCandidates } from "./coin-icon-source";

// ── Coin visuals ────────────────────────────────────────────────────────────
// Tints used for the monogram fallback (and a soft ring) per known symbol.
const COIN_TINT: Record<string, string> = {
  SUI: "#4da2ff",
  USDC: "#2775ca",
  USDT: "#26a17b",
  DEEP: "#1f6feb",
  WETH: "#627eea",
  WBTC: "#f7931a",
  CETUS: "#0aa3ff",
  WAL: "#0fb5a8",
  NS: "#5b8cff",
  BLUE: "#3b82f6",
};

function tintFor(symbol: string): string {
  return COIN_TINT[symbol.toUpperCase()] ?? "var(--accent)";
}

export function CoinLogo({
  symbol,
  logoUrl,
  size = 30,
}: {
  symbol: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const candidates = resolveCoinIconCandidates(symbol, logoUrl);
  const sig = candidates.join("|");
  // Track which candidate we're on AND the signature it belongs to, so reusing this
  // component for a DIFFERENT coin (React reconciles by position; e.g. the swap form's
  // token select) resets the chain during render — no stale index, no effect flash.
  const [walk, setWalk] = useState<{ sig: string; idx: number }>({ sig, idx: 0 });
  const idx = walk.sig === sig ? walk.idx : 0;
  const tint = tintFor(symbol);
  const src = candidates[idx];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        loading="lazy"
        // Advance to the next source on error; when exhausted, the monogram renders.
        onError={() => setWalk({ sig, idx: idx + 1 })}
        style={{ width: size, height: size, borderRadius: "50%", display: "block", objectFit: "cover", background: "var(--bg-sub)" }}
      />
    );
  }
  // Monogram fallback — tinted disc + the first 1-2 letters.
  return (
    <div
      aria-hidden
      className="shrink-0 flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `color-mix(in srgb, ${tint} 16%, var(--bg-elev))`,
        color: tint,
        border: `1px solid color-mix(in srgb, ${tint} 35%, transparent)`,
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: size * 0.36,
        letterSpacing: "-0.02em",
      }}
    >
      {symbol.slice(0, symbol.length > 3 ? 2 : symbol.length).toUpperCase()}
    </div>
  );
}

// ── Protocol marks ──────────────────────────────────────────────────────────
// Each mark draws into a 0 0 40 40 viewBox squircle. Keep them simple + on-brand.

function NaviMark() {
  return (
    <>
      <defs>
        <linearGradient id="navi-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0a3a4d" />
          <stop offset="1" stopColor="#0d5566" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#navi-bg)" />
      {/* teal upward sail / chevron wave */}
      <path d="M11 27 L20 11 L29 27 Z" fill="none" stroke="#34e0c8" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M14.5 27 L20 17 L25.5 27" fill="none" stroke="#7ff0e0" strokeWidth="2" strokeLinejoin="round" opacity="0.8" />
    </>
  );
}

function SuilendMark() {
  return (
    <>
      <defs>
        <linearGradient id="suilend-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b8cff" />
          <stop offset="1" stopColor="#1f5fe0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#suilend-bg)" />
      {/* white sui-style droplet */}
      <path
        d="M20 9c0 0 8 8.4 8 13.4a8 8 0 0 1-16 0C12 17.4 20 9 20 9Z"
        fill="#ffffff"
        opacity="0.96"
      />
      <path d="M16.4 21.5c.2 2.6 1.9 4.4 4 4.6" fill="none" stroke="#1f5fe0" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
    </>
  );
}

const PROTOCOL_MARKS: Record<string, () => React.JSX.Element> = {
  navi: NaviMark,
  suilend: SuilendMark,
};

// Over-saturated brand logos that glare on the LIGHT theme — toned down there only (dark
// theme looks great as-is). The filter lives in globals.css under `.theme-light
// .protocol-logo-soft`, so it's theme-scoped (inline styles can't be).
const PROTOCOL_SOFT = new Set<string>(["cetus", "cetus-aggregator", "suilend"]);

// Brand image asset per protocol (explicit extension — not all are .svg). Keyed by the
// registry protocol id so the protocol list / cards resolve every entry to a real logo
// (DeFiLlama-sourced .webp for those without a bespoke local mark). Unknown id → the
// inline-SVG mark or a monogram tile fallback in ProtocolLogo.
const PROTOCOL_IMG_SRC: Record<string, string> = {
  cetus: "/logos/cetus.svg",
  "cetus-aggregator": "/logos/cetus.svg", // Cetus's aggregator — same brand mark
  deepbook: "/logos/deepbook.svg",
  suilend: "/logos/suilend.svg",
  navi: "/logos/navi.png",
  aftermath: "/logos/aftermath.svg",
  "aftermath-perp": "/logos/aftermath.svg", // Aftermath's perps venue — same brand mark
  wormhole: "/logos/wormhole.svg",
  "7k": "/logos/7k.webp",
  turbos: "/logos/turbos.webp",
  scallop: "/logos/scallop.webp",
  momentum: "/logos/momentum.webp",
  flowx: "/logos/flowx.webp",
  haedal: "/logos/haedal.webp",
  bluefin: "/logos/bluefin.webp",
  volo: "/logos/volo.webp",
  nemo: "/logos/nemo.webp",
};

export function ProtocolLogo({ id, size = 34 }: { id: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const Mark = PROTOCOL_MARKS[id];

  // 1) Brand image asset (real logo or placeholder). onError → inline mark / monogram.
  const src = PROTOCOL_IMG_SRC[id] ?? `/logos/${id}.svg`;
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={id}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`shrink-0${PROTOCOL_SOFT.has(id) ? " protocol-logo-soft" : ""}`}
        // object-fit: contain so a non-square brand asset (e.g. a wide wordmark) letterboxes
        // inside the square slot instead of distorting.
        style={{ width: size, height: size, borderRadius: size * 0.28, display: "block", objectFit: "contain", boxShadow: "var(--shadow-sm)" }}
      />
    );
  }

  // 3) Inline-SVG mark fallback (when no token icon / image asset, or the image 404s).
  if (Mark) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        aria-hidden
        className="shrink-0"
        style={{ display: "block", boxShadow: "var(--shadow-sm)", borderRadius: size * 0.28 }}
      >
        <Mark />
      </svg>
    );
  }

  // 3) Neutral monogram tile (unknown protocol, no asset, no mark).
  return (
    <div
      aria-hidden
      className="shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.28, background: "var(--bg-sub)", color: "var(--fg-muted)", fontWeight: 800, fontSize: size * 0.42 }}
    >
      {id.slice(0, 1).toUpperCase()}
    </div>
  );
}
