"use client";

/**
 * useConversations — client hook coordinating saved conversations with the chat
 * hook. Lists sessions from /api/conversations, opens one (rehydrating the
 * thread), creates/removes, and saves the current thread (debounced) to Walrus.
 *
 * Encryption: when Seal is usable, saveCurrent Seal-encrypts message content
 * before POST (the server stores `enc` opaquely). Opening an encrypted thread
 * lazily creates a SessionKey (1 wallet signature, first open) and decrypts
 * client-side. Legacy plaintext `messages` records open with no signature.
 *
 * Fail-soft: when persistence or Seal is unavailable the hook degrades gracefully —
 * list is empty / saves fall back to plaintext / decrypt errors show a locked panel.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "@/components/chat/chat-thread";
import type { ConversationRecord, ConversationIndexEntry } from "./conversation-store";
import { serializeMessages, deserializeMessages, deriveTitle } from "./serialize";
import { addDeletedId, clearDeletedIds, reconcileDeletedIds } from "./deleted-ids";
import {
  recordLocalEntry,
  removeLocalEntry,
  clearLocalEntries,
  readLocalEntries,
  mergeServerEntries,
} from "./local-index";
import { isSealUsable } from "@/lib/seal/seal-client";
import { encryptConversation, decryptConversation, isSealCiphertext } from "@/lib/seal/conversation-crypto";
import { ensureSessionKey } from "@/lib/seal/session-key";
import { ensureWriteAuth } from "./conversation-auth-client";

type SignPersonalMessage = (input: { message: Uint8Array }) => Promise<{ signature: string }>;

interface UseConversationsOpts {
  onLoad: (msgs: ChatMessage[]) => void;
  onReset: () => void;
  signPersonalMessage?: SignPersonalMessage;
}

/** GET /api/conversations/[id] response shape (enc XOR messages, plus metadata). */
interface ConversationGetResponse {
  id?: string;
  walletAddress?: string;
  title?: string;
  createdAt: number;
  updatedAt?: number;
  messages?: Parameters<typeof deserializeMessages>[0];
  enc?: string;
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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  /** Id of the thread currently showing the locked-preview (needs explicit unlock). */
  const [lockedId, setLockedId] = useState<string | null>(null);
  /** Last decrypt error message, displayed inside the locked overlay. */
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const createdAt = useRef<Record<string, number>>({});
  const cache = useRef<Map<string, ChatMessage[]>>(new Map());
  const autoOpenedFor = useRef<string | undefined>(undefined);
  /** True once the user has produced a SessionKey in this browser session. */
  const sessionReady = useRef(false);
  /** Single-flight guard: only one save runs at a time (serialized → no racing encrypts
   * onto the shared index). NOT skip-and-drop — overlapping saves are QUEUED below. */
  const saving = useRef(false);
  /** The latest messages requested while a save was in-flight — drained after it finishes
   * so the final batch is never lost (the Seal encrypt is slow, so saves overlap). */
  const pendingSave = useRef<ChatMessage[] | null>(null);
  /** The conversation id saves write to — a REF (not just activeId state) so a queued/
   * recursive save reuses the same id even before setActiveId flushes (no duplicate convo). */
  const idRef = useRef<string | null>(null);
  /** Always points at the latest saveCurrent (assigned after it's defined) — the finally-drain
   * calls through this so it never invokes a stale closure. */
  const saveCurrentRef = useRef<((m: ChatMessage[]) => Promise<string | null>) | null>(null);
  /** True once the user has composed/opened anything. Auto-open only fires on the
   * initial blank landing — it must NEVER clobber a live thread. Critically, the
   * Seal save is slow (write-auth signature + encrypt), so the first autosave can
   * complete + flip the list to non-empty WHILE the user is mid-swap; without this
   * guard, auto-open would reload a stale snapshot and wipe the live tx-preview. */
  const interacted = useRef(false);

  const { onLoad, onReset, signPersonalMessage } = opts;

  const refresh = useCallback(async () => {
    if (!wallet) {
      setList([]);
      return;
    }
    // Hydrate the client's just-saved entries FIRST. The server's memwal index pointer lags
    // ~30-43s, so without this a reload would resolve an older blob (fewer messages). Local
    // entries carry the authoritative newest blobId until the server pointer catches up; they
    // already exclude same-device deletions, so no deleted-id filter is needed on this pass.
    const localFirst = readLocalEntries(wallet);
    if (localFirst.length > 0) setList(localFirst);
    try {
      const res = await fetch(`/api/conversations?wallet=${encodeURIComponent(wallet)}`);
      if (!res.ok) return;
      const data: { conversations?: ConversationIndexEntry[] } = await res.json();
      // Merge local-fresh entries over the (possibly stale) server list; self-cleans entries
      // the server has caught up on. Server still owns existence — deleted/cleared ids stay gone.
      const merged = mergeServerEntries(wallet, data.conversations ?? []);
      const hidden = reconcileDeletedIds(wallet, new Set(merged.map((c) => c.id)));
      setList(hidden.size > 0 ? merged.filter((c) => !hidden.has(c.id)) : merged);
    } catch {
      /* fail-soft */
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(() => {
    interacted.current = true;
    idRef.current = null; // next save starts a fresh conversation
    setActiveId(null);
    setLockedId(null);
    setDecryptError(null);
    onReset();
  }, [onReset]);

  /**
   * Open a conversation by id.
   * `opts.auto = true` → auto-open path: show locked preview without a signature
   * prompt when the session hasn't produced a SessionKey yet.
   */
  const open = useCallback(
    async (id: string, openOpts?: { auto?: boolean }) => {
      if (!wallet) return;
      interacted.current = true;
      idRef.current = id; // subsequent saves write to the opened conversation
      setActiveId(id);

      // Cache hit → instant load, clear any locked/error state for this id.
      const cached = cache.current.get(id);
      if (cached) {
        onLoad(cached);
        setLoadingId(null);
        if (lockedId === id) setLockedId(null);
        setDecryptError(null);
        return;
      }

      setLoadingId(id);
      try {
        const blobId = list.find((c) => c.id === id)?.blobId;
        const blobParam = blobId ? `&blobId=${encodeURIComponent(blobId)}` : "";
        const res = await fetch(`/api/conversations/${id}?wallet=${encodeURIComponent(wallet)}${blobParam}`);
        if (!res.ok) return;
        const record: ConversationGetResponse = await res.json();
        if (record.createdAt) createdAt.current[id] = record.createdAt;

        // --- Branch enc FIRST (spec: [#9]) ---
        if (record.enc && isSealCiphertext(record.enc)) {
          // Auto-open before the user has unlocked this session → locked preview, no prompt.
          if (openOpts?.auto && !sessionReady.current) {
            setLockedId(id);
            return;
          }
          // Need the wallet's personal-message signer to mint a SessionKey.
          if (!signPersonalMessage) {
            setLockedId(id);
            setDecryptError("Connect a wallet to decrypt");
            return;
          }
          try {
            const sk = await ensureSessionKey(wallet, signPersonalMessage);
            sessionReady.current = true;
            const bytes = await decryptConversation(record.enc, wallet, sk);
            const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Parameters<typeof deserializeMessages>[0];
            const msgs = deserializeMessages(parsed);
            cache.current.set(id, msgs);
            onLoad(msgs);
            setLockedId(null);
            setDecryptError(null);
          } catch (err) {
            // Rejected signature or key-server failure → keep locked panel, do NOT crash.
            const msg = err instanceof Error ? err.message : "Decryption failed";
            setDecryptError(msg);
            setLockedId(id);
          }
          return;
        }

        // --- Legacy plaintext branch ---
        if (Array.isArray(record.messages)) {
          const msgs = deserializeMessages(record.messages);
          cache.current.set(id, msgs);
          onLoad(msgs);
          setLockedId(null);
          setDecryptError(null);
          return;
        }

        // Record has neither enc nor messages — explicitly unreadable.
        setDecryptError("Conversation data is unreadable");
        setLockedId(id);
      } catch {
        /* fail-soft — optimistic highlight stays; thread not replaced */
      } finally {
        setLoadingId((cur) => (cur === id ? null : cur));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, onLoad, list, signPersonalMessage, lockedId],
  );

  // Auto-open most-recent conversation on first load for a wallet (locked preview).
  useEffect(() => {
    // Only auto-open on the INITIAL blank landing. Skip once the user has composed or
    // opened anything (interacted) — otherwise a slow first save flipping the list to
    // non-empty would reload a stale snapshot over the live thread (wiping a tx-preview).
    if (!wallet || list.length === 0 || autoOpenedFor.current === wallet || interacted.current) return;
    autoOpenedFor.current = wallet;
    void open(list[0].id, { auto: true });
  }, [wallet, list, open]);

  const remove = useCallback(
    async (id: string) => {
      if (!wallet) return;
      const prev = list;
      setList((cur) => cur.filter((c) => c.id !== id));
      addDeletedId(wallet, id);
      removeLocalEntry(wallet, id);
      if (activeId === id) {
        idRef.current = null;
        setActiveId(null);
        setLockedId(null);
        setDecryptError(null);
        onReset();
      }
      try {
        // Auth gate: pass session write-auth as query params (DELETE has no standard body).
        let authQuery = "";
        if (signPersonalMessage) {
          const auth = await ensureWriteAuth(wallet, signPersonalMessage);
          authQuery = `&message=${encodeURIComponent(auth.message)}&signature=${encodeURIComponent(auth.signature)}`;
        }
        const res = await fetch(
          `/api/conversations/${id}?wallet=${encodeURIComponent(wallet)}${authQuery}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error(`delete ${res.status}`);
      } catch {
        setList(prev);
      }
    },
    [wallet, activeId, list, onReset, signPersonalMessage],
  );

  const clearAll = useCallback(async () => {
    if (!wallet || list.length === 0) return;
    const prev = list;
    setList([]);
    idRef.current = null;
    setActiveId(null);
    setLockedId(null);
    setDecryptError(null);
    cache.current.clear();
    createdAt.current = {};
    clearDeletedIds(wallet);
    clearLocalEntries(wallet);
    onReset();
    try {
      const res = await fetch(`/api/conversations?wallet=${encodeURIComponent(wallet)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`clear ${res.status}`);
    } catch {
      setList(prev);
    }
  }, [wallet, list, onReset]);

  /** Persist the current thread. Returns the conversation id (or null). */
  const saveCurrent = useCallback(
    async (messages: ChatMessage[]): Promise<string | null> => {
      if (!wallet || messages.length === 0) return null;
      // Mark interaction synchronously (before the slow write-auth + encrypt awaits) so the
      // auto-open effect can't fire on the list flipping non-empty mid-save and clobber the
      // live thread with this save's (now stale) snapshot.
      interacted.current = true;
      // A save is in-flight → QUEUE the latest messages (do NOT drop them) and drain after it
      // finishes. The Seal encrypt is slow, so the 1.5s autosaves overlap; skipping here was
      // losing the final message batch ("not all messages saved").
      if (saving.current) {
        pendingSave.current = messages;
        return null;
      }
      saving.current = true;

      try {
        // idRef is the stable conversation id across queued/recursive saves (activeId state
        // may not have flushed yet) — prevents the queued save from minting a duplicate convo.
        const id = idRef.current ?? activeId ?? newId();
        idRef.current = id;
        const now = Date.now();
        if (!createdAt.current[id]) createdAt.current[id] = now;

        const serialized = serializeMessages(messages);
        const jsonBytes = new TextEncoder().encode(JSON.stringify(serialized));

        // Build record: encrypt if Seal is usable + suiClient present, else plaintext fallback.
        let record: Omit<ConversationRecord, "messages" | "enc"> & { messages?: ConversationRecord["messages"]; enc?: string };
        const base = {
          id,
          walletAddress: wallet,
          title: deriveTitle(messages),
          createdAt: createdAt.current[id],
          updatedAt: now,
        };

        if (isSealUsable()) {
          try {
            const enc = await encryptConversation(jsonBytes, wallet);
            record = { ...base, enc };
          } catch {
            // Encrypt failed (key-server down / kill-switch off) → plaintext fallback (Decision 3).
            // The save still completes; the in-memory thread is preserved.
            record = { ...base, messages: serialized };
          }
        } else {
          record = { ...base, messages: serialized };
        }

        // Require write-auth if signPersonalMessage is available.
        let authFields: { message: string; signature: string } | null = null;
        if (signPersonalMessage) {
          authFields = await ensureWriteAuth(wallet, signPersonalMessage);
        }

        const body = authFields ? { ...record, ...authFields } : record;
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data: { ok?: boolean; blobId?: string } = await res.json().catch(() => ({}));
        if (data.ok) {
          cache.current.set(id, messages);
          if (activeId !== id) setActiveId(id);
          const entry: ConversationIndexEntry = { id, title: base.title, updatedAt: now, blobId: data.blobId ?? "" };
          // Persist the freshest blobId so a reload uses it before the server pointer catches up.
          recordLocalEntry(wallet, entry);
          setList((cur) => [entry, ...cur.filter((c) => c.id !== id)]);
          return id;
        }
      } catch {
        /* fail-soft — in-memory thread kept; save silently no-ops */
      } finally {
        saving.current = false;
        // Drain the queue: a newer save was requested while this one ran → save it now so the
        // latest messages always land (idRef keeps it on the same conversation).
        const queued = pendingSave.current;
        if (queued) {
          pendingSave.current = null;
          void saveCurrentRef.current?.(queued);
        }
      }
      return null;
    },
    [wallet, activeId, signPersonalMessage],
  );

  // Keep the ref pointing at the LATEST saveCurrent so the finally-drain never calls a stale
  // closure (idRef pins the conversation id regardless).
  saveCurrentRef.current = saveCurrent;

  /** Explicit unlock: re-open with a forced signature (no auto shortcut). */
  const unlock = useCallback(
    (id: string) => open(id),
    [open],
  );

  return {
    list,
    activeId,
    loadingId,
    lockedId,
    decryptError,
    create,
    open,
    unlock,
    remove,
    clearAll,
    saveCurrent,
  };
}
