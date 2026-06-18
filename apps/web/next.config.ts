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
  // and the @dewlock/* package dist outside apps/web, and dereferences pnpm symlinks
  // when packaging the serverless functions.
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Force-include the prebundled ESM SDK files (Aftermath/NAVI/Suilend). They're loaded
  // by a dynamic esmImport the tracer can't follow, and they live in @dewlock/sui's
  // sdk-bundles/ outside apps/web. These are REAL self-contained .mjs files (no nested
  // pnpm symlinks), so unlike a `.pnpm/<pkg>/**` glob they package cleanly on Vercel.
  outputFileTracingIncludes: {
    "/api/**/*": ["../../packages/sui/sdk-bundles/**"],
  },
};

export default nextConfig;
