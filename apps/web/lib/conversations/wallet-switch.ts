/**
 * Wallet-switch detection for conversation state isolation.
 *
 * The conversation hook keeps in-memory state (the open thread, a decrypted-message
 * cache, refs) and cached crypto (SessionKey, localStorage title key). None of that is
 * automatically dropped when the connected wallet changes — so without an explicit
 * purge, logging out of wallet A and into wallet B would leave A's conversation loaded
 * for B. This predicate decides exactly when that purge must run.
 *
 * Pure (no React) so the subtle mount-vs-switch logic is unit-tested in isolation.
 */

/**
 * True only when the wallet changed from one identity to ANOTHER (or to disconnected) —
 * i.e. a genuine switch that must purge the previous wallet's local state.
 *
 * False on:
 *  - the initial mount / first connect (`prev` is undefined → there is nothing to purge),
 *  - a no-op re-render where the wallet is unchanged.
 *
 * True on:
 *  - switching to a different wallet (A → B),
 *  - logging out (A → undefined).
 */
export function isWalletSwitch(prev: string | undefined, next: string | undefined): boolean {
  return prev !== undefined && prev !== next;
}
