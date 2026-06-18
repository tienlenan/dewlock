"use client";

/**
 * Batch reverse-resolve Sui addresses → their primary SuiNS name (e.g. "alice.sui") for
 * list displays (the friend book). Single-address sibling of useSuinsName. Display-only,
 * fail-soft: any RPC error degrades to no-name (caller falls back to the short 0x).
 */

import { useEffect, useState } from "react";
import { useSuiClient, useSuiClientContext } from "@mysten/dapp-kit";

type ReverseResolver = {
  resolveNameServiceNames(args: {
    address: string;
    limit?: number | null;
  }): Promise<{ data: string[] }>;
};

/** address(lowercased) → primary .sui name (or absent when none / not yet resolved). */
export function useSuinsNames(addresses: string[]): Record<string, string> {
  const client = useSuiClient();
  const { network } = useSuiClientContext();
  const [map, setMap] = useState<Record<string, string>>({});
  // Stable dep: sorted, de-duped, lowercased address set.
  const key = [...new Set(addresses.map((a) => a.toLowerCase()))].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    if (network !== "mainnet" || !key) {
      setMap({});
      return;
    }
    const uniq = key.split(",");
    Promise.all(
      uniq.map(async (addr) => {
        try {
          const res = await (client as unknown as ReverseResolver).resolveNameServiceNames({ address: addr, limit: 1 });
          return [addr, res.data[0] ?? ""] as const;
        } catch {
          return [addr, ""] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setMap(Object.fromEntries(entries.filter(([, n]) => n)));
    });
    return () => {
      cancelled = true;
    };
  }, [key, client, network]);

  return map;
}
