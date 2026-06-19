"use client";

/**
 * LegalLinks — footer Privacy / Terms triggers that open a concise modal (no separate route).
 * The hackathon / unaudited / small-wallet disclaimer lives inside Terms (not repeated in the
 * footer). Light scrim (the page is not dimmed), polished dark card, Escape + backdrop close,
 * portaled to <body> so the <li> triggers stay valid inside the footer's <ul>.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Doc = "privacy" | "terms";

const DOCS: Record<Doc, { title: string; body: string[] }> = {
  privacy: {
    title: "Privacy",
    body: [
      "Non-custodial: Dewlock never holds your private keys or funds. The server only builds unsigned transactions, and you sign them in your own wallet.",
      "Your wallet address is used to build transactions, read on-chain balances, and store your own data. We don't sell or share it, and run no ads or trackers.",
      "Conversations are encrypted in your browser with Mysten Seal; only your wallet can decrypt them, and the server stores opaque ciphertext.",
      "Profile, friend list, and action receipts live on Walrus (decentralized storage), keyed to your address.",
    ],
  },
  terms: {
    title: "Terms",
    body: [
      "Built for Sui Overflow 2026, a hackathon submission. The software is provided “as is”, unaudited, with no warranty of any kind.",
      "This is experimental software on Sui mainnet (real assets). Please use a secondary wallet with small funds.",
      "You are solely responsible for any transaction you choose to sign. The Guardian is best-effort safety tooling, not financial advice.",
      "Open-source at github.com/tienlenan/dewlock.",
    ],
  },
};

const TRIGGER_CLS =
  "split-mono text-xs text-fg-subtle transition-colors duration-150 hover:text-accent";

export function LegalLinks() {
  const [open, setOpen] = useState<Doc | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const doc = open ? DOCS[open] : null;

  return (
    <>
      {(["privacy", "terms"] as Doc[]).map((d) => (
        <li key={d}>
          <button
            type="button"
            className={TRIGGER_CLS}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            onClick={() => setOpen(d)}
          >
            {DOCS[d].title}
          </button>
        </li>
      ))}

      {doc &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={doc.title}
            onClick={() => setOpen(null)}
            style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(6,10,18,0.22)" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 440, background: "#10192b", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: "22px 24px", boxShadow: "0 24px 64px rgba(0,0,0,0.55)", color: "#EAF2FF" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>{doc.title}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label="Close"
                  style={{ display: "inline-flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 5, color: "rgba(234,242,255,0.7)", cursor: "pointer" }}
                >
                  <X size={15} aria-hidden />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {doc.body.map((p, i) => (
                  <p key={i} style={{ fontSize: 12.5, lineHeight: 1.6, color: "rgba(234,242,255,0.66)", margin: 0 }}>{p}</p>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
