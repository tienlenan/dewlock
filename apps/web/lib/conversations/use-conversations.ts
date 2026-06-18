"use client";

/**
 * useConversations — client hook coordinating saved conversations with the chat
 * hook. Lists sessions from /api/conversations, opens one (rehydrating the
 * thread), creates/removes, and saves the current thread (debounced) to Walrus.
 *
 * Fail-soft: when persistence is unavailable the list is empty and saves no-op;
 * the in-memory conversation keeps working.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "@/components/chat/chat-thread";
import type { ConversationIndexEntry } from "./conversation-store";
import { serializeMessages, deserializeMessages, deriveTitle } from "./serialize";

interface UseConversationsOpts {
  onLoad: (msgs: ChatMessage[]) => void;
  onReset: () => void;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now().toString(36)}-${Math.floor(performance.now()).toString(36)}`;
  }
}

export function useConversations(wallet: string | undefined, opts: UseConversationsOpts) {
  const [list, setList] = useState<ConversationIndexEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // The conversation currently being fetched (for a loading indicator on its row).
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const createdAt = useRef<Record<string, number>>({});
  // In-memory cache of opened threads (by id) — re-opening is instant, no refetch.
  const cache = useRef<Map<string, ChatMessage[]>>(new Map());
  // The wallet whose most-recent conversation we've already auto-opened (once per wallet).
  const autoOpenedFor = useRef<string | undefined>(undefined);
  const { onLoad, onReset } = opts;

  const refresh = useCallback(async () => {
    if (!wallet) {
      setList([]);
      return;
    }
    try {
      const res = await fetch(`/api/conversations?wallet=${encodeURIComponent(wallet)}`);
      if (!res.ok) return;
      const data: { conversations?: ConversationIndexEntry[] } = await res.json();
      setList(data.conversations ?? []);
    } catch {
      /* fail-soft */
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(() => {
    setActiveId(null);
    onReset();
  }, [onReset]);

  const open = useCallback(
    async (id: string) => {
      if (!wallet) return;
      // Optimistic: highlight the row IMMEDIATELY so the click feels instant — the
      // Walrus read that follows is slow, so without this the UI looks unresponsive.
      setActiveId(id);
      // Instant re-open from the in-memory cache (no network).
      const cached = cache.current.get(id);
      if (cached) {
        onLoad(cached);
        setLoadingId(null);
        return;
      }
      setLoadingId(id);
      try {
        // Pass the blobId we already have from the list → server skips the index recall.
        const blobId = list.find((c) => c.id === id)?.blobId;
        const blobParam = blobId ? `&blobId=${encodeURIComponent(blobId)}` : "";
        const res = await fetch(`/api/conversations/${id}?wallet=${encodeURIComponent(wallet)}${blobParam}`);
        if (!res.ok) return;
        const record: { messages: Parameters<typeof deserializeMessages>[0]; createdAt: number } = await res.json();
        createdAt.current[id] = record.createdAt;
        const msgs = deserializeMessages(record.messages);
        cache.current.set(id, msgs);
        onLoad(msgs);
      } catch {
        /* fail-soft — the optimistic highlight stays; the thread just isn't replaced */
      } finally {
        setLoadingId((cur) => (cur === id ? null : cur));
      }
    },
    [wallet, onLoad, list],
  );

  // On first load for a wallet, auto-open the most-recent conversation (the store sorts
  // the list updatedAt-desc, so list[0] is newest) — the user lands on their latest thread
  // instead of a blank screen. Fires ONCE per wallet (the autoOpenedFor guard), so it
  // never re-yanks the user out of a thread they later open or a new one they start; a
  // different wallet auto-opens its own latest.
  useEffect(() => {
    if (!wallet || list.length === 0 || autoOpenedFor.current === wallet) return;
    autoOpenedFor.current = wallet;
    void open(list[0].id);
  }, [wallet, list, open]);

  const remove = useCallback(
    async (id: string) => {
      if (!wallet) return;
      // Optimistic: drop the row from the UI immediately. The backend (memwal/Walrus)
      // is slow (~30s) AND eventually-consistent, so awaiting it then refresh()-ing
      // reads a stale index and the row reappears — looking like "delete didn't work".
      // We update local state now and sync in the background; roll back only on a
      // confirmed failure. No post-delete refresh (it would race the stale index).
      const prev = list;
      setList((cur) => cur.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        onReset();
      }
      try {
        const res = await fetch(`/api/conversations/${id}?wallet=${encodeURIComponent(wallet)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`delete ${res.status}`);
      } catch {
        setList(prev); // restore the row on failure
      }
    },
    [wallet, activeId, list, onReset],
  );

  /** Delete every saved conversation for this wallet, then reset to a fresh thread.
   * One bulk DELETE (atomic empty-index write) — deleting per-id in parallel races
   * on the shared index blob and silently keeps most conversations. Optimistic:
   * clears the list instantly + syncs in the background (rolls back on failure). */
  const clearAll = useCallback(async () => {
    if (!wallet || list.length === 0) return;
    const prev = list;
    setList([]);
    setActiveId(null);
    onReset();
    try {
      const res = await fetch(`/api/conversations?wallet=${encodeURIComponent(wallet)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`clear ${res.status}`);
    } catch {
      setList(prev); // restore on failure
    }
  }, [wallet, list, onReset]);

  /** Persist the current thread. Returns the conversation id (or null). */
  const saveCurrent = useCallback(
    async (messages: ChatMessage[]): Promise<string | null> => {
      if (!wallet || messages.length === 0) return null;
      const id = activeId ?? newId();
      const now = Date.now();
      if (!createdAt.current[id]) createdAt.current[id] = now;
      const record = {
        id,
        walletAddress: wallet,
        title: deriveTitle(messages),
        createdAt: createdAt.current[id],
        updatedAt: now,
        messages: serializeMessages(messages),
      };
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(record),
        });
        const data: { ok?: boolean } = await res.json().catch(() => ({}));
        if (data.ok) {
          // Keep the cache fresh so re-opening this thread shows the just-saved version.
          cache.current.set(id, messages);
          if (!activeId) setActiveId(id);
          void refresh();
          return id;
        }
      } catch {
        /* fail-soft */
      }
      return null;
    },
    [wallet, activeId, refresh],
  );

  return { list, activeId, loadingId, create, open, remove, clearAll, saveCurrent };
}
