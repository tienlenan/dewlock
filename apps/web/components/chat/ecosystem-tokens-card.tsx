"use client";

/**
 * EcosystemTokensCard — "memes / trending tokens on Sui". Self-fetches
 * /api/ecosystem/tokens and renders tokens ranked by market cap (logo, price,
 * 24h±, market cap, 24h volume), each linking to its CoinGecko coin page.
 */

import { EcosystemCardShell, RowLink, Rank, EcoLogo, useEcosystemData } from "./ecosystem-card-shell";
import { compactUsd, formatPct, formatPrice } from "@/lib/ecosystem/format";
import { coingeckoSuiMemeCategory } from "@/lib/ecosystem/links";
import type { TokenItem } from "@/lib/ecosystem/types";

const truncate = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

export function EcosystemTokensCard() {
  const { state, items, asOf, source, stale, retry } = useEcosystemData<TokenItem>("/api/ecosystem/tokens");

  return (
    <EcosystemCardShell
      title="Trending tokens on Sui"
      source={source}
      asOf={asOf}
      stale={stale}
      state={state}
      onRetry={retry}
      emptyText="No trending tokens to show right now."
      footerLabel="View all on CoinGecko"
      footerHref={coingeckoSuiMemeCategory()}
      loadingRows={6}
    >
      {items.map((it, i) => {
        const up = (it.change24hPct ?? 0) >= 0;
        return (
          <RowLink key={it.id} href={it.coingeckoUrl}>
            <Rank n={i + 1} />
            <EcoLogo src={it.image} label={it.symbol} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, ...truncate }}>{it.symbol}</div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", ...truncate }}>{it.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{formatPrice(it.priceUsd)}</div>
              {it.change24hPct != null && (
                <div className="mono" style={{ fontSize: 10.5, color: up ? "var(--success)" : "var(--destructive)" }}>
                  {formatPct(it.change24hPct)}
                </div>
              )}
            </div>
            <div style={{ width: 74, textAlign: "right" }}>
              <div className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>{compactUsd(it.marketCapUsd)}</div>
              {it.volume24hUsd != null && (
                <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>vol {compactUsd(it.volume24hUsd)}</div>
              )}
            </div>
          </RowLink>
        );
      })}
    </EcosystemCardShell>
  );
}
