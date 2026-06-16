/**
 * /protocols — the Dewlock protocol registry surface.
 *
 * Public posture page: which Sui DeFi protocols Dewlock recognizes, which are
 * active (and built → their Move targets are enforced), and which are listed-but-
 * excluded (hacked / off-model) with their incident on record. Honesty by design —
 * excluded protocols are shown, not hidden, and contribute no allowlist targets.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ProtocolList } from "@/components/protocols/protocol-list";

export const metadata: Metadata = {
  title: "Protocol registry · Dewlock",
  description:
    "The Sui DeFi protocols Dewlock recognizes and their security posture — active, built, or listed-but-excluded (hacked / off-model).",
};

export default function ProtocolsPage() {
  return (
    <div className="dark" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "56px 20px 80px" }}>
        <Link
          href="/app"
          className="split-mono"
          style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-muted)", textDecoration: "none" }}
        >
          ← back to copilot
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "16px 0 6px", color: "var(--fg)" }}>
          Protocol registry
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "0 0 28px", lineHeight: 1.55 }}>
          The single source of truth for the protocols the Guardian permits. Only{" "}
          <strong style={{ color: "var(--fg)" }}>active + built</strong> protocols contribute Move targets to the
          enforced allowlist. Recently-hacked and off-model protocols stay listed for honesty — they are refused
          before any transaction is built.
        </p>
        <ProtocolList />
      </div>
    </div>
  );
}
