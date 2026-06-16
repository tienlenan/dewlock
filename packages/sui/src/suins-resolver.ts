/**
 * SuiNS forward + reverse resolver with spoof-guard.
 *
 * WHY native RPC client instead of SuinsClient for resolve:
 * The Sui JSON-RPC client exposes both directions natively:
 *   - Forward: resolveNameServiceAddress({ name }) → 0x address | null
 *   - Reverse: resolveNameServiceNames({ address }) → { data: string[] }
 * @mysten/suins SuinsClient has no reverse API (v1.2.0 exposes only getNameRecord
 * for forward lookup + registration helpers). We use the RPC methods directly so
 * both directions work without maintaining two different resolution paths.
 *
 * WHY fail-closed: any resolve error or null result → throw SuiNSResolveError.
 * The Guardian treats throw as BLOCK — we never proceed with an unresolved name.
 * A reverse-lookup RPC failure also throws (fail-closed) because a successful
 * forward resolve with no reverse is suspicious (spoof vector).
 *
 * Reverse-lookup contract: resolveNameServiceNames returns the wallet's PRIMARY
 * registered .sui name(s). If the primary name differs from the typed name →
 * reverseMismatch=true → UI surfaces a spoof warning before the user confirms.
 * The Guardian does not hard-block on mismatch (warn-and-confirm per spec),
 * but callers may choose to escalate to a hard block.
 *
 * Lookalike guard: homoglyph-normalized edit-distance ≤ LOOKALIKE_EDIT_DISTANCE_THRESHOLD
 * against the provided verified contacts list.
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SuinsClient } from "@mysten/suins";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { normalizeHomoglyphs, editDistance, LOOKALIKE_EDIT_DISTANCE_THRESHOLD } from "./allowlist";

// Server-side SuiClient type — SuiJsonRpcClient satisfies ClientWithCoreApi.
type SuiClient = SuiJsonRpcClient;

/** Result of a forward SuiNS resolution. */
export interface SuiNSResolutionResult {
  /** Canonical 0x address the name resolves to. */
  resolvedAddress: string;
  /** The input name that was resolved (stripped of trailing .sui). */
  inputLabel: string;
  /**
   * Reverse-lookup primary name for the resolved address (may differ from typed name).
   * null if the address has no default SuiNS name registered.
   */
  reverseLabel: string | null;
  /**
   * True when reverse-lookup primary name ≠ typed name — signals a potential spoof.
   * The UI MUST surface this warning before the user can confirm.
   * Severity: warn-and-confirm (not a hard block by default).
   */
  reverseMismatch: boolean;
  /**
   * True when the typed name is a lookalike (homoglyph-normalized edit-distance ≤ threshold)
   * of any name in the provided verified contacts list.
   */
  lookalikeSuspect: boolean;
  /** The contact name that triggered the lookalike alert (if any). */
  lookalikeSimilarTo: string | null;
}

export class SuiNSResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuiNSResolveError";
  }
}

/**
 * Resolve a .sui name to a 0x address with reverse-lookup spoof guard.
 *
 * Forward resolve: SuinsClient.getNameRecord(name).targetAddress
 *   — uses the SuiNS SDK's getNameRecord which queries the SuiNS on-chain registry.
 *
 * Reverse resolve: suiClient.resolveNameServiceNames({ address, limit: 1 })
 *   — native RPC method returning the wallet's registered primary name(s).
 *   This is NOT available on SuinsClient v1.2.0; we use the base RPC client.
 *
 * @param suiClient       - Server-side SuiJsonRpcClient (mainnet).
 * @param name            - The .sui name to resolve (e.g. "alice.sui" or "alice").
 * @param verifiedContacts - Optional known-safe labels to check for lookalikes.
 */
export async function resolveSuiNSName(
  suiClient: SuiClient,
  name: string,
  verifiedContacts: string[] = [],
): Promise<SuiNSResolutionResult> {
  // Normalise: strip trailing .sui, lowercase, trim
  const label = name.toLowerCase().replace(/\.sui$/, "").trim();
  if (!label) {
    throw new SuiNSResolveError("Empty SuiNS name — cannot resolve.");
  }

  // ---------------------------------------------------------------------------
  // Forward resolve via SuinsClient.getNameRecord()
  // SuinsClient.getNameRecord(name) → NameRecord | null
  // NameRecord.targetAddress is the resolved 0x address.
  // SuiJsonRpcClient satisfies ClientWithCoreApi (has .core: CoreClient).
  // ---------------------------------------------------------------------------
  const suinsClient = new SuinsClient({
    client: suiClient as unknown as ClientWithCoreApi,
    network: "mainnet",
  });

  let resolvedAddress: string;
  try {
    const record = await suinsClient.getNameRecord(`${label}.sui`);
    if (!record?.targetAddress) {
      throw new SuiNSResolveError(
        `SuiNS name "${label}.sui" did not resolve to any address — blocking transfer.`,
      );
    }
    resolvedAddress = record.targetAddress;
  } catch (err) {
    if (err instanceof SuiNSResolveError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new SuiNSResolveError(
      `SuiNS forward resolve failed for "${label}.sui": ${msg}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Reverse resolve via native RPC: resolveNameServiceNames({ address, limit: 1 })
  // Returns { data: string[], hasNextPage, nextCursor }
  // data[0] is the wallet's primary registered .sui name (if any).
  //
  // Fail-closed: RPC failure → throw (not silently null).
  // A forward-only success with reverse failure is suspicious (spoof vector):
  // the name resolves on-chain but the target address claims a different name.
  // ---------------------------------------------------------------------------
  let reverseLabel: string | null = null;
  try {
    const reverseResult = await (suiClient as unknown as {
      resolveNameServiceNames(args: {
        address: string;
        cursor?: string | null;
        limit?: number | null;
      }): Promise<{ data: string[]; hasNextPage: boolean; nextCursor: string | null }>;
    }).resolveNameServiceNames({ address: resolvedAddress, limit: 1 });

    if (reverseResult.data.length > 0) {
      // Strip trailing .sui for comparison (primary name may include it)
      reverseLabel = reverseResult.data[0].toLowerCase().replace(/\.sui$/, "");
    }
  } catch (err) {
    // Reverse lookup RPC failure → fail-closed: block rather than silently proceeding.
    // Rationale: a functional forward resolve with a broken reverse is suspicious.
    const msg = err instanceof Error ? err.message : String(err);
    throw new SuiNSResolveError(
      `SuiNS reverse lookup failed for "${resolvedAddress}": ${msg}. ` +
        "Cannot verify name ownership — blocking for safety.",
    );
  }

  // Spoof guard: if reverse primary name exists and differs from the typed name → warn
  const reverseMismatch =
    reverseLabel !== null && reverseLabel !== label;

  // ---------------------------------------------------------------------------
  // Lookalike guard: compare normalised typed label against verified contacts
  // ---------------------------------------------------------------------------
  let lookalikeSuspect = false;
  let lookalikeSimilarTo: string | null = null;

  const normalizedTyped = normalizeHomoglyphs(label);
  for (const contact of verifiedContacts) {
    const normalizedContact = normalizeHomoglyphs(
      contact.toLowerCase().replace(/\.sui$/, ""),
    );
    // Skip exact match — same name is not a lookalike
    if (normalizedTyped === normalizedContact) continue;
    const dist = editDistance(normalizedTyped, normalizedContact);
    if (dist > 0 && dist <= LOOKALIKE_EDIT_DISTANCE_THRESHOLD) {
      lookalikeSuspect = true;
      lookalikeSimilarTo = contact;
      break;
    }
  }

  return {
    resolvedAddress,
    inputLabel: label,
    reverseLabel,
    reverseMismatch,
    lookalikeSuspect,
    lookalikeSimilarTo,
  };
}
