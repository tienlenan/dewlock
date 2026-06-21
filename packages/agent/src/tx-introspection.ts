/**
 * PTB introspection for the pre-sign preview — extracts the Move-call targets a
 * transaction invokes and labels each with its protocol + allowlist provenance.
 *
 * WHY this lives next to the guardian: ONE classifyTarget predicate decides both
 * whether the allowlist gate passes a call AND how the preview labels it, so a
 * "✓ allowlisted" chip can never claim more than the gate actually enforced.
 * Everything here is display-only derivation — it never alters txBytes or the
 * WYSIWYS digest.
 */

import { Transaction } from "@mysten/sui/transactions";
import {
  ALLOWED_MOVE_TARGETS,
  isAggregatorSwapCall,
  isAftermathSwapCall,
  getProtocolByTarget,
} from "./allowlist";

/** A single MoveCall parsed from a PTB, split so the signature matchers can run. */
export interface ParsedMoveCall {
  /** package::module::function */
  target: string;
  package: string;
  module: string;
  function: string;
}

/**
 * Allowlist provenance of a Move target:
 *  - "pinned":            exact package::module::function on the static allowlist.
 *  - "signature-matched": an aggregator/aftermath route call whose per-route package
 *                         is upgradeable and cannot be statically pinned — admitted by
 *                         module::function signature, NOT a named, verified package.
 *  - "none":              not permitted (the gate blocks before this ever previews).
 */
export type AllowlistKind = "pinned" | "signature-matched" | "none";

/** A contract the PTB invokes, labelled for the permissions UI. */
export interface ContractCall {
  target: string;
  protocolName: string;
  category: string;
  status: string;
  allowlistKind: AllowlistKind;
}

/**
 * Parse a base64 PTB and return its MoveCall targets (split into package/module/
 * function). Native PTB commands (splitCoins/transferObjects/mergeCoins) are NOT
 * MoveCalls and never appear here — a pure SUI transfer yields []. Throws on a
 * malformed PTB; callers treat a throw as "no introspection", never as approval.
 */
export function extractMoveTargets(txBytesB64: string): ParsedMoveCall[] {
  const tx = Transaction.from(Buffer.from(txBytesB64, "base64"));
  const commands = tx.getData().commands ?? [];
  const calls: ParsedMoveCall[] = [];
  for (const cmd of commands) {
    if ("MoveCall" in cmd && cmd.MoveCall) {
      const mc = cmd.MoveCall;
      calls.push({
        target: `${mc.package}::${mc.module}::${mc.function}`,
        package: mc.package,
        module: mc.module,
        function: mc.function,
      });
    }
  }
  return calls;
}

/**
 * Single source of truth for a target's allowlist provenance — used by BOTH the
 * guardian allowlist gate (pass iff !== "none") and the preview labeller, so the
 * displayed chip can never contradict what the gate enforced. Exact-package wins
 * over signature-match: a target that is both pinned AND matches a route signature
 * reports "pinned" (the stronger, verified provenance).
 */
export function classifyTarget(
  target: string,
  moduleName: string,
  functionName: string,
): AllowlistKind {
  if (ALLOWED_MOVE_TARGETS.has(target)) return "pinned";
  if (isAggregatorSwapCall(moduleName, functionName)) return "signature-matched";
  if (isAftermathSwapCall(moduleName, functionName)) return "signature-matched";
  return "none";
}

/**
 * Map parsed MoveCalls to labelled ContractCall rows for the permissions UI.
 * - Targets owned by a named protocol (getProtocolByTarget) → that protocol, "pinned".
 * - Aggregator/aftermath route calls (registry can't name the per-route package) →
 *   a route-hop label, "signature-matched" (the UI renders NO green ✓ for these).
 * - Framework primitives (pinned core targets with no protocol owner, e.g.
 *   coin::from_balance) contribute NO row — they are not external contracts.
 * Deduped by target, preserving first-seen order.
 */
export function buildContractsCalled(calls: ParsedMoveCall[]): ContractCall[] {
  const seen = new Set<string>();
  const out: ContractCall[] = [];
  for (const call of calls) {
    if (seen.has(call.target)) continue;
    seen.add(call.target);

    // Gate the "pinned" label on classifyTarget (active+built only), NOT on
    // getProtocolByTarget alone — the registry also names excluded/deferred
    // protocols, so a target the gate would refuse must never render a ✓ chip.
    const kind = classifyTarget(call.target, call.module, call.function);
    const proto = getProtocolByTarget(call.target);
    if (kind === "pinned" && proto) {
      out.push({
        target: call.target,
        protocolName: proto.name,
        category: proto.category,
        status: proto.status,
        allowlistKind: "pinned",
      });
      continue;
    }

    if (kind === "signature-matched") {
      const isAftermath = isAftermathSwapCall(call.module, call.function);
      out.push({
        target: call.target,
        protocolName: isAftermath ? "Aftermath Router (route)" : "Cetus Aggregator (route)",
        category: "aggregator",
        status: "active",
        allowlistKind: "signature-matched",
      });
      continue;
    }
    if (kind === "pinned") {
      // Pinned but unowned = a framework/core primitive (coin::from_balance,
      // pay::split_and_transfer, …). Not an external contract → no row.
      continue;
    }
    // kind === "none": off-allowlist. The gate blocks these before preview, so this
    // is defensive only — surface it honestly rather than hide it.
    out.push({
      target: call.target,
      protocolName: call.module,
      category: "unknown",
      status: "unknown",
      allowlistKind: "none",
    });
  }
  return out;
}
