"use client";

/**
 * useCoinBalance — live native balance for a specific coin type of a wallet.
 *
 * Generalizes useSuiGasBalance to any coinType (for the swap form's "You pay"
 * balance + MAX/50% buttons). One-shot fetch that refetches on a confirmed tx so
 * the displayed balance doesn't go stale after a swap. Read-only.
 */

import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { TX_CONFIRMED_EVENT } from "@/lib/tx-events";

export interface CoinBalanceState {
  /** Total balance in native (smallest) units, or null when unknown/disconnected. */
  native: string | null;
  loading: boolean;
}

export function useCoinBalance(
  address: string | null | undefined,
  coinType: string | null | undefined,
): CoinBalanceState {
  const client = useSuiClient();
  const [native, setNative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    function onTxConfirmed() {
      setRefreshTick((t) => t + 1);
      const id = setTimeout(() => setRefreshTick((t) => t + 1), 2_500);
      return () => clearTimeout(id);
    }
    window.addEventListener(TX_CONFIRMED_EVENT, onTxConfirmed);
    return () => window.removeEventListener(TX_CONFIRMED_EVENT, onTxConfirmed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!address || !coinType) {
      setNative(null);
      return;
    }
    setLoading(true);
    client
      .getBalance({ owner: address, coinType })
      .then((b) => {
        if (!cancelled) setNative(b.totalBalance);
      })
      .catch(() => {
        if (!cancelled) setNative(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, coinType, client, refreshTick]);

  return { native, loading };
}
