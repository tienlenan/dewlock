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
};

export default nextConfig;
