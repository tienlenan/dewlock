"use client";

/**
 * Dashboard data hook. The activity cards (level/stats/badges + receipts/daily-cap) all
 * derive from ONE action-log recall, so they share a single fetch — recalling the same
 * memwal data 3× (as separate per-card calls did) just congested the slow relayer and made
 * every card time out. The passport + friends cards self-fetch separately, so the dashboard
 * still renders progressively (each card has its own skeleton).
 *
 * Resilience mirrors the passport card (which loads reliably): a GENEROUS 60s budget — the
 * memwal relayer routinely takes 5-15s per recall and worse under concurrency, so a tighter
 * abort was killing the fetch before it returned. A timeout surfaces a retry, never an
 * infinite spinner; a confirmed tx re-polls (the action log indexes ~30s later).
 */

import { useEffect, useRef, useState } from "react";
import { TX_CONFIRMED_EVENT, DASHBOARD_RELOAD_EVENT } from "@/lib/tx-events";
import { readDashCache, writeDashCache } from "@/lib/dashboard/dashboard-cache";
import type { UserStatsApiResponse } from "@/components/dashboard/types";

interface PolledState<T> {
  data: T | null;
  error: string | null;
  retry: () => void;
}

/** Fetch `${path}?wallet=` with a generous budget, retryable timeout, and post-tx re-poll. */
function usePolledWalletData<T>(path: string, wallet: string | undefined): PolledState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const lastWallet = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!wallet) {
      setData(null);
      setError(null);
      lastWallet.current = undefined;
      return;
    }
    const cacheKey = `${path}:${wallet}`;
    let cancelled = false;
    let timedOut = false;
    const ctrl = new AbortController();
    // 60s: the memwal relayer is slow (5-15s per recall, worse under concurrent dashboard
    // loads) — a tight abort fired before the recall returned, leaving cards stuck while the
    // no-timeout passport card loaded fine. Generous budget + retry-on-timeout (never infinite).
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 60_000);
    // On a genuine wallet change, seed from the last-good cache INSTANTLY (no cold skeleton),
    // then revalidate below. A silent reloadKey refetch keeps the current data on screen.
    if (lastWallet.current !== wallet) {
      setData(readDashCache<T>(cacheKey));
      setError(null);
      lastWallet.current = wallet;
    }
    fetch(`${path}?wallet=${encodeURIComponent(wallet)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: T) => {
        if (cancelled) return;
        setData(d);
        writeDashCache(cacheKey, d); // refresh last-good cache
      })
      .catch((e) => {
        if (cancelled) return;
        if (timedOut) { setError("Taking longer than usual — tap retry."); return; }
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [path, wallet, reloadKey]);

  // After a confirmed tx the action-log indexes asynchronously (~30s); re-poll a few times.
  const retryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!wallet) return;
    function onTxConfirmed() {
      retryTimers.current.forEach(clearTimeout);
      retryTimers.current = [8_000, 20_000, 40_000, 70_000].map((d) =>
        setTimeout(() => setReloadKey((k) => k + 1), d),
      );
    }
    // User-triggered hard reload → refetch immediately.
    const onReload = () => setReloadKey((k) => k + 1);
    window.addEventListener(TX_CONFIRMED_EVENT, onTxConfirmed);
    window.addEventListener(DASHBOARD_RELOAD_EVENT, onReload);
    return () => {
      window.removeEventListener(TX_CONFIRMED_EVENT, onTxConfirmed);
      window.removeEventListener(DASHBOARD_RELOAD_EVENT, onReload);
      retryTimers.current.forEach(clearTimeout);
      retryTimers.current = [];
    };
  }, [wallet]);

  return { data, error, retry: () => setReloadKey((k) => k + 1) };
}

/** Activity data — level + stats + badges + receipts + daily-cap, from one action-log recall. */
export function useUserStats(wallet: string | undefined) {
  return usePolledWalletData<UserStatsApiResponse>("/api/user-stats", wallet);
}
