// Export transparent-background PNG logos for submissions / press kits.
// Run: node scripts/export-logo-png.mjs  (or: pnpm logo:png)
//
// The mark is pure vector (exact at any size). The wordmark renders in the
// system sans fallback (Plus Jakarta Sans is not installed for the rasterizer);
// for pixel-exact brand type, outline the text to paths instead.

import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "brand-export");
mkdirSync(out, { recursive: true });

const ACCENT = "#0c89e9", INK = "#0c131d", SHEEN = "#6ebef7";
const DROP = "M0 -36 C5 -30,35 -16,35 8 A35 35 0 1 1 -35 8 C-35 -16,-5 -30,0 -36 Z";

const markGroup = `
  <path d="${DROP}" fill="${ACCENT}"/>
  <circle cx="0" cy="6" r="8.7" fill="${INK}"/>
  <path d="M-4.3 6 L4.3 6 L2.8 30 L-2.8 30 Z" fill="${INK}"/>
  <circle cx="-13" cy="-5" r="5.3" fill="${SHEEN}"/>`;

// Square, centered mark on transparent bg.
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g transform="translate(48 44.5)">${markGroup}</g></svg>`;

// Horizontal lockup: mark + "dewlock" wordmark, 8px breathing room.
const FONT = `'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif`;
const lockup = (dew, lock) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 348 104"><g transform="translate(8 8)">
  <g transform="translate(38 44) scale(0.88)">${markGroup.replace(/fill="#0c131d"/g, `fill="${INK}"`)}</g>
  <text x="86" y="71" font-family="${FONT}" font-size="62" font-weight="500" letter-spacing="-1.8" fill="${dew}">dew<tspan fill="${lock}">lock</tspan></text>
</g></svg>`;

const lockupOnLight = lockup("#192029", "#0e66aa"); // dark text — for light backgrounds
const lockupOnDark = lockup("#f2f5f7", "#0c89e9"); // light text — for dark backgrounds

function png(svg, width) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica Neue" },
  })
    .render()
    .asPng();
}

const jobs = [
  ["dewlock-mark-256.png", markSvg, 256],
  ["dewlock-mark-512.png", markSvg, 512],
  ["dewlock-mark-1024.png", markSvg, 1024],
  ["dewlock-mark-2048.png", markSvg, 2048],
  ["dewlock-logo-on-light-1024.png", lockupOnLight, 1024],
  ["dewlock-logo-on-light-2048.png", lockupOnLight, 2048],
  ["dewlock-logo-on-dark-1024.png", lockupOnDark, 1024],
  ["dewlock-logo-on-dark-2048.png", lockupOnDark, 2048],
];

for (const [name, svg, width] of jobs) {
  writeFileSync(resolve(out, name), png(svg, width));
  console.log(`✓ ${String(width).padStart(4)}px  brand-export/${name}`);
}
