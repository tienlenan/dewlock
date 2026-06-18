import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All workspace packages and heavy runtime deps are excluded from bundling.
  // Next.js server resolves them via Node's require() at runtime through
  // the pnpm workspace symlinks. This avoids Turbopack trying to bundle
  // Node.js-native or ESM-init-heavy packages (Cetus SDK, Sui SDK, bn.js).
  serverExternalPackages: [
    "@dewlock/agent",
    "@dewlock/sui",
    "@mysten/walrus",
    "@mysten-incubation/memwal",
    "@mysten/sui",
    "@mysten/suins",
    "@mastra/core",
    "@cetusprotocol/cetus-sui-clmm-sdk",
    "@cetusprotocol/aggregator-sdk",
    "@naviprotocol/lending",
    "aftermath-ts-sdk",
    "bn.js",
  ],

  // Monorepo root — so Vercel's file tracer reaches the workspace `node_modules`
  // and the @dewlock/* package dist outside apps/web.
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Force-include the heavy SDKs into the API serverless functions. These are
  // loaded via a dynamic `esmImport = new Function("s","return import(s)")`
  // indirection (to dodge tsc's CJS downleveling of ESM-only packages), which is
  // invisible to the tracer — without this they're dropped and the deployed
  // functions throw "Cannot find module" at runtime. Globs are relative to this
  // config's dir; the `@<scope>+<name>*` wildcard matches pnpm's versioned store
  // entries. NOTE: pnpm symlinks transitive deps into separate store entries, so
  // a route may still surface a missing module on first deploy — add its glob and
  // redeploy (see plan phase 02, step 1).
  outputFileTracingIncludes: {
    "/api/**/*": [
      "../../node_modules/.pnpm/@suilend+sdk*/**",
      "../../node_modules/.pnpm/aftermath-ts-sdk*/**",
      "../../node_modules/.pnpm/@naviprotocol+lending*/**",
      "../../node_modules/.pnpm/@cetusprotocol+*/**",
      "../../node_modules/.pnpm/@mysten+walrus*/**",
      "../../node_modules/.pnpm/@mysten-incubation+memwal*/**",
      "../../packages/sui/sdk-bundles/**",
    ],
  },
};

export default nextConfig;
