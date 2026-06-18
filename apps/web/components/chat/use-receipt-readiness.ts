"use client";

/**
 * useReceiptReadiness — fires a POST to /api/receipt after sign,
 * then polls GET /api/receipt?txDigest=… with bounded exponential backoff.
 *
 * Design constraints:
 *  - NEVER blocks the sign UX — starts async, resolves via callback.
 *  - Backoff delays: [1s, 2s, 4s, 8s, 15s] → stops after ~30s total.
 *  - AbortController: cancelled on component unmount (no setState after unmount).
 *  - Returns "blob_only" status if anchor never lands within the window.
 */

import { useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReceiptStatus =
  | "pending"
  | "blob_ready"
  | "anchored"
  | "blob_only"
  | "not_found"
  | "timeout";

export interface ReceiptReadiness {
  status: ReceiptStatus;
  blobId: string | null;
  anchorObjectId: string | null;
  anchorTxDigest: string | null;
  /** Sui object to surface (HEAD anchor if configured, else the Walrus Blob object). */
  suiObjectId: string | null;
  contentHashHex: string | null;
  error?: string;
}

export interface SubmitReceiptInput {
  txDigest: string | null;
  approvedDigest: string | null;
  action: string;
  args: Record<string, unknown>;
  dryRunEffects?: unknown;
  verdict: "approved" | "blocked";
  blockReasons?: string[];
  blockGates?: string[];
  walletAddress: string;
}

// ---------------------------------------------------------------------------
// Backoff schedule (milliseconds) — ~55s total, under the route's maxDuration=60.
// Walrus mainnet blob publish + the on-chain anchor often need >30s; a too-short
// budget surfaces "timeout" while the receipt is still legitimately landing.
// ---------------------------------------------------------------------------

const BACKOFF_DELAYS = [1_000, 2_000, 3_000, 5_000, 8_000, 12_000, 12_000, 12_000];

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already aborted (e.g. unmount) — reject now instead of waiting out a delay.
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

// ---------------------------------------------------------------------------
// Internal poll loop
// ---------------------------------------------------------------------------

async function pollReceipt(
  key: string,
  signal: AbortSignal,
  onUpdate: (r: ReceiptReadiness) => void,
): Promise<void> {
  for (let attempt = 0; attempt < BACKOFF_DELAYS.length; attempt++) {
    await sleep(BACKOFF_DELAYS[attempt]!, signal);

    try {
      const res = await fetch(`/api/receipt?txDigest=${encodeURIComponent(key)}`, {
        signal,
      });

      if (!res.ok) continue;

      const data = (await res.json()) as ReceiptReadiness & { status: string };

      if (
        data.status === "anchored" ||
        data.status === "blob_only" ||
        data.status === "blob_ready"
      ) {
        onUpdate({
          status: data.status as ReceiptStatus,
          blobId: data.blobId ?? null,
          anchorObjectId: data.anchorObjectId ?? null,
          anchorTxDigest: data.anchorTxDigest ?? null,
          suiObjectId: data.suiObjectId ?? null,
          contentHashHex: data.contentHashHex ?? null,
          error: data.error,
        });
        return; // Terminal state reached — stop polling.
      }

      // status === "pending" → continue polling
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Network error on a poll attempt — continue to next delay.
    }
  }

  // Poll budget exhausted — surface as "timeout" so the card shows a clear
  // "receipt write timed out" notice rather than silently appearing incomplete.
  onUpdate({
    status: "timeout",
    blobId: null,
    anchorObjectId: null,
    anchorTxDigest: null,
    suiObjectId: null,
    contentHashHex: null,
    error: "receipt poll timed out",
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns a `submitReceipt` function to call after sign.
 * On each readiness update, `onUpdate` is called with the latest state.
 * Cancels all pending polls on unmount via the returned cleanup.
 */
export function useReceiptReadiness(
  onUpdate: (readiness: ReceiptReadiness) => void,
) {
  const abortRef = useRef<AbortController | null>(null);

  const submitReceipt = useCallback(
    async (input: SubmitReceiptInput): Promise<string | null> => {
      // Cancel any previous poll (e.g. user signs a second tx quickly).
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // POST to initiate the async receipt pipeline (fire-and-forget from server side).
        const res = await fetch("/api/receipt", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        if (!res.ok) {
          // Route unreachable or validation error — surface as blob_only.
          onUpdate({
            status: "blob_only",
            blobId: null,
            anchorObjectId: null,
            anchorTxDigest: null,
            suiObjectId: null,
            contentHashHex: null,
            error: `receipt route ${res.status}`,
          });
          return null;
        }

        const data = (await res.json()) as { key?: string; status?: string };
        const key = data.key ?? input.txDigest;

        if (!key) return null;

        // If the server returned a terminal state immediately (cache hit), surface it.
        if (
          data.status === "anchored" ||
          data.status === "blob_only" ||
          data.status === "blob_ready"
        ) {
          onUpdate({
            status: data.status as ReceiptStatus,
            blobId: (data as Record<string, string | null>).blobId ?? null,
            anchorObjectId: (data as Record<string, string | null>).anchorObjectId ?? null,
            anchorTxDigest: (data as Record<string, string | null>).anchorTxDigest ?? null,
            suiObjectId: (data as Record<string, string | null>).suiObjectId ?? null,
            contentHashHex: (data as Record<string, string | null>).contentHashHex ?? null,
          });
          return key;
        }

        // Start the backoff poll loop (non-blocking).
        void pollReceipt(key, controller.signal, onUpdate);
        return key;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return null;
        onUpdate({
          status: "blob_only",
          blobId: null,
          anchorObjectId: null,
          anchorTxDigest: null,
          suiObjectId: null,
          contentHashHex: null,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    },
    [onUpdate],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { submitReceipt, cancel };
}
