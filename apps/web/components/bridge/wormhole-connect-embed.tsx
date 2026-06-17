"use client";

/**
 * WormholeConnectEmbed — the real Wormhole Connect widget for the source leg.
 *
 * Connect is a self-contained widget: it bundles its own chain SDKs + wallet
 * adapters and runs isolated, so it does NOT clash with the app's @mysten/sui
 * v2.18 (the v1 conflict only applies to importing the Sui SDK into OUR code).
 *
 * Loaded via next/dynamic with ssr:false — Connect touches browser globals and
 * must not render on the server.
 */

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type WormholeConnectComponent from "@wormhole-foundation/wormhole-connect";

// Connect doesn't name-export its config type; derive it from the component props.
type ConnectConfig = NonNullable<ComponentProps<typeof WormholeConnectComponent>["config"]>;

const WormholeConnect = dynamic(
  () => import("@wormhole-foundation/wormhole-connect").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="split-mono" style={{ padding: 24, textAlign: "center", color: "var(--fg-faint)", fontSize: 11, letterSpacing: "0.1em" }}>
        loading wormhole connect…
      </div>
    ),
  },
);

// Mainnet config — bridge INTO Sui from the major source chains.
const config: ConnectConfig = {
  network: "Mainnet",
  chains: ["Sui", "Ethereum", "Solana", "Arbitrum", "Base", "Polygon", "Avalanche", "Optimism"],
};

export function WormholeConnectEmbed() {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden" }}>
      <WormholeConnect config={config} />
    </div>
  );
}
