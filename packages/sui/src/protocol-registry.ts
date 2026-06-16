/**
 * protocol-registry.ts — single source of truth for which Sui DeFi protocols
 * Dewlock knows about, their category, SDK, and security posture.
 *
 * The registry is the SOLE author of the active Move-target set: allowlist.ts
 * derives ALLOWED_MOVE_TARGETS from getActiveMoveTargets() here, so the enforced
 * allowlist and the displayed posture can never drift apart.
 *
 * Fail-closed by construction:
 *  - Only entries that are BOTH status="active" AND buildState="built" contribute
 *    Move targets to the enforced set. A recognized-but-unbuilt protocol, a hacked
 *    protocol, or an off-model protocol contributes nothing.
 *  - An unknown protocol id / unknown target is treated as inactive.
 *
 * Excluded protocols stay LISTED (registry + /api/protocols + UI badges) so the
 * posture is explicit, but they are refused before any PTB is built
 * (allowlist-before-build invariant).
 */

import { CORE_TARGETS } from "./protocol-constants";
import { PROTOCOLS } from "./protocol-registry-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProtocolCategory =
  | "dex"
  | "aggregator"
  | "lending"
  | "lst"
  | "perps"
  | "bridge"
  | "yield";

/**
 * Security posture (NOT SDK buildability):
 *  - active:           audit-clean / recovered & on-model.
 *  - listed-excluded:  off-model (e.g. off-chain signed orders) — listed, never built.
 *  - hacked:           recent unresolved incident — listed, never built.
 */
export type ProtocolStatus = "active" | "listed-excluded" | "hacked";

/**
 * Build reality (separate from security status):
 *  - built:    a Dewlock adapter exists; its targets are enforced.
 *  - deferred: recognized + status-active but no adapter yet (e.g. SDK peer-dep
 *              not yet on @mysten/sui v2, or no unsigned-PTB SDK path).
 *  - excluded: never to be built (hacked / off-model).
 */
export type ProtocolBuildState = "built" | "deferred" | "excluded";

export interface ProtocolIncident {
  /** ISO date of the incident (YYYY-MM-DD). */
  date: string;
  /** Approximate USD loss. */
  amountUsd?: number;
  /** Root-cause class (e.g. "integer-overflow", "access-control"). */
  rootCauseClass?: string;
  /** Short human summary. */
  summary?: string;
}

export interface ProtocolEntry {
  /** Stable id used for routing (e.g. "cetus", "navi"). */
  id: string;
  /** Display name. */
  name: string;
  category: ProtocolCategory;
  /** npm SDK package, when one is used. */
  sdkPackage?: string;
  status: ProtocolStatus;
  buildState: ProtocolBuildState;
  /** Most recent security incident, if any (drives the status-aware block reason). */
  lastIncident?: ProtocolIncident;
  /** Exact {package::module::function} targets this protocol's PTBs may call. */
  allowlistedTargets: string[];
  /** Canonical coin types this protocol operates on. */
  coinTypes: string[];
  /** Posture notes surfaced to operators / the UI. */
  guardianNotes?: string;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** All protocols Dewlock knows about (active + excluded). */
export function getProtocols(): ProtocolEntry[] {
  return PROTOCOLS;
}

/** Look up a protocol by id (undefined if unknown). */
export function getProtocol(id: string): ProtocolEntry | undefined {
  return PROTOCOLS.find((p) => p.id === id);
}

/** Security-active protocols (regardless of whether an adapter is built yet). */
export function getActiveProtocols(): ProtocolEntry[] {
  return PROTOCOLS.filter((p) => p.status === "active");
}

/** Excluded protocols (hacked or off-model) — listed but never built. */
export function getExcludedProtocols(): ProtocolEntry[] {
  return PROTOCOLS.filter((p) => p.status !== "active");
}

/** Protocols whose targets are actually enforced (active AND built). */
export function getBuiltProtocols(): ProtocolEntry[] {
  return PROTOCOLS.filter((p) => p.status === "active" && p.buildState === "built");
}

/**
 * The enforced active Move-target set: targets from active+built protocols only.
 * allowlist.ts unions this with CORE_TARGETS to form ALLOWED_MOVE_TARGETS.
 */
export function getActiveMoveTargets(): string[] {
  const set = new Set<string>();
  for (const p of getBuiltProtocols()) {
    for (const t of p.allowlistedTargets) set.add(t);
  }
  return [...set];
}

/** Find the protocol that owns a given Move target (searches all entries). */
export function getProtocolByTarget(target: string): ProtocolEntry | undefined {
  return PROTOCOLS.find((p) => p.allowlistedTargets.includes(target));
}

/**
 * Is a Move target permitted? True only for CORE_TARGETS or a target owned by an
 * active+built protocol. Everything else (unknown, deferred, excluded) → false.
 */
export function isTargetActive(target: string): boolean {
  if (CORE_TARGETS.includes(target)) return true;
  return getActiveMoveTargets().includes(target);
}

// ---------------------------------------------------------------------------
// Routing gate — allowlist-BEFORE-build enforcement
// ---------------------------------------------------------------------------

export interface ProtocolGateResult {
  ok: boolean;
  reason?: string;
}

/**
 * Refuse to route to a protocol that is not active+built, with a status-aware
 * reason. Called by tools BEFORE a PTB is constructed, so a hacked / off-model /
 * unbuilt protocol is rejected up front (the registry's primary security gate).
 */
export function assertProtocolActive(id: string): ProtocolGateResult {
  const p = getProtocol(id);
  if (!p) {
    return {
      ok: false,
      reason: `Unknown protocol "${id}" — not in the registry. Refusing (fail-closed).`,
    };
  }
  if (p.status === "hacked") {
    const inc = p.lastIncident;
    const detail = inc
      ? ` (security incident ${inc.date}${inc.amountUsd ? `, ~$${formatUsd(inc.amountUsd)} lost` : ""}${inc.rootCauseClass ? `, ${inc.rootCauseClass}` : ""})`
      : "";
    return {
      ok: false,
      reason: `Protocol "${p.name}" is excluded — hacked${detail}. Refusing to build against a compromised protocol.`,
    };
  }
  if (p.status === "listed-excluded") {
    return {
      ok: false,
      reason: `Protocol "${p.name}" is listed but excluded${p.guardianNotes ? ` (${p.guardianNotes})` : ""}. Not built.`,
    };
  }
  // status === "active"
  if (p.buildState !== "built") {
    return {
      ok: false,
      reason: `Protocol "${p.name}" is recognized but no Dewlock adapter is built yet (build deferred). Refusing.`,
    };
  }
  return { ok: true };
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}
