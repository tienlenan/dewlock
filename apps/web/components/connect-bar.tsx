"use client";

/**
 * Dewlock ConnectBar — wallet address + live gas balance + disconnect.
 * Adapted from walrus-memory-world-cup components/connect-bar.tsx.
 * Stripped World Cup auth/session/i18n logic; kept address, gas, disconnect core.
 * Uses dApp Kit hooks; must be a client component inside <Providers>.
 */

import { useState } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useDisconnectWallet,
} from "@mysten/dapp-kit";
import { useSuiGasBalance } from "@/lib/use-sui-gas-balance";
import { cn, formatMistAsSui, shortAddress } from "@/lib/utils";

export function ConnectBar({ className }: { className?: string }) {
  const account = useCurrentAccount();
  const { mutateAsync: disconnectWallet } = useDisconnectWallet();
  const gas = useSuiGasBalance(account?.address);
  const [busy, setBusy] = useState(false);

  async function handleDisconnect() {
    setBusy(true);
    try {
      await disconnectWallet();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 border-b border-border bg-bg text-fg text-sm",
        className,
      )}
    >
      {/* Network badge */}
      <span className="split-mono text-fg-subtle">sui:{gas.network}</span>

      {!account ? (
        /* dApp Kit connect button — uses its own styling; wrapped here for layout */
        <ConnectButton connectText="Connect Wallet" />
      ) : (
        <div className="flex items-center gap-3 ml-auto">
          {/* Gas balance — monospace, red tint when empty */}
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              gas.loading
                ? "text-fg-subtle"
                : gas.hasGas
                  ? "text-fg-muted"
                  : "text-destructive",
            )}
            title={gas.error ?? undefined}
          >
            {gas.loading ? "…" : formatMistAsSui(gas.mist)}
          </span>

          {/* Wallet address — monospace short form */}
          <span
            className="font-mono text-xs text-fg-muted select-all"
            title={account.address}
          >
            {shortAddress(account.address)}
          </span>

          {/* Disconnect */}
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={busy}
            className={cn(
              "text-xs px-2 py-1 border border-border text-fg-muted",
              "hover:border-accent hover:text-accent",
              "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {busy ? "…" : "Disconnect"}
          </button>
        </div>
      )}
    </div>
  );
}
