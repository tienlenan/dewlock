"use client";

/**
 * Lightweight in-page event bus for "a transaction just executed on-chain".
 *
 * WHY an event (not prop drilling / react-query): the signing flows (chat swap,
 * bridge redeem, limit order) live in different component subtrees than the
 * balance display (connect bar). A window CustomEvent decouples them — any sign
 * success emits, any balance/portfolio view listens and refetches. No shared
 * parent or query cache wiring needed.
 */

export const TX_CONFIRMED_EVENT = "dewlock:tx-confirmed";

/** Emit after a successful sign+execute so balance views refetch. No-op on the server. */
export function emitTxConfirmed(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TX_CONFIRMED_EVENT));
  }
}
