/**
 * /bridge — standalone route (kept separate from the single-UI shell so the dark
 * page background matches Mayan's own dark widget colors). The Mayan widget's
 * theme isn't externally configurable (colors live in Mayan's builder dashboard,
 * not the init config), so a dedicated dark page is the clean fit.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { BridgeClient } from "@/components/bridge/bridge-client";

export const metadata: Metadata = {
  title: "Bridge · Dewlock",
  description:
    "Bring liquidity into Sui via Mayan's cross-chain swap. Fully wallet-driven; an advanced path redeems a raw VAA behind the bridge Guardian, to your own address.",
};

export default function BridgePage() {
  return (
    <div className="dark" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 20px 80px" }}>
        <Link href="/app" className="split-mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-muted)", textDecoration: "none" }}>
          ← back to copilot
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "16px 0 6px", color: "var(--fg)" }}>
          Bridge into Sui
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "0 0 28px", lineHeight: 1.55 }}>
          Bring liquidity into Sui with Mayan&apos;s cross-chain swap (Wormhole-based) — fully wallet-driven;
          Dewlock never signs the source leg. For a raw VAA, the advanced path redeems it behind the bridge
          Guardian, delivered <strong style={{ color: "var(--fg)" }}>only to your own address</strong>.
        </p>
        <BridgeClient />
      </div>
    </div>
  );
}
