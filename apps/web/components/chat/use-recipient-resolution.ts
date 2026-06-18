"use client";

/**
 * useRecipientResolution — resolves the recipient token the user is typing into a
 * display badge state. DISPLAY-ONLY: this never gates a send; the Guardian
 * re-resolves the recipient server-side at send time (fail-closed).
 *
 *  - friend (an @mention / bare word matching a saved contact) → instant, no RPC (violet)
 *  - full 0x address → valid immediately (neutral); a reverse SuiNS lookup enriches the
 *    label to "name.sui · 0x…" when the address owns a name (debounced)
 *  - partial 0x → "invalid" (still typing)
 *  - SuiNS name → debounced forward resolve; hit → "resolved" (green), miss → "notfound" (red)
 */

import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { detectRecipient, truncateAddress } from "@/lib/chat/recipient-detect";
import {
  resolveSuinsAddress,
  reverseResolveSuins,
  normalizeSuinsName,
} from "@/lib/contacts/suins-forward";

export type RecipientStatus = "idle" | "resolving" | "resolved" | "notfound" | "invalid";
export type RecipientDisplayKind = "friend" | "suins" | "address" | "none";

export interface ResolvedRecipient {
  status: RecipientStatus;
  kind: RecipientDisplayKind;
  /** Display label: friend name, the resolved .sui name, or a truncated 0x. */
  label: string;
  /** Resolved 0x address when known — display only, never the literal send recipient. */
  address: string | null;
}

interface Contact {
  name: string;
  address: string;
}

const IDLE: ResolvedRecipient = { status: "idle", kind: "none", label: "", address: null };
const FULL_ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;
const DEBOUNCE_MS = 350;

/** Find the saved contact a mention/bareword token refers to (display only). */
function matchContact(contacts: Contact[], token: string, isMention: boolean): Contact | null {
  const q = token.trim().toLowerCase();
  if (!q) return null;
  const exact = contacts.find((c) => c.name.toLowerCase() === q);
  if (exact) return exact;
  if (isMention) {
    // "@Mom Wallet" / "@Alice now" → the longest contact name the token starts with.
    const byPrefix = contacts
      .filter((c) => q.startsWith(c.name.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length);
    if (byPrefix[0]) return byPrefix[0];
  } else {
    const pre = contacts.find((c) => c.name.toLowerCase().startsWith(q));
    if (pre) return pre;
  }
  return null;
}

export function useRecipientResolution(text: string, contacts: Contact[] = []): ResolvedRecipient {
  const client = useSuiClient();
  const [state, setState] = useState<ResolvedRecipient>(IDLE);

  useEffect(() => {
    const det = detectRecipient(text);
    if (det.kind === "none") {
      setState(IDLE);
      return;
    }

    // Friend (mention / bareword matching a saved contact) — instant, no RPC.
    if (det.kind === "mention" || det.kind === "bareword") {
      const c = matchContact(contacts, det.token, det.kind === "mention");
      if (c) {
        setState({ status: "resolved", kind: "friend", label: c.name, address: c.address });
        return;
      }
    }

    // 0x address.
    if (det.kind === "address") {
      if (!FULL_ADDRESS_RE.test(det.token)) {
        setState({ status: "invalid", kind: "address", label: det.token, address: null });
        return;
      }
      const addr = det.token.toLowerCase();
      setState({ status: "resolved", kind: "address", label: truncateAddress(addr), address: addr });
      // Enrich the label with a reverse .sui name when the address owns one.
      let stale = false;
      const t = setTimeout(() => {
        void reverseResolveSuins(client, addr).then((name) => {
          if (!stale && name) {
            setState({
              status: "resolved",
              kind: "address",
              label: `${name} · ${truncateAddress(addr)}`,
              address: addr,
            });
          }
        });
      }, DEBOUNCE_MS);
      return () => {
        stale = true;
        clearTimeout(t);
      };
    }

    // SuiNS name (dotted), or a mention/bareword with no contact match → forward-resolve.
    const name = det.kind === "suins" ? det.token : det.token.split(/\s+/)[0];
    if (!name) {
      setState(IDLE);
      return;
    }
    const display = normalizeSuinsName(name);
    setState({ status: "resolving", kind: "suins", label: display, address: null });
    let stale = false;
    const t = setTimeout(() => {
      void resolveSuinsAddress(client, name).then((addr) => {
        if (stale) return;
        setState(
          addr
            ? { status: "resolved", kind: "suins", label: display, address: addr.toLowerCase() }
            : { status: "notfound", kind: "suins", label: display, address: null },
        );
      });
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [text, contacts, client]);

  return state;
}
