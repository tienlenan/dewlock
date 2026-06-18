"use client";

/**
 * FriendListDialog — a lightweight modal for managing the friend address book
 * (list + add/edit + delete + clear-all). Each write prompts a wallet signature (via the
 * shared useContacts api) and persists to Walrus + memwal. Kept as one file (well under the
 * 200-LOC ceiling); split into row/form only if it grows.
 */

import { useEffect, useState } from "react";
import { X, Trash2, Pencil } from "lucide-react";
import { useSuiClient } from "@mysten/dapp-kit";
import type { ContactsApi } from "@/lib/contacts/use-contacts";
import { useSuinsNames } from "@/lib/use-suins-names";
import { FriendListRowsSkeleton } from "@/components/dashboard/dashboard-skeletons";
import { resolveSuinsAddress, looksLikeSuinsName, normalizeSuinsName } from "@/lib/contacts/suins-forward";

const ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

const inputStyle: React.CSSProperties = {
  width: "100%", height: 34, borderRadius: 9, border: "1px solid var(--border)",
  background: "var(--bg-sub)", color: "var(--fg)", padding: "0 10px",
  fontSize: 12.5, fontFamily: "var(--font-mono)", outline: "none",
};

export function FriendListDialog({
  open,
  onClose,
  api,
  connected,
}: {
  open: boolean;
  onClose: () => void;
  api: ContactsApi;
  connected: boolean;
}) {
  const { contacts, loading, readOk, saveContact, removeContact, clearAll } = api;
  const client = useSuiClient();
  const suinsNames = useSuinsNames(contacts.map((c) => c.address));
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [resolveErr, setResolveErr] = useState<string | null>(null);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const nameOk = name.trim().length > 0 && name.trim().length <= 64;
  // The address field accepts a 0x address OR a SuiNS name (alice.sui / bare "alice").
  const addrIsSuins = !ADDRESS_RE.test(address.trim()) && looksLikeSuinsName(address.trim());
  const addrOk = ADDRESS_RE.test(address.trim()) || addrIsSuins;
  const canSave = connected && nameOk && addrOk && !pending;

  async function handleSave() {
    if (!canSave) return;
    setPending(true);
    setResolveErr(null);
    const raw = address.trim();
    let resolved = raw.toLowerCase();
    // SuiNS name → forward-resolve to a 0x before saving (we store the address).
    if (!ADDRESS_RE.test(raw)) {
      const addr = await resolveSuinsAddress(client, raw);
      if (!addr) {
        setResolveErr(`Couldn't resolve ${normalizeSuinsName(raw)} — check the name.`);
        setPending(false);
        return;
      }
      resolved = addr.toLowerCase();
    }
    const ok = await saveContact(name.trim(), resolved);
    setPending(false);
    if (ok) { setName(""); setAddress(""); }
    else setResolveErr("Save failed — please try again.");
  }

  async function handleDelete(n: string) {
    if (pending) return;
    setPending(true);
    await removeContact(n);
    setPending(false);
  }

  async function handleClear() {
    if (pending || contacts.length === 0) return;
    if (!window.confirm("Remove ALL saved friends? This signs one wallet message.")) return;
    setPending(true);
    await clearAll();
    setPending(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Friend list"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto", border: "1px solid var(--border)", borderRadius: 16, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)", padding: 18 }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div className="split-mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-muted)" }}>
            Friend list{contacts.length ? ` · ${contacts.length}` : ""}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", padding: 2 }}>
            <X size={16} aria-hidden />
          </button>
        </div>

        {!connected ? (
          <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Connect your wallet to manage friends.</p>
        ) : (
          <>
            {/* Add / edit form */}
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              <input style={inputStyle} placeholder="Name (e.g. Thomas)" value={name} maxLength={64} onChange={(e) => setName(e.target.value)} disabled={pending} />
              <input style={{ ...inputStyle, borderColor: address && !addrOk ? "var(--destructive)" : "var(--border)" }} placeholder="0x… address or alice.sui" value={address} onChange={(e) => { setAddress(e.target.value); setResolveErr(null); }} disabled={pending} />
              {addrIsSuins && (
                <span style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>Will resolve {normalizeSuinsName(address.trim())} → 0x on save.</span>
              )}
              {resolveErr && (
                <span style={{ fontSize: 11, color: "var(--destructive)" }}>{resolveErr}</span>
              )}
              <button
                type="button" onClick={handleSave} disabled={!canSave}
                style={{ height: 36, borderRadius: 10, border: "none", background: canSave ? "var(--accent)" : "var(--bg-sub)", color: canSave ? "#fff" : "var(--fg-faint)", fontSize: 13, fontWeight: 600, cursor: canSave ? "pointer" : "default" }}
              >
                {pending ? (addrIsSuins ? "Resolving…" : "Signing…") : "Save friend"}
              </button>
            </div>

            {/* List */}
            {!readOk ? (
              <p style={{ fontSize: 12.5, color: "var(--destructive)" }}>Couldn’t load your friends — try again.</p>
            ) : loading && contacts.length === 0 ? (
              <FriendListRowsSkeleton rows={4} />
            ) : contacts.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--fg-faint)" }}>No friends saved yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 7 }}>
                {contacts.map((c) => (
                  <div key={c.address} className="flex items-center justify-between" style={{ gap: 8, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-sub)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="flex items-center" style={{ gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>{c.name}</span>
                        {suinsNames[c.address.toLowerCase()] && (
                          <span style={{ fontSize: 10.5, color: "var(--accent-ink)", fontFamily: "var(--font-mono)" }}>
                            {suinsNames[c.address.toLowerCase()]}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--fg-faint)", wordBreak: "break-all", fontFamily: "var(--font-mono)" }}>{c.address}</div>
                    </div>
                    <div className="flex items-center" style={{ gap: 4, flexShrink: 0 }}>
                      <button type="button" aria-label={`Edit ${c.name}`} title="Edit" onClick={() => { setName(c.name); setAddress(c.address); }} disabled={pending} style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", padding: 4 }}>
                        <Pencil size={13} aria-hidden />
                      </button>
                      <button type="button" aria-label={`Delete ${c.name}`} title="Delete" onClick={() => handleDelete(c.name)} disabled={pending} style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", padding: 4 }}>
                        <Trash2 size={13} aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contacts.length > 0 && (
              <button type="button" onClick={handleClear} disabled={pending} style={{ marginTop: 12, background: "none", border: "none", color: "var(--fg-muted)", fontSize: 11.5, cursor: pending ? "default" : "pointer" }}>
                Clear all friends
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
