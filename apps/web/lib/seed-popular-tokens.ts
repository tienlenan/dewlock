/**
 * Seed the per-wallet memwal namespace with a symbol→address mapping of popular,
 * ON-CHAIN-VERIFIED Sui tokens (see @dewlock/sui/popular-tokens). Gives the copilot
 * a fast, persistent token-resolution cache without a chain lookup per turn.
 *
 * Server-only (memwal write needs the operational delegate key). Fire-and-forget +
 * guarded so it writes at most once per wallet per process. Fail-soft: a memwal
 * outage is a no-op (resolution simply falls back to the in-prompt allowlist).
 *
 * SECURITY: this is a RESOLUTION cache only. Swappability stays gated by the Guardian
 * allowlist — seeding a token here never makes a non-allowlisted token swappable.
 */

import { popularTokenMemwalLines } from "@dewlock/sui/popular-tokens";
import { memNamespace, rememberBulk, isMemoryEnabled } from "@dewlock/walrus";

const seededWallets = new Set<string>();

export async function seedPopularTokens(wallet: string | undefined): Promise<void> {
  if (!wallet || seededWallets.has(wallet) || !isMemoryEnabled()) return;
  seededWallets.add(wallet); // mark before awaiting so concurrent calls don't double-write
  try {
    // ONE bulk write, not a per-token loop: seeding ~15 tokens as 15 separate writes
    // bursts straight past the relayer's per-minute rate limit (429). rememberBulk
    // collapses them into a single batched request and is fail-soft.
    const lines = popularTokenMemwalLines();
    if (lines.length) await rememberBulk(memNamespace(wallet), lines);
  } catch {
    // memwal unavailable — drop the guard so a later call can retry.
    seededWallets.delete(wallet);
  }
}
