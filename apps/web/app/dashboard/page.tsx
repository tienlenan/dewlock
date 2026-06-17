/**
 * /dashboard — the Dewlock user dashboard surface.
 *
 * Per-wallet view: your Dewlock activity (tx count, volume, action breakdown
 * derived from the immutable receipt log), the reward badges you've earned, and
 * your on-chain footprint (portfolio + activity via BlockVision). The
 * protocol-wide section (TVL · active users · supported protocols) is filled by
 * the protocol metrics dashboard.
 *
 * Read-only surface — no keys, no signing.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard · Dewlock",
  description:
    "Your Dewlock activity, reward badges, and on-chain footprint — derived from immutable receipts and indexed on-chain data.",
};

export default function DashboardPage() {
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
          Dashboard
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "0 0 28px", lineHeight: 1.55 }}>
          Your activity and rewards. Badges are earned from{" "}
          <strong style={{ color: "var(--fg)" }}>immutable receipts</strong> — what you actually did through
          Dewlock — so they can’t drift from reality.
        </p>
        <DashboardClient />
      </div>
    </div>
  );
}
