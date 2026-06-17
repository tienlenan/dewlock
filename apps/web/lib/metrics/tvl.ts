/**
 * Per-protocol TVL via DefiLlama — the free, public, authoritative source for
 * protocol TVL (no key, no Pro budget). One cached call to /protocols returns
 * every protocol; we filter to Sui-chain entries and match our registry
 * protocols by normalized name, then read the Sui-chain TVL slice.
 *
 * Why DefiLlama over BlockVision for TVL: BlockVision account/coin endpoints are
 * wallet-scoped + Pro-limited, so they can't give protocol-WIDE TVL without
 * heavy dex-pool aggregation that burns the trial budget. DefiLlama is the
 * documented TVL source and is honest about the Sui-chain breakdown.
 *
 * Fail-soft: any error (network, timeout, parse) → every protocol `unavailable`.
 * Never a fabricated number.
 */

import { type Metric, available, unavailable } from "./metric";

const LLAMA_PROTOCOLS_URL = "https://api.llama.fi/protocols";
const CACHE_TTL_MS = 5 * 60_000; // protocol TVL moves slowly; 5-min cache
const TIMEOUT_MS = 9_000;

interface LlamaProtocol {
  name: string;
  chains?: string[];
  tvl?: number;
  chainTvls?: Record<string, number>;
}

let cache: { at: number; value: LlamaProtocol[] } | null = null;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Fetch + cache the DefiLlama protocol list, filtered to Sui-chain entries. */
async function fetchSuiProtocols(): Promise<LlamaProtocol[] | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(LLAMA_PROTOCOLS_URL, { signal: ctrl.signal });
    if (!res.ok) return null;
    const all = (await res.json()) as LlamaProtocol[];
    if (!Array.isArray(all)) return null;
    const sui = all.filter(
      (p) => p.chains?.includes("Sui") || p.chainTvls?.Sui != null,
    );
    cache = { at: Date.now(), value: sui };
    return sui;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Sui-chain TVL slice of one DefiLlama entry (0 when absent/non-finite). */
function suiSlice(p: LlamaProtocol): number {
  const v = p.chainTvls?.Sui != null ? p.chainTvls.Sui : p.tvl;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Find the Sui-chain TVL for a registry protocol by normalized-name match. */
function matchTvl(regName: string, suiProtocols: LlamaProtocol[]): number | null {
  const target = norm(regName);
  if (target.length < 2) return null;
  // An exact normalized-name match wins outright (a parent entry already
  // aggregates its sub-pools).
  const exact = suiProtocols.find((p) => norm(p.name) === target);
  if (exact) {
    const v = suiSlice(exact);
    return Number.isFinite(v) ? v : null;
  }
  // Otherwise SUM all containment matches — a protocol routinely splits into
  // several DefiLlama entries (e.g. Cetus → "Cetus CLMM" + "Cetus DLMM") that
  // all belong to the same registry protocol. Picking the first match would be
  // order-dependent and would undercount the total. The >=3-char guard avoids
  // short DefiLlama names false-matching via the `target.includes(n)` direction.
  const hits = suiProtocols.filter((p) => {
    const n = norm(p.name);
    return n.length >= 3 && (n.includes(target) || target.includes(n));
  });
  if (hits.length === 0) return null;
  const sum = hits.reduce((s, p) => s + suiSlice(p), 0);
  return Number.isFinite(sum) ? sum : null;
}

/**
 * TVL metric per registry protocol id. Pass the protocols you want TVL for
 * (typically active + built). Returns a map keyed by id.
 */
export async function getProtocolTvls(
  protocols: Array<{ id: string; name: string }>,
): Promise<Record<string, Metric>> {
  const sui = await fetchSuiProtocols();
  const asOf = new Date().toISOString();
  const out: Record<string, Metric> = {};
  for (const p of protocols) {
    if (!sui) {
      out[p.id] = unavailable("DefiLlama unreachable");
      continue;
    }
    const tvl = matchTvl(p.name, sui);
    out[p.id] = tvl != null ? available(tvl, "DefiLlama", asOf) : unavailable("no Sui TVL match");
  }
  return out;
}

/** Test-only: clear the module cache between cases. */
export function __clearTvlCache(): void {
  cache = null;
}
