"use client";

/**
 * TxAssuranceHeader — the security-narrative banner at the top of the preview.
 *
 * TRUTHFUL-SCOPED: it states what the Guardian actually bounds (the USD value that
 * can leave the wallet) and points to the contracts/objects below. It NEVER claims
 * completeness ("nothing else moves") — flow rows derive from coin balance changes
 * and cannot see non-coin object transfers. Any third-party transfer is surfaced
 * HERE (not buried in the collapsed permissions section).
 */

import React from "react";
import { formatUsd, thirdPartyTransfers, type ObjectTouchedDisplay } from "./tx-preview-format";

export function TxAssuranceHeader({
  estimatedUsdValue,
  objectsTouched = [],
}: {
  estimatedUsdValue: number;
  objectsTouched?: ObjectTouchedDisplay[];
}) {
  const thirdParty = thirdPartyTransfers(objectsTouched);
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)",
        background: "color-mix(in srgb, var(--success) 8%, transparent)",
        padding: "11px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--success)" }}>
        ✓ Guardian verified
      </div>
      <p style={{ fontSize: "11.5px", color: "var(--fg-muted)", margin: 0, lineHeight: 1.4 }}>
        ≤ {formatUsd(estimatedUsdValue)} can leave your wallet — review the contracts &amp; objects below.
      </p>
      {thirdParty.length > 0 && (
        <div
          style={{
            marginTop: 4,
            fontSize: "11.5px",
            fontWeight: 600,
            color: "var(--destructive)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ⚠ {thirdParty.length} transfer{thirdParty.length > 1 ? "s" : ""} to a third party — verify below
        </div>
      )}
    </div>
  );
}
