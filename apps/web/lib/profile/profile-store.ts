/**
 * Durable wallet-profile persistence (server-only) — dual-write to Walrus blob
 * (immutable proof) + memwal pointer (recall), monotonic + lifetime.
 *
 * Receipts remain the derive-on-read source of truth; this layer makes earned
 * level/badges PERMANENT for the wallet (never un-earned, even if receipts age
 * out). Fail-soft: when memwal/Walrus is unavailable, reads return null and the
 * merge falls back to the derived-now profile (no crash, no fabrication).
 */

import { memNamespace, rememberBulk, recall, isMemoryEnabled, publishJsonBlob, readJsonBlob } from "@dewlock/walrus";
import {
  monotonicMerge,
  profileChanged,
  type WalletProfile,
  type DerivedProfile,
} from "@dewlock/agent/memory/wallet-profile";

const POINTER_PREFIX = "wallet-profile:";
const POINTER_RE = /^wallet-profile:\s*(\S+)\s*@\s*(\d+)/;

/** Read the latest durable profile for a wallet (null when none / unavailable). */
export async function readProfile(wallet: string): Promise<WalletProfile | null> {
  if (!isMemoryEnabled()) return null;
  try {
    // Pointers are append-only (one per persist), so request a generous set — the
    // newest must be inside it for "latest by timestamp" to read the current profile.
    const lines = await recall(memNamespace(wallet), POINTER_PREFIX, 50);
    let best: { blobId: string; at: number } | null = null;
    for (const line of lines) {
      const m = POINTER_RE.exec(line.trim());
      if (!m) continue;
      const at = Number(m[2]);
      if (!best || at > best.at) best = { blobId: m[1], at };
    }
    if (!best) return null;
    return await readJsonBlob<WalletProfile>(best.blobId);
  } catch {
    return null;
  }
}

async function persistProfile(wallet: string, profile: WalletProfile): Promise<void> {
  if (!isMemoryEnabled()) return;
  try {
    const ptr = await publishJsonBlob("dewlock-wallet-profile", profile);
    if (!ptr.blobId) return;
    // Queue the pointer (fast accept) instead of rememberAndWait (~30-43s indexing).
    await rememberBulk(memNamespace(wallet), [`${POINTER_PREFIX} ${ptr.blobId} @ ${Date.parse(profile.updatedAt)}`]);
  } catch {
    /* fail-soft — durable write is best-effort */
  }
}

/**
 * Merge a fresh derive with the durable profile (monotonic), persist when it
 * changed, and return the merged profile. Always returns a usable profile even
 * when persistence is unavailable (returns the derived-now merge).
 */
export async function mergeAndPersistProfile(
  derived: DerivedProfile,
  nowIso: string,
): Promise<WalletProfile> {
  const persisted = await readProfile(derived.walletAddress);
  const merged = monotonicMerge(persisted, derived, nowIso);
  if (profileChanged(persisted, merged)) await persistProfile(derived.walletAddress, merged);
  return merged;
}

/**
 * Reconcile an ALREADY-READ durable profile with a fresh derive (monotonic) and
 * return the union immediately; the durable WRITE is scheduled in the background.
 *
 * For hot-path callers (the dashboard) that read the profile in parallel with
 * their other data: rendering from this union keeps earned badges/level lit even
 * when a volatile source (e.g. BlockVision portfolio value) wouldn't re-award
 * them now — without ever blocking the response on the slow Walrus write.
 */
export function reconcileProfile(
  persisted: WalletProfile | null,
  derived: DerivedProfile,
  nowIso: string,
): WalletProfile {
  const merged = monotonicMerge(persisted, derived, nowIso);
  if (profileChanged(persisted, merged)) {
    void persistProfile(derived.walletAddress, merged).catch(() => {});
  }
  return merged;
}
