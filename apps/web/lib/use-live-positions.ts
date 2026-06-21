"use client";

/**
 * useLivePositions — keep the DeFi positions card LIVE, never a stale snapshot.
 *
 * Seeds from the tool-result snapshot for an instant first paint, then self-fetches
 * /api/defi-positions on mount and again on every confirmed tx (immediately + after a
 * short delay to clear post-tx RPC indexing lag). This is what stops a withdraw/cancel/
 * claim from leaving an already-spent balance the user could act on again (which would
 * abort at build with a raw MoveAbort). A failed refetch keeps the last-good data.
 */

import { useEffect, useState } from "react";
import { fetchJsonWithRetry } from "@/lib/fetch-with-retry";
import { TX_CONFIRMED_EVENT } from "@/lib/tx-events";
import type { DefiPositionsData } from "@/components/app/defi-positions-section";

export function useLivePositions(
  initial: DefiPositionsData,
  walletAddress: string | null | undefined,
): DefiPositionsData {
  const [data, setData] = useState<DefiPositionsData>(initial);
  const [tick, setTick] = useState(0);

  // Refetch on every confirmed tx — immediately and again after a beat, since the
  // just-settled balance can read stale on the first read after the tx lands.
  useEffect(() => {
    function onTxConfirmed() {
      setTick((t) => t + 1);
      const id = setTimeout(() => setTick((t) => t + 1), 2_500);
      return () => clearTimeout(id);
    }
    window.addEventListener(TX_CONFIRMED_EVENT, onTxConfirmed);
    return () => window.removeEventListener(TX_CONFIRMED_EVENT, onTxConfirmed);
  }, []);

  // Self-fetch on mount (reload on re-render) and on each tick.
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    fetchJsonWithRetry<DefiPositionsData | { error: string }>(
      `/api/defi-positions?wallet=${walletAddress}`,
      { attempts: 2, timeoutMs: 9000 },
    )
      .then((fresh) => {
        // Only adopt a well-formed payload; keep last-good data on an error envelope.
        if (!cancelled && fresh && "deepbook" in fresh) setData(fresh as DefiPositionsData);
      })
      .catch(() => {
        /* refetch failed — keep the last-good snapshot */
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress, tick]);

  return data;
}
