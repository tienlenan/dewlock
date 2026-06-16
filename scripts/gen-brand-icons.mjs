// Rasterize the Dewlock dewdrop mark into PNG app icons.
// Run: node scripts/gen-brand-icons.mjs  (or: pnpm gen:icons)
//
// Source of truth for the mark geometry is the same canonical dewdrop path used
// by the React component and the static SVGs. Keep colors in sync with the
// light-theme brand tokens in apps/web/app/globals.css.

import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "apps/web");

const ACCENT = "#0c89e9"; // --accent
const INK = "#0c131d"; // --bg-dark (water-ink)
const SHEEN = "#6ebef7"; // --accent-2
const DROP =
  "M0 -36 C5 -30,35 -16,35 8 A35 35 0 1 1 -35 8 C-35 -16,-5 -30,0 -36 Z";

// Square master. `scale` keeps the drop inside the maskable safe zone (~58%).
function master({ bg }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ""}
    <g transform="translate(50 50) scale(0.62)">
      <path d="${DROP}" fill="${ACCENT}"/>
      <circle cx="0" cy="6" r="8.7" fill="${INK}"/>
      <path d="M-4.3 6 L4.3 6 L2.8 30 L-2.8 30 Z" fill="${INK}"/>
      <circle cx="-13" cy="-5" r="5.3" fill="${SHEEN}"/>
    </g>
  </svg>`;
}

function png(svg, size) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();
}

const solid = master({ bg: INK });
const clear = master({ bg: null });

const targets = [
  // iOS adds its own rounded mask + dark backdrop → ship a solid full-bleed tile.
  { path: resolve(web, "app/apple-icon.png"), svg: solid, size: 180 },
  { path: resolve(web, "public/brand/icon-192.png"), svg: solid, size: 192 },
  { path: resolve(web, "public/brand/icon-512.png"), svg: solid, size: 512 },
  // Legacy raster favicon fallback (modern browsers use app/icon.svg).
  { path: resolve(web, "public/brand/favicon-32.png"), svg: clear, size: 32 },
];

for (const { path, svg, size } of targets) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png(svg, size));
  console.log(`✓ ${size.toString().padStart(3)}px  ${path.replace(root + "/", "")}`);
}
