"use client";

/**
 * Dewlock — useSuiGasBalance hook.
 * Copied from walrus-memory-world-cup apps/web/src/lib/use-sui-gas-balance.ts.
 * Fetches the SUI gas balance for a wallet address via the dApp Kit client.
 * Returns loading/error state so the connect-bar can render a faucet link when empty.
 */

import { useEffect, useState } from "react";
import { useSuiClient, useSuiClientContext } from "@mysten/dapp-kit";

export interface GasBalanceState {
  network: string;
  mist: string | null;
  loading: boolean;
  error: string | null;
  hasGas: boolean;
}

export function useSuiGasBalance(
  address: string | null | undefined,
): GasBalanceState {
  const client = useSuiClient();
  const { network } = useSuiClientContext();
  const [mist, setMist] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!address) {
      setMist(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    client
      .getBalance({ owner: address })
      .then((balance) => {
        if (!cancelled) setMist(balance.totalBalance);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, client, network]);

  return {
    network,
    mist,
    loading,
    error,
    hasGas: mist != null && BigInt(mist) > 0n,
  };
}
