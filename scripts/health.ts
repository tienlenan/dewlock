/**
 * Dewlock health check — validates MemWal relayer connectivity.
 * Run: pnpm health (from monorepo root) OR tsx scripts/health.ts
 *
 * Exits 0 when healthy, 1 when not configured or unhealthy.
 * Adapted from walrus-memory-world-cup packages/walrus/scripts/health.ts.
 */

import "dotenv/config";
import { isMemoryEnabled, memoryHealth } from "../packages/walrus/src/index.js";

console.log("Dewlock — MemWal health check");
console.log("MEMWAL configured:", isMemoryEnabled());

if (!isMemoryEnabled()) {
  console.log(
    "Not provisioned (MEMWAL_ACCOUNT_ID / MEMWAL_DELEGATE_KEY are empty).",
  );
  console.log("Run: pnpm provision");
  process.exit(1);
}

const healthy = await memoryHealth();
console.log("Relayer health:", healthy ? "OK" : "UNREACHABLE");
process.exit(healthy ? 0 : 1);
