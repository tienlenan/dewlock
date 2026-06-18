/**
 * Pre-bundle @suilend/sdk/client into a single clean-ESM file.
 *
 * The published @suilend/sdk uses extensionless DIRECTORY imports that neither Node's
 * native ESM loader nor Next/Turbopack (when the consuming package is server-external)
 * can resolve — it loads as an empty module. esbuild resolves those imports at bundle
 * time, producing a clean ESM module that build-lend.ts loads via native import().
 *
 * `@mysten/*` is kept EXTERNAL so the bundle uses the repo's pinned @mysten/sui v2.18
 * (its v2 client/transaction APIs), not a duplicate copy.
 *
 * Run as part of `pnpm --filter @dewlock/sui build` (before tsc). Output is committed
 * so deploys don't need esbuild at runtime.
 */

import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outfile = join(here, "..", "sdk-bundles", "suilend-client.mjs");

await build({
  entryPoints: [require.resolve("@suilend/sdk/client")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile,
  external: ["@mysten/sui", "@mysten/sui/*", "@mysten/bcs", "@mysten/walrus"],
  // The bundled deps do dynamic `require(...)` of Node builtins (util, crypto, …) which
  // an ESM output can't do natively — inject a createRequire-backed `require` shim.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  legalComments: "none",
  logLevel: "error",
});

console.log(`[bundle-suilend] wrote ${outfile}`);
