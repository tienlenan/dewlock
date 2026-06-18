"use client";

/**
 * FriendListCard — compact friend address book on the dashboard. Read-only summary; the
 * "Manage" action opens the shared FriendListDialog (full CRUD). Consumes the lifted
 * useContacts instance so it stays in sync with the dialog (single write path).
 */

import { Users, Plus } from "lucide-react";
import type { ContactsApi } from "@/lib/contacts/use-contacts";
import { useSuinsNames } from "@/lib/use-suins-names";
import { shortAddress } from "@/lib/utils";

export function FriendListCard({ api, onManage }: { api: ContactsApi; onManage: () => void }) {
  const { contacts, loading, readOk } = api;
  const suinsNames = useSuinsNames(contacts.map((c) => c.address));

  return (
    <div
      className="w-full"
      style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-sm)", padding: 16 }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div className="flex items-center" style={{ gap: 7 }}>
          <Users size={14} aria-hidden style={{ color: "var(--fg-muted)" }} />
          <span className="split-mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--fg-muted)" }}>
            friends{contacts.length ? ` · ${contacts.length}` : ""}
          </span>
        </div>
        <button
          type="button" onClick={onManage}
          className="flex items-center transition-opacity"
          style={{ gap: 4, background: "none", border: "1px solid var(--border)", borderRadius: 99, padding: "4px 10px", color: "var(--fg-muted)", fontSize: 11, cursor: "pointer" }}
        >
          <Plus size={12} aria-hidden /> Manage
        </button>
      </div>

      {!readOk ? (
        <p style={{ fontSize: 12, color: "var(--destructive)", margin: 0 }}>Couldn’t load your friends.</p>
      ) : loading && contacts.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--fg-faint)", margin: 0 }}>Loading…</p>
      ) : contacts.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--fg-faint)", margin: 0, lineHeight: 1.5 }}>
          No friends yet. Add one to send by name — “send 1 SUI to Thomas”.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {contacts.slice(0, 5).map((c) => (
            <div key={c.address} className="flex items-center justify-between" style={{ gap: 8 }}>
              <span style={{ fontSize: 12.5, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-faint)", flexShrink: 0 }} title={c.address}>
                {suinsNames[c.address.toLowerCase()] ?? shortAddress(c.address)}
              </span>
            </div>
          ))}
          {contacts.length > 5 && (
            <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>+{contacts.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  );
}
