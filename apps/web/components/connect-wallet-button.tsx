"use client";

/**
 * ConnectWalletButton — themed replacement for dapp-kit's default <ConnectButton>.
 *
 * Wraps dapp-kit's <ConnectModal> (so the robust wallet-selection + connection flow is
 * unchanged) with a trigger styled in the app's design tokens (accent pill, aqua glow).
 * Connect-only: the connected state is rendered by the app's own wallet pill elsewhere.
 */

import { ConnectModal } from "@mysten/dapp-kit";
import { Wallet } from "lucide-react";

export function ConnectWalletButton({
  label = "Connect Wallet",
  size = "md",
}: {
  label?: string;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  return (
    <ConnectModal
      trigger={
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{
            height: sm ? 34 : 40,
            padding: sm ? "0 14px" : "0 18px",
            borderRadius: 10,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: sm ? 12.5 : 13.5,
            fontWeight: 600,
            lineHeight: 1,
            cursor: "pointer",
            boxShadow: "var(--shadow-aqua)",
            whiteSpace: "nowrap",
          }}
        >
          <Wallet size={sm ? 14 : 15} aria-hidden />
          {label}
        </button>
      }
    />
  );
}
