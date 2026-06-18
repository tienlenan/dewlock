"use client";

/**
 * Dewlock — useSuinsName hook.
 * Reverse-resolves a connected wallet address to its primary SuiNS name (e.g.
 * "alice.sui") via the dApp Kit client's native resolveNameServiceNames RPC.
 * Returns null when the wallet has no default name registered.
 *
 * Mirrors the use-sui-gas-balance.ts useEffect pattern for consistency.
 *
 * Display-only: any RPC error degrades silently to null so the caller falls back
 * to the short 0x address. This is NOT a security surface — the Guardian's own
 * server-side resolver (with fail-closed spoof guard) is the security path.
 *
 * resolveNameServiceNames is accessed via a cast: the @mysten/sui 2.18 SuiClient
 * type does not surface it directly (same approach as packages/sui suins-resolver).
 */

import { useEffect, useState } from "react";
import { useSuiClient, useSuiClientContext } from "@mysten/dapp-kit";

/** Minimal structural type for the native reverse-resolution RPC. */
type ReverseResolver = {
  resolveNameServiceNames(args: {
    address: string;
    cursor?: string | null;
    limit?: number | null;
  }): Promise<{ data: string[]; hasNextPage: boolean; nextCursor: string | null }>;
};

export interface SuinsNameState {
  /** Primary .sui name for the address, or null if none / not yet resolved. */
  name: string | null;
  loading: boolean;
}

export function useSuinsName(
  address: string | null | undefined,
): SuinsNameState {
  const client = useSuiClient();
  const { network } = useSuiClientContext();
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // SuiNS only resolves on mainnet — skip the RPC on other networks.
    if (!address || network !== "mainnet") {
      setName(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    (client as unknown as ReverseResolver)
      .resolveNameServiceNames({ address, limit: 1 })
      .then((res) => {
        if (!cancelled) setName(res.data[0] ?? null);
      })
      .catch(() => {
        // Display-only — fall back to the address on any RPC failure.
        if (!cancelled) setName(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, client, network]);

  return { name, loading };
}
