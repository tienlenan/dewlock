/**
 * Dewlock signing primitives — framework-agnostic, context-free.
 *
 * Key exports:
 *  - stableJson / sha256Hex / sha256HexBytes — deterministic content hashing.
 *  - WysiwysError — thrown when signed PTB bytes diverge from the approved digest.
 *
 * NOTE: the React signing hook (useSignAndExecuteTx) lives in the WEB APP
 * (apps/web/lib/use-sign-and-execute-tx.ts), NOT here. This package is in Next's
 * serverExternalPackages, so a dapp-kit React hook here would resolve a DIFFERENT
 * @mysten/dapp-kit context instance during SSR than the app's provider → the
 * SuiClientContext lookup fails. Keeping this module dapp-kit-free avoids that.
 *
 * Signing ALWAYS happens client-side in the user's wallet — the server only
 * builds unsigned PTBs. The Uint8Array passed to crypto.subtle.digest is
 * normalized to a plain ArrayBuffer (strict BufferSource, no SharedArrayBuffer).
 */

// --- Deterministic JSON (canonical key order at every nesting level) ---

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, normalize(v)]),
  );
}

/** Stable JSON with sorted keys — deterministic across serialisation runs. */
export function stableJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

/** SHA-256 hex digest of any JSON-serialisable value. Uses Web Crypto (browser + edge). */
export async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(
    typeof value === "string" ? value : stableJson(value),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute SHA-256 over raw bytes (Uint8Array).
 * Used for WYSIWYS: digest the exact PTB bytes, not their JSON representation.
 *
 * WHY .buffer.slice(): crypto.subtle.digest requires ArrayBuffer (not
 * SharedArrayBuffer). A Uint8Array whose .buffer is a SharedArrayBuffer
 * (possible in some environments) fails the strict BufferSource check.
 * Slicing produces a plain ArrayBuffer copy that is always accepted.
 */
export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  // Copy into a new Uint8Array backed by a plain ArrayBuffer.
  // This satisfies crypto.subtle.digest's strict BufferSource constraint:
  // the original buffer may be SharedArrayBuffer in some environments,
  // which is not assignable to ArrayBuffer. The copy is always a plain ArrayBuffer.
  const buf: ArrayBuffer = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- WYSIWYS error ---

/**
 * Thrown when the PTB bytes presented for signing do not match the
 * Guardian-approved digest. This is the final defense against PTB substitution
 * after Guardian approval — e.g. a race-condition or client-side tampering.
 */
export class WysiwysError extends Error {
  constructor(
    public readonly approvedDigest: string,
    public readonly actualDigest: string,
  ) {
    super(
      `WYSIWYS assertion failed: PTB bytes have changed since Guardian approval.\n` +
        `  Approved digest : ${approvedDigest}\n` +
        `  Actual digest   : ${actualDigest}\n` +
        `Transaction blocked. Please retry from the beginning.`,
    );
    this.name = "WysiwysError";
  }
}
