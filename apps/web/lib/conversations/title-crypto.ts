"use client";

/**
 * Client-side encryption of conversation titles with a wallet-derived key.
 *
 * The conversation index lives in Redis with OPEN reads, so titles must be
 * ciphertext or an attacker who knows a wallet address could read its chat titles
 * (titles are derived from the first message). We derive an AES-256-GCM key from a
 * single wallet signature over a STABLE domain-constant message (no timestamp), so
 * the same wallet always reproduces the identical key and can decrypt its own old
 * titles. Ed25519 signatures are deterministic, so re-signing reproduces the key
 * even without the cache.
 *
 * The raw key is cached in memory for the session and in localStorage per wallet,
 * so only the FIRST ever session prompts for the signature; later loads decrypt the
 * list with no prompt. localStorage is the same trust level as the existing Seal
 * SessionKey cache (the user's own device); the durable conversation content still
 * lives only in the Seal-encrypted Walrus blob, never here.
 */

type SignPersonalMessage = (input: { message: Uint8Array }) => Promise<{ signature: string }>;

/** Stable per-wallet key-derivation message — MUST NOT include a timestamp. */
const KEY_MESSAGE = (wallet: string) => `dewlock-conversation-title-key:v1:${wallet.toLowerCase()}`;
const LS_KEY = (wallet: string) => `dewlock-title-key:${wallet.toLowerCase()}`;
const HKDF_SALT = new TextEncoder().encode("dewlock-title-key-salt:v1");
const IV_BYTES = 12;

const memCache = new Map<string, CryptoKey>();

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// Return type pinned to ArrayBuffer (not ArrayBufferLike) so the bytes satisfy
// WebCrypto's BufferSource overloads under TS's generic-typed-array lib.
function b64decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Derive the AES-GCM key from raw signature bytes via HKDF-SHA-256. */
async function deriveAesKey(sigBytes: Uint8Array<ArrayBuffer>, wallet: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey("raw", sigBytes, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: new TextEncoder().encode(wallet.toLowerCase()) },
    ikm,
    { name: "AES-GCM", length: 256 },
    true, // extractable → so the raw key can be persisted to localStorage (first session only)
    ["encrypt", "decrypt"],
  );
}

async function importRawAesKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

/** Cached key WITHOUT prompting — memory → localStorage. Null when not yet derived. */
export async function getCachedTitleKey(wallet: string): Promise<CryptoKey | null> {
  const w = wallet.toLowerCase();
  const mem = memCache.get(w);
  if (mem) return mem;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY(w));
    if (!raw) return null;
    const key = await importRawAesKey(b64decode(raw));
    memCache.set(w, key);
    return key;
  } catch {
    return null;
  }
}

/**
 * Return the title key for `wallet`, deriving it (one signature prompt) when no
 * cached key exists. Caches the derived key in memory + localStorage so subsequent
 * sessions never re-prompt.
 */
export async function ensureTitleKey(
  wallet: string,
  signPersonalMessage: SignPersonalMessage,
): Promise<CryptoKey> {
  const cached = await getCachedTitleKey(wallet);
  if (cached) return cached;

  const message = KEY_MESSAGE(wallet);
  const { signature } = await signPersonalMessage({ message: new TextEncoder().encode(message) });
  const key = await deriveAesKey(b64decode(signature), wallet);

  memCache.set(wallet.toLowerCase(), key);
  try {
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    window.localStorage.setItem(LS_KEY(wallet), b64encode(raw));
  } catch {
    /* storage unavailable (private mode / quota) — re-derive next session (same key) */
  }
  return key;
}

/** Encrypt a plaintext title → base64(iv ‖ ciphertext). Fresh random IV per call. */
export async function encryptTitle(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return b64encode(out);
}

/** Decrypt a base64(iv ‖ ciphertext) title. Throws on a wrong key / tampered input. */
export async function decryptTitle(enc: string, key: CryptoKey): Promise<string> {
  const buf = b64decode(enc);
  const iv = buf.slice(0, IV_BYTES);
  const ct = buf.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

/** Forget the cached key (e.g. on wallet switch / clear). */
export function clearTitleKey(wallet?: string): void {
  if (wallet) {
    memCache.delete(wallet.toLowerCase());
    try {
      window.localStorage.removeItem(LS_KEY(wallet));
    } catch {
      /* ignore */
    }
  } else {
    memCache.clear();
  }
}
