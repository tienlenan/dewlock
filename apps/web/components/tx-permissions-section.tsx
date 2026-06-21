"use client";

/**
 * TxPermissionsSection — collapsible "what code runs + what state changes" panel.
 *
 * Contracts: pinned (exact-package allowlisted) get a green ✓; signature-matched
 * route hops get a NEUTRAL label (no ✓) — the chip never claims more than the gate.
 * Objects: grouped by change type; third-party transfers render in the destructive
 * palette and are listed first; "+K more" reflects the server-side cap honestly.
 * Anti-spoof: raw objectId + full objectType + raw package::module::function shown.
 */

import React, { useState } from "react";
import {
  groupObjectsTouched,
  groupContractsByProtocol,
  shortCoinType,
  short0x,
  type ContractCallDisplay,
  type ContractGroup,
  type ObjectTouchedDisplay,
} from "./tx-preview-format";

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--fg-faint)",
  margin: "0 0 6px",
};

function chip(color: string): React.CSSProperties {
  return {
    fontSize: "9.5px",
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    padding: "2px 7px",
    borderRadius: 99,
    flexShrink: 0,
  };
}

/** package::module::function → module::function (the package is long + repeated per call). */
function shortTarget(t: string): string {
  return t.split("::").slice(-2).join("::");
}

/**
 * One protocol the PTB calls. A multi-step route (e.g. an Aftermath swap with begin_router_tx
 * → initiate_path → swap_* → redeem → end_router_tx) is ONE row here — its individual calls
 * collapse behind a "N calls · show" toggle, so the list matches the Asset Flow's granularity.
 */
function ContractGroupRow({ g }: { g: ContractGroup }) {
  const [open, setOpen] = useState(false);
  const pinned = g.allowlistKind === "pinned";
  const n = g.targets.length;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "7px 9px",
        borderRadius: 8,
        background: "var(--bg-sub)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: "12.5px", fontWeight: 600 }}>
          {g.protocolName}{" "}
          <span style={{ fontSize: "10px", color: "var(--fg-faint)", fontWeight: 400 }}>· {g.category}</span>
        </span>
        <span className="split-mono" style={chip(pinned ? "var(--success)" : "var(--fg-muted)")}>
          {pinned ? "✓ allowlisted" : "route hop · not pinned"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="split-mono"
        style={{ alignSelf: "flex-start", fontSize: "9.5px", color: "var(--fg-muted)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
      >
        {n} call{n !== 1 ? "s" : ""} · {open ? "hide" : "show"}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {g.targets.map((t, i) => (
            <code key={i} className="mono" style={{ fontSize: "9.5px", color: "var(--fg-faint)", wordBreak: "break-all" }}>
              {shortTarget(t)}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectRow({ o }: { o: ObjectTouchedDisplay }) {
  // Only a genuinely unexpected outflow (not the address the user designated) is "danger".
  const danger = o.ownerKind === "third-party";
  const dest =
    o.ownerKind === "you"
      ? "you"
      : o.ownerKind === "recipient"
        ? "→ recipient"
        : o.ownerKind === "third-party"
          ? "→ third party"
          : o.ownerKind;
  return (
    <div
      className="flex items-center justify-between gap-2"
      style={{
        fontSize: "11.5px",
        padding: "5px 8px",
        borderRadius: 7,
        background: danger ? "color-mix(in srgb, var(--destructive) 8%, transparent)" : "var(--bg-sub)",
      }}
    >
      <span style={{ color: danger ? "var(--destructive)" : "var(--fg-muted)", fontWeight: danger ? 600 : 400 }}>
        {o.changeType}
        {o.objectType ? ` · ${shortCoinType(o.objectType)}` : ""}
      </span>
      <span className="mono" style={{ fontSize: "10px", color: danger ? "var(--destructive)" : "var(--fg-faint)" }}>
        {dest} · {short0x(o.objectId)}
      </span>
    </div>
  );
}

export function TxPermissionsSection({
  contractsCalled = [],
  objectsTouched = [],
  objectsTouchedTotal = 0,
}: {
  contractsCalled?: ContractCallDisplay[];
  objectsTouched?: ObjectTouchedDisplay[];
  objectsTouchedTotal?: number;
}) {
  const [open, setOpen] = useState(false);
  const contractGroups = groupContractsByProtocol(contractsCalled);
  const grouped = groupObjectsTouched(objectsTouched);
  const order: ObjectTouchedDisplay["changeType"][] = ["transferred", "created", "mutated", "deleted", "wrapped"];
  const moreCount = Math.max(0, objectsTouchedTotal - objectsTouched.length);
  const hasThirdParty = objectsTouched.some((o) => o.ownerKind === "third-party");

  return (
    <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
        style={{ padding: "10px 13px", background: "var(--bg-sub)", border: "none", cursor: "pointer", color: "var(--fg)" }}
      >
        <span
          className="split-mono"
          style={{ fontSize: "10.5px", letterSpacing: "0.08em", color: "var(--fg-muted)", textTransform: "uppercase" }}
        >
          Permissions &amp; contracts ({contractGroups.length} protocol{contractGroups.length !== 1 ? "s" : ""} ·{" "}
          {objectsTouchedTotal} object{objectsTouchedTotal !== 1 ? "s" : ""})
        </span>
        <span style={{ fontSize: "12px", color: "var(--fg-faint)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ padding: "12px 13px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <p className="split-mono" style={labelStyle}>Contracts (code that runs)</p>
            {contractsCalled.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--fg-muted)", margin: 0 }}>Native transfer · no external contracts.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {contractGroups.map((g, i) => (
                  <ContractGroupRow key={i} g={g} />
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="split-mono" style={labelStyle}>Objects touched</p>
            {objectsTouched.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--fg-muted)", margin: 0 }}>No object changes.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {order.flatMap((ct) => grouped[ct].map((o, i) => <ObjectRow key={`${ct}-${i}`} o={o} />))}
                {!hasThirdParty && (
                  <p style={{ fontSize: "11.5px", color: "var(--success)", margin: "2px 0 0" }}>✓ No transfers to third parties.</p>
                )}
                {moreCount > 0 && (
                  <p style={{ fontSize: "11.5px", color: "var(--fg-faint)", margin: "2px 0 0" }}>
                    +{moreCount} more change{moreCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
