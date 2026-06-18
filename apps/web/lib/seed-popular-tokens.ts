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
import { memNamespace, remember, isMemoryEnabled } from "@dewlock/walrus";

const seededWallets = new Set<string>();

export async function seedPopularTokens(wallet: string | undefined): Promise<void> {
  if (!wallet || seededWallets.has(wallet) || !isMemoryEnabled()) return;
  seededWallets.add(wallet); // mark before awaiting so concurrent calls don't double-write
  try {
    const ns = memNamespace(wallet);
    for (const line of popularTokenMemwalLines()) {
      await remember(ns, line).catch(() => undefined);
    }
  } catch {
    // memwal unavailable — drop the guard so a later call can retry.
    seededWallets.delete(wallet);
  }
}
