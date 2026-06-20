"use client";

/**
 * EcosystemTvlCard — "top TVL on Sui / biggest protocols". Self-fetches
 * /api/ecosystem/tvl and renders protocols ranked by Sui-chain TVL, each linking
 * to its DefiLlama protocol page.
 */

import { EcosystemCardShell, RowLink, Rank, EcoLogo, useEcosystemData } from "./ecosystem-card-shell";
import { compactUsd } from "@/lib/ecosystem/format";
import { defillamaChainSui } from "@/lib/ecosystem/links";
import type { TvlItem } from "@/lib/ecosystem/types";

const truncate = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

export function EcosystemTvlCard() {
  const { state, items, asOf, source, stale, retry } = useEcosystemData<TvlItem>("/api/ecosystem/tvl");

  return (
    <EcosystemCardShell
      title="Top protocols on Sui by TVL"
      source={source}
      asOf={asOf}
      stale={stale}
      state={state}
      onRetry={retry}
      emptyText="No Sui TVL data to show right now."
      footerLabel="View all on DefiLlama"
      footerHref={defillamaChainSui()}
      loadingRows={6}
    >
      {items.map((it, i) => (
        <RowLink key={it.slug || it.name} href={it.url}>
          <Rank n={i + 1} />
          <EcoLogo src={it.image} label={it.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, ...truncate }}>{it.name}</div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)", ...truncate }}>{it.category}</div>
          </div>
          <div className="mono" style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
            {compactUsd(it.tvlSui)}
          </div>
        </RowLink>
      ))}
    </EcosystemCardShell>
  );
}
