/**
 * Contacts / address-book memory — persist verified name→0x mappings and detect drift.
 *
 * Architecture: pure functions only — no @dewlock/walrus import.
 * Callers (Next.js routes, ESM) pass in the walrus remember/recall functions.
 * This keeps the agent CJS bundle free of ESM-only dependencies.
 *
 * SECURITY: contactDriftCheck() flags when a resolved address differs from stored contact
 * (anti-lookalike complement: existing SuiNS gate catches name variants; this catches
 * on-chain name-to-address re-pointing attacks).
 *
 * Memory entry format:
 *   "contact: <name> = <0x-address>"
 */

// Regex to parse a stored contact entry.
const CONTACT_REGEX = /^contact:\s*(.+?)\s*=\s*(0x[0-9a-fA-F]{64})$/i;

export interface StoredContact {
  name: string;
  address: string; // 0x-prefixed 64-hex Sui address (lowercase)
}

export interface DriftCheckResult {
  /** True when stored and resolved addresses differ. */
  drifted: boolean;
  /** The address stored in memory (null when no record found). */
  storedAddress: string | null;
  /** The address that was just resolved from chain / user input. */
  resolvedAddress: string;
}

/** Injected walrus functions — callers provide these from @dewlock/walrus. */
export interface MemwalIO {
  remember: (namespace: string, text: string) => Promise<void>;
  recall: (namespace: string, query: string, topK?: number) => Promise<string[]>;
}

/**
 * Persist a verified name→address mapping to memwal.
 * No-op when name/address are empty.
 * Caller injects the walrus remember function.
 */
export async function rememberContact(
  io: MemwalIO,
  namespace: string,
  name: string,
  address: string,
): Promise<void> {
  if (!name.trim() || !address.trim()) return;
  const entry = `contact: ${name.trim().toLowerCase()} = ${address.trim().toLowerCase()}`;
  await io.remember(namespace, entry);
}

/**
 * Recall the stored 0x address for a given contact name.
 * Returns null when name not found or parse fails.
 * [needs live-env] requires reachable memwal relayer.
 */
export async function recallContact(
  io: MemwalIO,
  namespace: string,
  name: string,
): Promise<StoredContact | null> {
  try {
    const results = await io.recall(namespace, `contact: ${name.trim().toLowerCase()}`, 1);
    const text = results[0];
    if (!text) return null;
    return parseContactFromMemory(text);
  } catch {
    return null;
  }
}

/**
 * Pure parser — extracts a StoredContact from a memory entry string.
 * Exported for unit testing (no memwal required).
 */
export function parseContactFromMemory(text: string): StoredContact | null {
  const match = CONTACT_REGEX.exec(text.trim());
  if (!match) return null;
  return { name: match[1].toLowerCase(), address: match[2].toLowerCase() };
}

/**
 * Check whether a freshly resolved address differs from the stored contact record.
 *
 * Absence of memory (storedAddress === null) is not a block — just no prior data.
 * Drift = same name resolved to a different address → possible re-pointing attack.
 */
export function contactDriftCheck(
  storedAddress: string | null,
  resolvedAddress: string,
): DriftCheckResult {
  if (!storedAddress) {
    return { drifted: false, storedAddress: null, resolvedAddress };
  }
  const normalizedStored = storedAddress.toLowerCase().trim();
  const normalizedResolved = resolvedAddress.toLowerCase().trim();
  return {
    drifted: normalizedStored !== normalizedResolved,
    storedAddress: normalizedStored,
    resolvedAddress: normalizedResolved,
  };
}

/**
 * Format a human-readable drift warning for the Guardian block reason.
 */
export function formatDriftWarning(
  name: string,
  stored: string,
  resolved: string,
): string {
  return (
    `Recipient ${resolved} differs from stored contact '${name}' (saved as ${stored}). ` +
    "This could indicate a name-to-address re-pointing — please verify before signing."
  );
}
