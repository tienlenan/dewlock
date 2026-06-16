"use client";

/**
 * Dewlock client-side provider stack.
 * Adapted from walrus-memory-world-cup wallet-providers.tsx + app-providers.tsx + providers.tsx.
 * Converted from Vite to Next.js App Router ("use client" wrapper pattern).
 *
 * Order: QueryClientProvider → SuiClientProvider → WalletProvider(autoConnect)
 * dApp Kit requires this exact nesting; wrong order causes silent no-wallet.
 */

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";

// Network config — mainnet primary, devnet for confidential module (feature-flagged).
// dapp-kit 1.x requires a `network` field to match the key.
const { networkConfig } = createNetworkConfig({
  mainnet: {
    url: "https://fullnode.mainnet.sui.io:443",
    network: "mainnet" as const,
  },
  devnet: {
    url: "https://fullnode.devnet.sui.io:443",
    network: "devnet" as const,
  },
});

// Singleton QueryClient — stable across re-renders.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,   // 30s — RPC reads are cheap; avoid hammering mainnet
      retry: 1,
    },
  },
});

type Network = "mainnet" | "devnet";
const defaultNetwork: Network =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as Network | undefined) === "devnet"
    ? "devnet"
    : "mainnet";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
