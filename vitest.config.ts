/**
 * Vitest workspace config for the Dewlock monorepo.
 * Tests live in packages/{agent,sui}/src/__tests__/.
 *
 * Aliases resolve @dewlock/* workspace package specifiers to their source .ts
 * files so vitest can import them directly without a build step.
 *
 * @mysten/sui subpath exports are ESM-only (.mjs) in v2.18.0. pnpm hoists
 * the package into packages/sui/node_modules rather than the monorepo root,
 * so we use createRequire from packages/sui to resolve the actual file paths
 * and register them as explicit aliases. This avoids vitest's ESM subpath
 * export resolver failing to find the package from the root CWD.
 *
 * Design choice for test isolation: pure gate functions (checkProvenance,
 * checkSuiNSLookalike) live in guardian-gates.ts with zero SDK deps, so tests
 * can import those directly without pulling the Cetus/SuiNS SDK chain.
 * The heavier guardian.ts (Transaction.from, Cetus SDK) is exercised in the
 * new swap-builder + cap-injection tests which mock the Cetus module.
 */

import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

function src(pkg: string, file: string): string {
  return path.resolve(ROOT, "packages", pkg, "src", file);
}

/**
 * Resolve a @mysten/sui subpath from the packages/sui context where pnpm
 * hoisted the package. Falls back to empty string (no alias) if not found.
 * Tries monorepo root first (all hoisting scenarios), then packages/sui.
 */
function resolveMystenSui(subpath: string): string {
  // Try monorepo root first — covers root-hoisted and pnpm deduped installs.
  for (const pkgJson of [
    path.resolve(ROOT, "package.json"),
    path.resolve(ROOT, "packages/sui/package.json"),
  ]) {
    const req = createRequire(pkgJson);
    try {
      return req.resolve(subpath);
    } catch {
      // Try next location.
    }
  }
  return "";
}

// Resolve the actual on-disk paths for @mysten/sui subpath exports.
// All subpaths resolve to ESM .mjs files from the pnpm hoisted location.
const mystenSuiTransactions = resolveMystenSui("@mysten/sui/transactions");
const mystenSuiClient = resolveMystenSui("@mysten/sui/client");
const mystenSuiBcs = resolveMystenSui("@mysten/sui/bcs");
const mystenSuiJsonRpc = resolveMystenSui("@mysten/sui/jsonRpc");
const mystenSuiKeypairsEd25519 = resolveMystenSui("@mysten/sui/keypairs/ed25519");
// @mysten/sui root has no exports.main — resolve via the package dir index
const mystenSuiRoot = mystenSuiTransactions
  ? mystenSuiTransactions.replace(/dist\/transactions\/index\.mjs$/, "dist/index.mjs")
  : "";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "packages/*/src/__tests__/**/*.test.ts",
      "packages/*/src/__tests__/**/*.spec.ts",
      "apps/web/**/__tests__/**/*.test.ts",
      "apps/web/**/__tests__/**/*.spec.ts",
    ],
  },
  resolve: {
    alias: [
      // apps/web internal alias (@/ → apps/web/)
      { find: /^@\/(.*)$/, replacement: path.resolve(ROOT, "apps/web/$1") },

      // @dewlock/walrus sub-paths
      { find: /^@dewlock\/walrus$/, replacement: src("walrus", "index.ts") },
      { find: "@dewlock/walrus/receipt", replacement: src("walrus", "receipt.ts") },

      // @dewlock/agent sub-paths (pure modules come first for priority)
      { find: "@dewlock/agent/allowlist", replacement: src("agent", "allowlist.ts") },
      { find: "@dewlock/agent/guardian-gates", replacement: src("agent", "guardian-gates.ts") },
      { find: "@dewlock/agent/guardian-bridge", replacement: src("agent", "guardian-bridge.ts") },
      { find: "@dewlock/agent/guardian", replacement: src("agent", "guardian.ts") },
      { find: "@dewlock/agent/tools/prepare-trade", replacement: src("agent", "tools/prepare-trade.ts") },
      { find: "@dewlock/agent/tools/prepare-bridge-redeem", replacement: src("agent", "tools/prepare-bridge-redeem.ts") },
      { find: "@dewlock/agent/tools/get-portfolio", replacement: src("agent", "tools/get-portfolio.ts") },
      { find: "@dewlock/agent/memory/user-stats", replacement: src("agent", "memory/user-stats.ts") },
      { find: "@dewlock/agent/memory/badges", replacement: src("agent", "memory/badges.ts") },
      { find: "@dewlock/agent/memory/level", replacement: src("agent", "memory/level.ts") },
      { find: "@dewlock/agent/memory/wallet-profile", replacement: src("agent", "memory/wallet-profile.ts") },
      { find: /^@dewlock\/agent$/, replacement: src("agent", "index.ts") },

      // @dewlock/sui sub-paths
      { find: "@dewlock/sui/allowlist", replacement: src("sui", "allowlist.ts") },
      { find: "@dewlock/sui/protocol-registry", replacement: src("sui", "protocol-registry.ts") },
      { find: "@dewlock/sui/protocol-constants", replacement: src("sui", "protocol-constants.ts") },
      { find: "@dewlock/sui/dry-run", replacement: src("sui", "dry-run.ts") },
      { find: "@dewlock/sui/quotes-source", replacement: src("sui", "quotes-source.ts") },
      { find: "@dewlock/sui/aggregator-quotes", replacement: src("sui", "aggregator-quotes.ts") },
      { find: "@dewlock/sui/build-aggregator-swap", replacement: src("sui", "build-aggregator-swap.ts") },
      { find: "@dewlock/sui/build-lend", replacement: src("sui", "build-lend.ts") },
      { find: "@dewlock/sui/wormhole-vaa", replacement: src("sui", "wormhole/vaa.ts") },
      { find: "@dewlock/sui/build-redeem", replacement: src("sui", "wormhole/build-redeem.ts") },
      { find: "@dewlock/sui/client", replacement: src("sui", "client.ts") },
      { find: "@dewlock/sui/build-transfer", replacement: src("sui", "build-transfer.ts") },
      { find: "@dewlock/sui/build-swap", replacement: src("sui", "build-swap.ts") },
      { find: "@dewlock/sui/sign", replacement: src("sui", "sign.ts") },
      { find: "@dewlock/sui/suins-resolver", replacement: src("sui", "suins-resolver.ts") },
      { find: /^@dewlock\/sui$/, replacement: src("sui", "index.ts") },

      // @mysten/sui subpath exports → resolved ESM .mjs paths from packages/sui context.
      // pnpm hoists @mysten/sui into packages/sui/node_modules (not the monorepo root),
      // so we resolve from there and alias directly to the .mjs files.
      ...(mystenSuiTransactions ? [{ find: "@mysten/sui/transactions", replacement: mystenSuiTransactions }] : []),
      ...(mystenSuiClient ? [{ find: "@mysten/sui/client", replacement: mystenSuiClient }] : []),
      ...(mystenSuiBcs ? [{ find: "@mysten/sui/bcs", replacement: mystenSuiBcs }] : []),
      ...(mystenSuiJsonRpc ? [{ find: "@mysten/sui/jsonRpc", replacement: mystenSuiJsonRpc }] : []),
      ...(mystenSuiKeypairsEd25519 ? [{ find: "@mysten/sui/keypairs/ed25519", replacement: mystenSuiKeypairsEd25519 }] : []),
      ...(mystenSuiRoot ? [{ find: /^@mysten\/sui$/, replacement: mystenSuiRoot }] : []),
    ],
  },
});
