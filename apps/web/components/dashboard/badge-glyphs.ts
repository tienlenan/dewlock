/**
 * Per-badge glyphs for the reward system — one distinct mark per badge, drawn as
 * an escalating progression within each category (e.g. Milestones: sprout → star
 * → flag → flame → bolt → crown). Each value is inner SVG markup on a 0–24 grid;
 * <BadgeMedal> injects it and supplies stroke color, width, and round joins, so
 * outline shapes need only `d`. Filled accents set fill="currentColor"
 * stroke="none". `currentColor` resolves to the medallion's tier ink.
 *
 * Keys are badge ids (mirrors packages/agent/src/memory/badges.ts). Keep in sync
 * with the catalog; unknown ids fall back to a generic medal.
 */

export const BADGE_GLYPH_PATHS: Record<string, string> = {
  // --- Milestones: sprout → star → flag → flame → bolt → crown ---
  newbie: `<path d="M12 21 V11"/><path d="M12 13 C7.5 13 5.5 10 5.5 6.5 C10 6.5 12 9.5 12 13 Z"/><path d="M12 12 C16.5 12 18.5 9 18.5 5.5 C14 5.5 12 8.5 12 12 Z"/>`,
  "getting-started": `<path d="M12 3.5 L14.5 9.3 L20.8 9.8 L16 14 L17.5 20.2 L12 16.7 L6.5 20.2 L8 14 L3.2 9.8 L9.5 9.3 Z" fill="currentColor" stroke="none"/>`,
  regular: `<path d="M7 3 V21"/><path d="M7 4 H18 L15 8 L18 12 H7 Z"/>`,
  degen: `<path d="M12 21 C8.2 21 6 18.3 6 15.2 C6 12 9 11 8.8 7.5 C11.5 9.2 11.8 11.5 11.8 11.5 C13 8.8 14.6 8 14.6 6 C18 8.8 18 12 18 15.2 C18 18.3 15.8 21 12 21 Z"/>`,
  "power-user": `<path d="M13 2.5 L5.5 13 H11 L10 21.5 L18.5 10.5 H12 Z" fill="currentColor" stroke="none"/>`,
  centurion: `<path d="M4.5 18.5 H19.5"/><path d="M4.5 18.5 L6.2 8.5 L10 13.5 L12 6 L14 13.5 L17.8 8.5 L19.5 18.5 Z"/>`,

  // --- Swap: arrows → refresh cycle → arrows-around-coin → gear ---
  "first-swap": `<path d="M4 9 H18 M15 6 L18 9 L15 12"/><path d="M20 15 H6 M9 12 L6 15 L9 18"/>`,
  swapper: `<path d="M18.5 8 A7 7 0 0 0 6 6.8"/><path d="M18.5 3.5 V8 H14"/><path d="M5.5 16 A7 7 0 0 0 18 17.2"/><path d="M5.5 20.5 V16 H10"/>`,
  "swap-savant": `<circle cx="12" cy="12" r="4.3"/><path d="M12 3.5 A8.5 8.5 0 0 1 19.6 8.2"/><path d="M19.8 4.2 V8.4 H15.6"/><path d="M12 20.5 A8.5 8.5 0 0 1 4.4 15.8"/><path d="M4.2 19.8 V15.6 H8.4"/>`,
  "swap-machine": `<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5 V5.5 M12 18.5 V21.5 M2.5 12 H5.5 M18.5 12 H21.5 M5.2 5.2 L7.3 7.3 M16.7 16.7 L18.8 18.8 M18.8 5.2 L16.7 7.3 M5.2 18.8 L7.3 16.7"/>`,

  // --- Send: plane → plane+trail → dispatch box → rocket ---
  "first-send": `<path d="M21 4 L3 11 L11 13 L13 21 Z"/><path d="M21 4 L11 13"/>`,
  "frequent-sender": `<path d="M21 4 L8 10 L13 13 L15 19 Z"/><path d="M21 4 L13 13"/><path d="M3 17 q3 -1.5 6 -0.8"/><path d="M3 20 q5 -2.5 9 -1.6"/>`,
  dispatcher: `<rect x="8" y="7" width="11" height="10" rx="1.5"/><path d="M8 9 L13.5 13 L19 9"/><path d="M2 9.5 H5"/><path d="M2 12 H5"/><path d="M2 14.5 H5"/>`,
  "courier-elite": `<path d="M12 3 C15 6 15.5 10 15.5 13 H8.5 C8.5 10 9 6 12 3 Z"/><circle cx="12" cy="9" r="1.6"/><path d="M8.5 13 L6.5 17 L9.5 15.5"/><path d="M15.5 13 L17.5 17 L14.5 15.5"/><path d="M10.5 18 L12 21 L13.5 18"/>`,

  // --- Lend: coin+yield → coin stack → growth → bank ---
  "first-lend": `<circle cx="12" cy="12" r="8"/><path d="M12 16 V8 M9 11 L12 8 L15 11"/>`,
  supplier: `<ellipse cx="12" cy="8" rx="7" ry="2.6"/><path d="M5 8 V12 a7 2.6 0 0 0 14 0 V8"/><path d="M5 12 V15.5 a7 2.6 0 0 0 14 0 V12"/>`,
  "yield-veteran": `<path d="M6 13 H18 L17 20.5 H7 Z"/><path d="M12 13 V7"/><path d="M12 9 C8 9 6.5 5.5 6.5 5.5 C11 5 12 8.5 12 9 Z"/><path d="M12 10 C16 10 17.5 6.5 17.5 6.5 C13 6 12 9.5 12 10 Z"/>`,
  "lending-whale": `<path d="M4 9 L12 4 L20 9"/><path d="M5.5 9 V18 M9.5 9 V18 M14.5 9 V18 M18.5 9 V18"/><path d="M3 20.5 H21"/>`,

  // --- Limit: hourglass → ladder → depth book → bullseye ---
  "first-limit": `<path d="M6 3 H18 M6 21 H18"/><path d="M7.5 3 C7.5 8 12 10 12 12 C12 14 7.5 16 7.5 21"/><path d="M16.5 3 C16.5 8 12 10 12 12 C12 14 16.5 16 16.5 21"/>`,
  maker: `<path d="M6 4 V20"/><path d="M6 8 H14"/><path d="M6 12 H17"/><path d="M6 16 H11"/><circle cx="17" cy="12" r="1.8" fill="currentColor" stroke="none"/>`,
  "orderbook-regular": `<path d="M12 4 V20"/><path d="M12 7 H5"/><path d="M12 10 H8"/><path d="M12 14 H19"/><path d="M12 17 H15"/>`,
  "limit-master": `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>`,

  // --- Bridge: arch → chain links → globe → node network ---
  "first-bridge": `<path d="M3 18 V12 a9 6 0 0 1 18 0 V18"/><path d="M2 18 H22"/><path d="M8.5 18 V14"/><path d="M15.5 18 V14"/>`,
  bridger: `<rect x="3.5" y="9" width="9.5" height="6" rx="3"/><rect x="11" y="9" width="9.5" height="6" rx="3"/>`,
  omnichain: `<circle cx="12" cy="12" r="9"/><path d="M3 12 H21"/><path d="M12 3 C8 6 8 18 12 21 C16 18 16 6 12 3"/>`,
  "bridge-veteran": `<circle cx="5" cy="6.5" r="2"/><circle cx="19" cy="8" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="12" cy="11" r="2"/><path d="M6.6 7.6 L10.4 10 M17.4 9 L13.6 10.4 M12 13 V17"/>`,

  // --- Volume: $ coin → dice → bars → trend → whale ---
  "first-dollar": `<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5 V17.5"/><path d="M14.6 9.4 C14.6 8.2 13.1 7.8 12 7.8 C10.4 7.8 9.4 8.7 9.4 9.9 C9.4 12.6 14.6 11.4 14.6 14.1 C14.6 15.3 13.1 16.2 12 16.2 C10.9 16.2 9.4 15.8 9.4 14.5"/>`,
  "high-roller": `<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none"/>`,
  "big-mover": `<path d="M4 20 H20"/><path d="M7 20 V14"/><path d="M12 20 V9"/><path d="M17 20 V5"/>`,
  "heavy-hitter": `<path d="M4 16 L9 11 L13 14 L20 6"/><path d="M15 6 H20 V11"/>`,
  "volume-whale": `<path d="M4 12 C4 8.5 8.5 7.5 12.5 9 C14.5 7 17.5 7.5 18.5 9.5 C21.5 10 21 14 18 14 C16.5 16.5 11.5 16.5 8.5 14.5 C6.5 16 4 14.5 4 12 Z"/><path d="M18.5 9.5 C18.8 7.5 19.8 6.5 20.5 6"/><circle cx="8.5" cy="11.5" r="0.9" fill="currentColor" stroke="none"/>`,

  // --- Portfolio: pouch → wallet → safe → treasure chest ---
  "portfolio-starter": `<path d="M7 8 C7 5 17 5 17 8 L19 12 C19 17 16 19 12 19 C8 19 5 17 5 12 Z"/><path d="M9 8 H15"/>`,
  "portfolio-builder": `<rect x="3.5" y="6.5" width="17" height="13" rx="2.5"/><path d="M14 11.5 H21 V15 H14 a1.75 1.75 0 0 1 0 -3.5 Z"/>`,
  "portfolio-whale": `<rect x="4" y="5" width="16" height="15" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5 V12 L14 13.5"/><path d="M7.5 20 V21.5 M16.5 20 V21.5"/>`,
  "portfolio-kraken": `<path d="M4 11 H20 V19 H4 Z"/><path d="M4 11 C4 7 20 7 20 11"/><path d="M4 14 H20"/><circle cx="12" cy="14.5" r="1" fill="currentColor" stroke="none"/>`,

  // --- Diversity: toolbox → 5-spoke wheel → compass → constellation ---
  "multi-tool": `<rect x="4" y="9" width="16" height="9" rx="1.5"/><path d="M9 9 V7 a1 1 0 0 1 1 -1 H14 a1 1 0 0 1 1 1 V9"/><path d="M4 13 H20"/>`,
  "all-rounder": `<circle cx="12" cy="12" r="8.5"/><path d="M12 12 L12 3.5 M12 12 L20 9 M12 12 L17 19.5 M12 12 L7 19.5 M12 12 L4 9"/>`,
  "protocol-explorer": `<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 L10.5 10.5 L8.5 15.5 L13.5 13.5 Z" fill="currentColor" stroke="none"/>`,
  "protocol-connoisseur": `<path d="M6 7 L12 11 L17 6 M12 11 L19 15 M12 11 L9 17"/><circle cx="6" cy="7" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="17" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="1.3" fill="currentColor" stroke="none"/>`,

  // --- Loyalty: sunrise → calendar → calendar+check → medal ---
  "rookie-day": `<path d="M3 17.5 H21"/><path d="M6.5 17.5 a5.5 5.5 0 0 1 11 0"/><path d="M12 5.5 V7.5 M5.5 9 L7 10.5 M18.5 9 L17 10.5"/>`,
  "week-one": `<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 9.5 H20"/><path d="M8.5 3 V6.5"/><path d="M15.5 3 V6.5"/>`,
  "month-one": `<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 9.5 H20"/><path d="M8.5 3 V6.5"/><path d="M15.5 3 V6.5"/><path d="M8.5 14.5 L11 17 L15.5 12.5"/>`,
  veteran: `<circle cx="12" cy="9" r="5"/><path d="M9.5 13.2 L8 21 L12 18.3 L16 21 L14.5 13.2"/><path d="M10 9 L11.5 10.5 L14 7.8"/>`,

  // --- Conviction: anchor → diamond ---
  conviction: `<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2 V20"/><path d="M7 12 H17"/><path d="M4.5 13.5 a7.5 7.5 0 0 0 15 0"/>`,
  "iron-conviction": `<path d="M5 9 H19 L12 21 Z"/><path d="M5 9 L8 4 H16 L19 9"/><path d="M8 4 L12 9 L16 4"/>`,

  // --- Security: shield+alert → eye → shield+check → padlock ---
  "close-call": `<path d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z"/><path d="M12 8 V13"/><circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none"/>`,
  "eagle-eye": `<path d="M3 12 C6 7 18 7 21 12 C18 17 6 17 3 12 Z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>`,
  "guardian-graduate": `<path d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z"/><path d="M8.5 12 L11 14.5 L15.5 9.5"/>`,
  "sealed-signer": `<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11"/><circle cx="12" cy="15" r="1.3" fill="currentColor" stroke="none"/><path d="M12 15 V17.5"/>`,

  // --- Level: 1 → 2 → 3 rank chevrons ---
  "level-5": `<path d="M5 15 L12 9 L19 15"/>`,
  "level-10": `<path d="M5 13 L12 7 L19 13"/><path d="M5 18 L12 12 L19 18"/>`,
  "level-25": `<path d="M5 11 L12 6 L19 11"/><path d="M5 15 L12 10 L19 15"/><path d="M5 19 L12 14 L19 19"/>`,
};

// Generic medal for any id missing from the catalog map.
const FALLBACK_GLYPH = `<circle cx="12" cy="9" r="5"/><path d="M9.5 13.2 L8 21 L12 18.3 L16 21 L14.5 13.2"/>`;

/** Inner SVG markup for a badge id (falls back to a generic medal). */
export function glyphMarkupFor(id: string): string {
  return BADGE_GLYPH_PATHS[id] ?? FALLBACK_GLYPH;
}
