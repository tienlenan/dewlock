"use client";

/**
 * TestWalletPanel — dev-only. Registers the burner wallet, auto-connects it (so the chat
 * unlocks without a real wallet extension), and shows a small floating panel with the burner
 * address + a faucet button (devnet/localnet). Double-gated by isTestWalletEnabled(); renders
 * nothing on the deployed app. See lib/dev/test-burner-wallet.ts.
 */

import { useEffect, useState } from "react";
import { useConnectWallet, useCurrentAccount, useWallets } from "@mysten/dapp-kit";
import { requestSuiFromFaucetV2 } from "@mysten/sui/faucet";
import { BURNER_WALLET_NAME, registerBurnerWallet } from "@/lib/dev/test-burner-wallet";
import { faucetHostFor, isTestWalletEnabled, testNetwork } from "@/lib/dev/test-burner-keypair";

export function TestWalletPanel() {
  const enabled = isTestWalletEnabled();
  const wallets = useWallets();
  const account = useCurrentAccount();
  const { mutate: connect } = useConnectWallet();
  const [mounted, setMounted] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (enabled) registerBurnerWallet();
  }, [enabled]);
  // Auto-connect to the burner once it is registered (avoids a manual connect-modal click).
  useEffect(() => {
    if (!enabled || account) return;
    const burner = wallets.find((w) => w.name === BURNER_WALLET_NAME);
    if (burner) connect({ wallet: burner });
  }, [enabled, wallets, account, connect]);

  if (!mounted || !enabled) return null;

  const net = testNetwork();
  const host = faucetHostFor(net);
  const short = account ? `${account.address.slice(0, 8)}…${account.address.slice(-4)}` : "connecting…";

  const fund = async () => {
    if (!account || !host) return;
    setFaucetMsg("Requesting…");
    try {
      await requestSuiFromFaucetV2({ host, recipient: account.address });
      setFaucetMsg("Funded ✓ (refresh balance)");
    } catch (e) {
      setFaucetMsg(`Faucet failed: ${e instanceof Error ? e.message : "error"}`);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 9999,
        maxWidth: 280,
        padding: "8px 11px",
        borderRadius: 8,
        background: "color-mix(in srgb, var(--warning, #d97706) 12%, #1a1a1a)",
        border: "1px solid color-mix(in srgb, var(--warning, #d97706) 45%, transparent)",
        color: "#f5f5f5",
        fontSize: 11,
        fontFamily: "ui-monospace, monospace",
        lineHeight: 1.5,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontWeight: 700, color: "var(--warning, #f59e0b)" }}>⚠ TEST WALLET · {net}</div>
      <button
        type="button"
        onClick={() => account && void navigator.clipboard?.writeText(account.address)}
        title="Copy address"
        style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: 11 }}
      >
        {short} ⧉
      </button>
      {host ? (
        <div style={{ marginTop: 4 }}>
          <button
            type="button"
            onClick={() => void fund()}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 5,
              cursor: "pointer",
              background: "var(--warning, #d97706)",
              color: "#1a1a1a",
              border: "none",
              fontWeight: 600,
            }}
          >
            Request faucet
          </button>
          {faucetMsg && <span style={{ marginLeft: 6 }}>{faucetMsg}</span>}
        </div>
      ) : (
        <div style={{ marginTop: 4, opacity: 0.75 }}>mainnet — no faucet (UI verify only)</div>
      )}
    </div>
  );
}
