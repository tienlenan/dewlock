/**
 * /bridge — Wormhole cross-chain inflow into Sui.
 *
 * Two honest legs: the source lock/burn is wallet-driven (Wormhole Connect — the
 * user signs in their own wallet); Dewlock builds ONLY the Sui redeem, behind 9
 * fail-closed bridge gates (recipient==self, priced-asset allowlist, VAA verify,
 * server-fetched guardian-set index, fee model — not the trade cap).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { BridgeClient } from "@/components/bridge/bridge-client";

export const metadata: Metadata = {
  title: "Bridge · Dewlock",
  description:
    "Bring liquidity into Sui via Wormhole. The source leg is wallet-driven; Dewlock builds only the Sui redeem, guarded and to your own address.",
};

export default function BridgePage() {
  return (
    <div className="dark" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 20px 80px" }}>
        <Link href="/app" className="split-mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-muted)", textDecoration: "none" }}>
          ← back to copilot
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "16px 0 6px", color: "var(--fg)" }}>
          Bridge into Sui
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "0 0 28px", lineHeight: 1.55 }}>
          Pull liquidity from other chains into Sui via Wormhole. The source-chain transfer is your own
          wallet-driven decision; Dewlock builds only the Sui redeem — verified by the bridge Guardian and
          delivered <strong style={{ color: "var(--fg)" }}>only to your own address</strong>.
        </p>
        <BridgeClient />
      </div>
    </div>
  );
}
