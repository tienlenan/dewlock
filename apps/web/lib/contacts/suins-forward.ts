"use client";

/**
 * Client-side SuiNS forward resolution (name → 0x) for the add-friend form, so a user can
 * type a domain (alice.sui or bare "alice") and we store the resolved address. Uses the
 * dApp Kit client's native resolveNameServiceAddress RPC. Display/input convenience only —
 * the Guardian's own server-side resolver (fail-closed) is the security path at send time.
 */

/** Minimal structural type for the native forward-resolution RPC (not surfaced by the 2.18 types). */
type ForwardResolver = {
  resolveNameServiceAddress(args: { name: string }): Promise<string | null>;
};

/** Minimal structural type for the reverse-resolution RPC (address → owned .sui names). */
type ReverseResolver = {
  resolveNameServiceNames(args: { address: string }): Promise<{ data?: string[] } | null>;
};

const SUINS_NAME_RE = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*(\.sui)?$/i;

/** True when the input looks like a SuiNS name (not a 0x address). */
export function looksLikeSuinsName(input: string): boolean {
  const t = input.trim();
  if (/^0x[0-9a-fA-F]+$/.test(t)) return false;
  return SUINS_NAME_RE.test(t);
}

/** Normalize a SuiNS input: lowercase, append ".sui" when no TLD is present. */
export function normalizeSuinsName(input: string): string {
  const t = input.trim().toLowerCase();
  return t.includes(".") ? t : `${t}.sui`;
}

/** Forward-resolve a .sui/bare name to a 0x address; null on miss or RPC error. */
export async function resolveSuinsAddress(client: unknown, input: string): Promise<string | null> {
  try {
    const addr = await (client as ForwardResolver).resolveNameServiceAddress({
      name: normalizeSuinsName(input),
    });
    return addr ?? null;
  } catch {
    return null;
  }
}

/**
 * Reverse-resolve a 0x address to its primary .sui name for DISPLAY only; null on miss,
 * RPC error, or when the RPC method is unavailable on the installed client version.
 * Display convenience — the security path never relies on a reverse name.
 */
export async function reverseResolveSuins(client: unknown, address: string): Promise<string | null> {
  try {
    const resolver = (client as ReverseResolver).resolveNameServiceNames;
    if (typeof resolver !== "function") return null;
    const res = await resolver.call(client, { address });
    return res?.data?.[0] ?? null;
  } catch {
    return null;
  }
}
