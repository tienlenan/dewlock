/**
 * Seed the per-wallet memwal namespace with the user's committed risk cap, so the
 * recall-backed memory chip ("I remember your $X cap, risk profile Y") persists
 * across sessions. The cap mirrors the SERVER-AUTHORITATIVE Guardian caps — honest,
 * not fabricated (see committed-cap.ts).
 *
 * Written once per wallet per process (guarded), via rememberBulk (queued ~seconds)
 * to avoid the ~30-43s rememberAndWait indexing block. Fail-soft: a memwal outage
 * is a no-op. The recall route also returns the env cap immediately so the chip
 * never waits on indexing — this write is purely for cross-session durability.
 */

import { memNamespace, rememberBulk, isMemoryEnabled } from "@dewlock/walrus";
import { envCommittedCap } from "./committed-cap";

const seeded = new Set<string>();

export async function seedCommittedCap(wallet: string | undefined): Promise<void> {
  if (!wallet || seeded.has(wallet) || !isMemoryEnabled()) return;
  const cap = envCommittedCap();
  if (!cap) return;
  seeded.add(wallet); // mark before awaiting so concurrent calls don't double-write
  try {
    await rememberBulk(memNamespace(wallet), [cap.entry]);
  } catch {
    seeded.delete(wallet); // drop the guard so a later call can retry
  }
}
