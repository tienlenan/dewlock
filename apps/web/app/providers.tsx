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
import { TestWalletPanel } from "@/components/dev/test-wallet-panel";

// Network config — mainnet primary, devnet for confidential module (feature-flagged),
// localnet for the dev test wallet (`sui start`). dapp-kit 1.x requires a `network` field.
const { networkConfig } = createNetworkConfig({
  mainnet: {
    url: "https://fullnode.mainnet.sui.io:443",
    network: "mainnet" as const,
  },
  devnet: {
    url: "https://fullnode.devnet.sui.io:443",
    network: "devnet" as const,
  },
  localnet: {
    url: "http://127.0.0.1:9000",
    network: "localnet" as const,
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

type Network = "mainnet" | "devnet" | "localnet";
const envNetwork = process.env.NEXT_PUBLIC_SUI_NETWORK as Network | undefined;
const defaultNetwork: Network =
  envNetwork === "devnet" || envNetwork === "localnet" ? envNetwork : "mainnet";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
        <WalletProvider autoConnect>
          {children}
          {/* Dev-only burner wallet (double-gated; dead-code-eliminated on the deployed app). */}
          <TestWalletPanel />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
