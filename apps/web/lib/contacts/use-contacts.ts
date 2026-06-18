"use client";

/**
 * useContacts — client hook for the friend address book. Lists via GET /api/contacts and
 * mutates via signed POST/DELETE. Each write builds a PAYLOAD-BOUND personal-message
 * signature (sha256 of the {op,name,address}) so a captured signature can't be replayed
 * with a swapped address. Writes are single-flight (one in-flight at a time) to avoid the
 * read-modify-write race on the shared book blob (dialog + dashboard card / multi-tab).
 *
 * `contacts` is also the freshest book — the chat passes it to /api/agent so a just-added
 * or just-deleted friend resolves immediately (memwal recall lags ~30s).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useSignPersonalMessage } from "@mysten/dapp-kit";

export interface Contact {
  name: string;
  address: string;
  updatedAt?: number;
}

type Op = "upsert" | "delete" | "clear";

/** Browser sha256-hex — MUST match the server's contactsPayloadHash (node:crypto). */
async function payloadHash(op: Op, name = "", address = ""): Promise<string> {
  const canonical = JSON.stringify([op, name.trim(), address.trim().toLowerCase()]);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useContacts(wallet: string | undefined) {
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [readOk, setReadOk] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false); // single-flight write guard

  const reload = useCallback(async () => {
    if (!wallet) {
      setContacts([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?wallet=${encodeURIComponent(wallet)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { readOk?: boolean; contacts?: Contact[] };
      setContacts(data.contacts ?? []);
      setReadOk(data.readOk !== false);
      setError(null);
    } catch (e) {
      setReadOk(false);
      setError(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Add or edit a contact (upsert by case-insensitive name). Returns ok. */
  const saveContact = useCallback(
    async (name: string, address: string): Promise<boolean> => {
      if (!wallet || busy.current) return false;
      busy.current = true;
      try {
        const ts = Date.now();
        const message = `dewlock-contacts:upsert:${wallet}:${ts}:${await payloadHash("upsert", name, address)}`;
        const { signature } = await signPersonalMessage({ message: new TextEncoder().encode(message) });
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ walletAddress: wallet, name, address, message, signature }),
        });
        if (!res.ok) throw new Error(`save ${res.status}`);
        await reload();
        return true;
      } catch {
        return false;
      } finally {
        busy.current = false;
      }
    },
    [wallet, signPersonalMessage, reload],
  );

  /** Delete a contact by name. Returns ok. */
  const removeContact = useCallback(
    async (name: string): Promise<boolean> => {
      if (!wallet || busy.current) return false;
      busy.current = true;
      try {
        const ts = Date.now();
        const message = `dewlock-contacts:delete:${wallet}:${ts}:${await payloadHash("delete", name)}`;
        const { signature } = await signPersonalMessage({ message: new TextEncoder().encode(message) });
        const res = await fetch(`/api/contacts?wallet=${encodeURIComponent(wallet)}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, message, signature }),
        });
        if (!res.ok) throw new Error(`delete ${res.status}`);
        await reload();
        return true;
      } catch {
        return false;
      } finally {
        busy.current = false;
      }
    },
    [wallet, signPersonalMessage, reload],
  );

  /** Clear the whole book. Returns ok. */
  const clearAll = useCallback(async (): Promise<boolean> => {
    if (!wallet || busy.current) return false;
    busy.current = true;
    try {
      const ts = Date.now();
      const message = `dewlock-contacts:clear:${wallet}:${ts}`;
      const { signature } = await signPersonalMessage({ message: new TextEncoder().encode(message) });
      const res = await fetch(`/api/contacts?wallet=${encodeURIComponent(wallet)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!res.ok) throw new Error(`clear ${res.status}`);
      await reload();
      return true;
    } catch {
      return false;
    } finally {
      busy.current = false;
    }
  }, [wallet, signPersonalMessage, reload]);

  return { contacts, loading, readOk, error, reload, saveContact, removeContact, clearAll };
}

/** Shared shape so the dialog + dashboard card consume one lifted instance (single-flight). */
export type ContactsApi = ReturnType<typeof useContacts>;
