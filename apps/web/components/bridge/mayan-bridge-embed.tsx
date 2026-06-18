"use client";

/**
 * MayanBridgeEmbed — Mayan Finance's hosted cross-chain swap/bridge widget.
 *
 * Loaded via Mayan's CDN script (no npm dep → sidesteps the @mysten/sui v1-vs-v2
 * SDK-compat trap entirely). Mayan manages its own RPCs + relayer, so it does NOT
 * hit the public Sui fullnode rate-limit that made Wormhole Connect throw the
 * "Throttled" JSON error. Mayan supports Sui as a destination, so it covers the
 * "bridge into Sui" flow end-to-end (swap + delivery in one step).
 *
 * Docs: https://docs.mayan.finance/integration/swap-widget
 */

import { useEffect, useRef } from "react";

const WIDGET_SRC = "https://cdn.mayan.finance/widget/1_8_0/main.js";
const CONTAINER_ID = "mayan-widget-root";

interface MayanSwapGlobal {
  init: (containerId: string, config: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    MayanSwap?: MayanSwapGlobal;
  }
}

export function MayanBridgeEmbed() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    const init = () => {
      if (initialized.current || !window.MayanSwap) return;
      window.MayanSwap.init(CONTAINER_ID, {
        appIdentity: {
          uri: window.location.origin,
          name: "Dewlock",
          icon: `${window.location.origin}/icon.svg`,
        },
        setDefaultToken: true,
      });
      initialized.current = true;
    };

    // Already loaded (e.g. client-side nav back to /bridge).
    if (window.MayanSwap) {
      init();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", init);
      return () => existing.removeEventListener("load", init);
    }

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.async = true;
    script.addEventListener("load", init);
    document.body.appendChild(script);
    return () => script.removeEventListener("load", init);
  }, []);

  return (
    <div
      id={CONTAINER_ID}
      style={{ width: "100%", minHeight: 620, display: "flex", justifyContent: "center" }}
    >
      <span
        className="split-mono"
        style={{ alignSelf: "center", color: "var(--fg-faint)", fontSize: 11, letterSpacing: "0.1em" }}
      >
        loading mayan bridge…
      </span>
    </div>
  );
}
