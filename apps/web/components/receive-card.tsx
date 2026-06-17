"use client";

/**
 * ReceiveCard — read-only "receive funds" view: the user's own public address +
 * a QR, so anyone (a CEX withdrawal, another wallet) can send TO them.
 *
 * No key material, no signing — receiving needs only the public address. The QR
 * encodes that public address (meant to be shared), rendered via a public QR
 * image service; if it fails to load, the copyable address remains the source of
 * truth.
 */

import { CopyAddressButton } from "@/components/copy-address-button";

export interface ReceiveCardData {
  address: string;
  qrData: string;
  network: "mainnet";
}

function short(addr: string): string {
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`;
}

export function ReceiveCard({ data }: { data: ReceiveCardData }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(data.qrData)}`;
  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex items-center justify-between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <span className="split-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-muted)" }}>
          Receive · sui:{data.network}
        </span>
        <span className="split-mono" style={{ fontSize: 10, color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)", padding: "2px 8px", borderRadius: 99 }}>
          read-only
        </span>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ background: "#fff", padding: 10, borderRadius: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="Receive address QR" width={160} height={160} style={{ display: "block" }} />
        </div>
        <div className="flex items-center gap-2" style={{ maxWidth: "100%" }}>
          <code className="mono" style={{ fontSize: 12, color: "var(--fg)", wordBreak: "break-all" }} title={data.address}>
            {short(data.address)}
          </code>
          <CopyAddressButton address={data.address} />
        </div>
        <p style={{ fontSize: 11, color: "var(--fg-faint)", textAlign: "center", margin: 0, lineHeight: 1.45 }}>
          Send Sui assets to this address — including a withdrawal from a CEX or another wallet. Dewlock only ever signs to your own address.
        </p>
      </div>
    </div>
  );
}
