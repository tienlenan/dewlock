/**
 * Pre-bundle the pure-ESM, dynamically-imported SDKs into single self-contained ESM files.
 *
 * WHY: build-*.ts load these via a dynamic `esmImport = new Function("s","return import(s)")`
 * indirection (to dodge tsc's CJS downleveling of ESM-only packages). On Vercel that
 * indirection is invisible to the file tracer AND the packages live behind pnpm symlinks
 * that the serverless packager strips — so `import("aftermath-ts-sdk")` fails at runtime
 * with "Cannot find package". esbuild inlines each SDK + its deps into one .mjs that the
 * loaders import by a STABLE @dewlock/sui package-export path (no node_modules resolution),
 * and the .mjs is force-included into the function via outputFileTracingIncludes.
 *
 * `@mysten/*` stays EXTERNAL so the bundle reuses the repo's pinned @mysten/sui v2.18
 * (its v2 client/transaction APIs), not a duplicate copy.
 *
 * Run as part of `pnpm --filter @dewlock/sui build` (before tsc). Output is committed so
 * deploys don't need esbuild at runtime.
 */

import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "sdk-bundles");

const SDKS = [
  { name: "suilend", entry: "@suilend/sdk/client", out: "suilend-client.mjs" },
  { name: "aftermath", entry: "aftermath-ts-sdk", out: "aftermath.mjs" },
  { name: "navi", entry: "@naviprotocol/lending", out: "navi.mjs" },
];

// Resolve a package entry to a file path. CJS require.resolve fails for ESM-only
// packages whose `exports` map has only an "import" condition (e.g. @naviprotocol/lending,
// type:module) — fall back to the package.json's module/main entry.
function resolveEntry(spec) {
  try {
    return require.resolve(spec);
  } catch {
    const pjPath = require.resolve(`${spec}/package.json`);
    const pj = JSON.parse(readFileSync(pjPath, "utf8"));
    const main = pj.module ?? pj.exports?.["."]?.import ?? pj.main ?? "index.js";
    return join(dirname(pjPath), main);
  }
}

for (const sdk of SDKS) {
  const outfile = join(outDir, sdk.out);
  await build({
    entryPoints: [resolveEntry(sdk.entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    outfile,
    // Keep @mysten/* external (shared, pinned v2.18). Everything else is inlined so the
    // bundle is self-contained and needs no node_modules resolution in the function.
    external: ["@mysten/sui", "@mysten/sui/*", "@mysten/bcs", "@mysten/walrus"],
    // Bundled deps do dynamic `require(...)` of Node builtins (util, crypto, …) which an
    // ESM output can't do natively — inject a createRequire-backed `require` shim.
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    },
    legalComments: "none",
    logLevel: "error",
  });
  console.log(`[bundle-sdks] wrote ${outfile}`);
}
