"use client";

/**
 * EcosystemYieldsCard — "best stablecoin yields on Sui". Self-fetches
 * /api/ecosystem/yields and renders ranked pools (APY, base/reward split, TVL),
 * each linking to its DefiLlama pool page.
 */

import { EcosystemCardShell, RowLink, Rank, EcoLogo, useEcosystemData } from "./ecosystem-card-shell";
import { compactUsd, formatApy } from "@/lib/ecosystem/format";
import { defillamaYields } from "@/lib/ecosystem/links";
import type { YieldItem } from "@/lib/ecosystem/types";

const truncate = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

export function EcosystemYieldsCard() {
  const { state, items, asOf, source, stale, retry } = useEcosystemData<YieldItem>("/api/ecosystem/yields");

  return (
    <EcosystemCardShell
      title="Best stablecoin yields on Sui"
      source={source}
      asOf={asOf}
      stale={stale}
      state={state}
      onRetry={retry}
      emptyText="No Sui stablecoin pools to show right now."
      footerLabel="View all on DefiLlama"
      footerHref={defillamaYields()}
      loadingRows={6}
    >
      {items.map((it, i) => {
        const hasReward = (it.apyReward ?? 0) > 0;
        return (
          <RowLink key={it.poolId} href={it.url}>
            <Rank n={i + 1} />
            <EcoLogo src={it.image} label={it.project} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, ...truncate }}>{it.project}</div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", ...truncate }}>{it.symbol}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontSize: 13.5, fontWeight: 650, color: "var(--accent-ink)" }}>{formatApy(it.apy)}</div>
              {hasReward && (
                <div style={{ fontSize: 10, color: "var(--fg-muted)" }}>
                  base {formatApy(it.apyBase ?? 0)} · rwd {formatApy(it.apyReward ?? 0)}
                </div>
              )}
            </div>
            <div className="mono" style={{ width: 74, textAlign: "right", fontSize: 12, color: "var(--fg-muted)" }}>
              {compactUsd(it.tvlUsd)}
            </div>
          </RowLink>
        );
      })}
    </EcosystemCardShell>
  );
}
