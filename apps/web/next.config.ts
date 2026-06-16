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
    "bn.js",
  ],
};

export default nextConfig;
