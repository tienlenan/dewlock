"use client";

/**
 * RecipientBadge — the colored recipient affordance shown below the suggestion chips.
 * Pure presentation of the useRecipientResolution state. DISPLAY-ONLY: it never gates
 * a send (the Guardian re-resolves server-side); a red/amber badge only warns.
 *
 *  violet  = saved friend            green  = SuiNS resolved
 *  neutral = valid 0x address        amber  = resolving / still typing
 *  red     = SuiNS name not found
 */

import { truncateAddress } from "@/lib/chat/recipient-detect";
import type { ResolvedRecipient, RecipientStatus, RecipientDisplayKind } from "./use-recipient-resolution";

interface Tone {
  fg: string;
  bg: string;
  bd: string;
  caption: string;
  suffix: string;
}

function toneFor(status: RecipientStatus, kind: RecipientDisplayKind): Tone {
  const make = (color: string, caption = "", suffix = ""): Tone => ({
    fg: color,
    bg: `color-mix(in srgb, ${color} 10%, transparent)`,
    bd: `color-mix(in srgb, ${color} 32%, transparent)`,
    caption,
    suffix,
  });
  if (status === "resolving") return make("var(--warning)", "Resolving ", "…");
  if (status === "invalid") return make("var(--warning)", "", " — keep typing");
  if (status === "notfound") return make("var(--destructive)", "", " — not found");
  // resolved
  if (kind === "friend") return make("#7c3aed", "Friend · ");
  if (kind === "suins") return make("var(--success)", "");
  return make("var(--fg-muted)", ""); // address
}

export function RecipientBadge({ recipient }: { recipient: ResolvedRecipient }) {
  const { status, kind, label, address } = recipient;
  if (status === "idle") return null;

  const tone = toneFor(status, kind);
  // Append the resolved 0x only when the label is a name (friend/suins); the address
  // kind already shows the 0x (optionally prefixed with a reverse .sui name) in `label`.
  const showAddress = status === "resolved" && kind !== "address" && Boolean(address);

  return (
    <div className="flex" style={{ marginBottom: 8 }}>
      <span
        title={address ?? undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          maxWidth: "100%",
          padding: "4px 11px",
          borderRadius: 99,
          fontSize: "12px",
          fontWeight: 500,
          color: tone.fg,
          background: tone.bg,
          border: `1px solid ${tone.bd}`,
          fontFamily: "var(--font-sans)",
        }}
      >
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: tone.fg, flexShrink: 0 }} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {tone.caption}
          {label}
          {showAddress && (
            <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
              {" → "}
              {truncateAddress(address as string)}
            </span>
          )}
          {tone.suffix}
        </span>
      </span>
    </div>
  );
}
