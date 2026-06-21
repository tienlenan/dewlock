"use client";

/**
 * useConversations — client hook coordinating saved conversations with the chat
 * hook. Lists sessions from /api/conversations (Redis index), opens one (rehydrating
 * the thread from its Walrus blob), creates/removes, and saves the current thread
 * (debounced).
 *
 * Index: the per-wallet index is an Upstash Redis HASH (exact, no lag), so the list is
 * immediately consistent across reloads — no localStorage save/delete bridges needed
 * (the old memwal index lagged ~30-43s, which those bridges papered over).
 *
 * Encryption:
 *  - CONTENT: when Seal is usable, saveCurrent Seal-encrypts message content before POST
 *    (server stores `enc` opaquely); opening decrypts client-side via a SessionKey.
 *  - TITLES: encrypted client-side with a wallet-derived key (title-crypto). The list
 *    arrives as ciphertext titles and is decrypted in the browser; before the key is
 *    derived (one sign/session, then cached) titles render as a locked placeholder.
 *
 * Fail-soft: when persistence/Seal is unavailable the hook degrades gracefully —
 * list is empty / saves no-op / decrypt errors show a locked panel.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "@/components/chat/chat-thread";
import type { ConversationRecord, ConversationIndexEntry } from "./conversation-store";
import { serializeMessages, deserializeMessages, deriveTitle } from "./serialize";
import { isSealUsable } from "@/lib/seal/seal-client";
import { encryptConversation, decryptConversation, isSealCiphertext } from "@/lib/seal/conversation-crypto";
import { ensureSessionKey, clearSessionKey } from "@/lib/seal/session-key";
import { ensureWriteAuth, clearWriteAuth } from "./conversation-auth-client";
import { ensureTitleKey, getCachedTitleKey, encryptTitle, decryptTitle, clearTitleKey } from "./title-crypto";
import { isWalletSwitch } from "./wallet-switch";

type SignPersonalMessage = (input: { message: Uint8Array }) => Promise<{ signature: string }>;

/** A list row: the Redis index entry plus its DECRYPTED display title (client-only). */
export interface SessionItem extends ConversationIndexEntry {
  title: string;
  /** True when the title key isn't derived yet → the row renders an encrypted state
   * (icon placeholder) instead of the real title. */
  locked?: boolean;
}

/** Tooltip/aria fallback for a row whose title can't be decrypted yet (key not derived).
 * The list renders an icon for these — this string is only the accessible label. */
const LOCKED_TITLE = "Encrypted";

interface UseConversationsOpts {
  onLoad: (msgs: ChatMessage[]) => void;
  onReset: () => void;
  signPersonalMessage?: SignPersonalMessage;
}

/** GET /api/conversations/[id] response shape (enc XOR messages, plus metadata). */
interface ConversationGetResponse {
  id?: string;
  walletAddress?: string;
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

/**
 * Reveal a row's title from its just-decrypted messages (and unlock it). Used when a
 * conversation is opened: decrypting its CONTENT already yields the plaintext, so the
 * title shows with no extra title-key signature — only the active conversation is unlocked.
 */
function revealTitle(list: SessionItem[], id: string, msgs: ChatMessage[]): SessionItem[] {
  return list.map((c) => (c.id === id ? { ...c, title: deriveTitle(msgs), locked: false } : c));
}

/** Decrypt each entry's title with `key` (or mark locked when no key / on failure). */
async function decryptEntries(
  entries: ConversationIndexEntry[],
  key: CryptoKey | null,
): Promise<SessionItem[]> {
  if (!key) return entries.map((e) => ({ ...e, title: LOCKED_TITLE, locked: true }));
  return Promise.all(
    entries.map(async (e) => {
      try {
        return { ...e, title: await decryptTitle(e.titleEnc, key) };
      } catch {
        return { ...e, title: LOCKED_TITLE, locked: true };
      }
    }),
  );
}

export function useConversations(wallet: string | undefined, opts: UseConversationsOpts) {
  const [list, setList] = useState<SessionItem[]>([]);
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
  /** True once the title key has been derived this session — flip drives a one-time
   * list re-decrypt so any previously-locked rows reveal their titles. */
  const titleKeyReady = useRef(false);
  /** Single-flight guard: only one save runs at a time (serialized → no racing encrypts).
   * NOT skip-and-drop — overlapping saves are QUEUED below. */
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
   * initial blank landing — it must NEVER clobber a live thread. The Seal save is slow
   * (write-auth + encrypt), so the first autosave can complete + flip the list to
   * non-empty WHILE the user is mid-swap; without this guard, auto-open would reload a
   * stale snapshot and wipe the live tx-preview. */
  const interacted = useRef(false);

  const { onLoad, onReset, signPersonalMessage } = opts;

  const refresh = useCallback(async () => {
    if (!wallet) {
      setList([]);
      return;
    }
    try {
      const res = await fetch(`/api/conversations?wallet=${encodeURIComponent(wallet)}`);
      if (!res.ok) return;
      const data: { conversations?: ConversationIndexEntry[] } = await res.json();
      const entries = data.conversations ?? [];
      // Decrypt titles with the cached key (no prompt). Without a key yet → locked rows.
      const key = await getCachedTitleKey(wallet);
      if (key) titleKeyReady.current = true;
      setList(await decryptEntries(entries, key));
    } catch {
      /* fail-soft */
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Hard reset on a wallet SWITCH (logout→login other wallet, or account change). The
  // list is refetched per-wallet, but the in-memory thread, message cache, refs, and the
  // previous wallet's cached crypto would otherwise carry over — leaking the old wallet's
  // conversations into the new session. Purge EVERYTHING tied to the previous wallet.
  const prevWallet = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevWallet.current;
    prevWallet.current = wallet;
    if (!isWalletSwitch(prev, wallet)) return; // initial mount or same wallet → nothing to purge

    // In-memory hook state + refs.
    cache.current.clear();
    createdAt.current = {};
    idRef.current = null;
    autoOpenedFor.current = undefined;
    interacted.current = false;
    sessionReady.current = false;
    titleKeyReady.current = false;
    saving.current = false;
    pendingSave.current = null;
    setList([]);
    setActiveId(null);
    setLoadingId(null);
    setLockedId(null);
    setDecryptError(null);
    onReset(); // wipe the displayed chat thread (old wallet's messages)

    // Forget the PREVIOUS wallet's cached crypto: the in-memory SessionKey and the title
    // key persisted in localStorage ("kể cả local storage" — clear it fully).
    if (prev) {
      clearTitleKey(prev);
      clearSessionKey(prev);
      clearWriteAuth(prev); // drop the previous wallet's cached conversation write-auth too
    }
  }, [wallet, onReset]);

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
        setList((cur) => revealTitle(cur, id, cached));
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

        // --- Branch enc FIRST ---
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
            setList((cur) => revealTitle(cur, id, msgs));
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
          setList((cur) => revealTitle(cur, id, msgs));
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

  /** Build the session write-auth query (message + signature) for a DELETE, or "". */
  const authQuery = useCallback(
    async (): Promise<string> => {
      if (!wallet || !signPersonalMessage) return "";
      const auth = await ensureWriteAuth(wallet, signPersonalMessage);
      return `&message=${encodeURIComponent(auth.message)}&signature=${encodeURIComponent(auth.signature)}`;
    },
    [wallet, signPersonalMessage],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!wallet) return;
      const prev = list;
      setList((cur) => cur.filter((c) => c.id !== id));
      if (activeId === id) {
        idRef.current = null;
        setActiveId(null);
        setLockedId(null);
        setDecryptError(null);
        onReset();
      }
      try {
        // Signed HDEL — Redis is authoritative, so a deleted id never resurrects.
        const res = await fetch(
          `/api/conversations/${id}?wallet=${encodeURIComponent(wallet)}${await authQuery()}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error(`delete ${res.status}`);
      } catch {
        setList(prev);
      }
    },
    [wallet, activeId, list, onReset, authQuery],
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
    onReset();
    try {
      // Signed DEL of the whole index (clear-all is destructive → wallet-gated).
      const res = await fetch(
        `/api/conversations?wallet=${encodeURIComponent(wallet)}${await authQuery()}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`clear ${res.status}`);
    } catch {
      setList(prev);
    }
  }, [wallet, list, onReset, authQuery]);

  /** Persist the current thread. Returns the conversation id (or null). */
  const saveCurrent = useCallback(
    async (messages: ChatMessage[]): Promise<string | null> => {
      // A write needs the signer (write-auth + title key); without it, save no-ops.
      if (!wallet || messages.length === 0 || !signPersonalMessage) return null;
      // Mark interaction synchronously (before the slow awaits) so the auto-open effect
      // can't fire on the list flipping non-empty mid-save and clobber the live thread.
      interacted.current = true;
      // A save is in-flight → QUEUE the latest messages (do NOT drop them) and drain after
      // it finishes. The Seal encrypt is slow, so the 1.5s autosaves overlap.
      if (saving.current) {
        pendingSave.current = messages;
        return null;
      }
      saving.current = true;

      try {
        // idRef is the stable conversation id across queued/recursive saves.
        const id = idRef.current ?? activeId ?? newId();
        idRef.current = id;
        const now = Date.now();
        if (!createdAt.current[id]) createdAt.current[id] = now;

        const serialized = serializeMessages(messages);
        const jsonBytes = new TextEncoder().encode(JSON.stringify(serialized));
        const plainTitle = deriveTitle(messages);

        // Build the CONTENT record (no title — the title is indexed as ciphertext, never
        // on the blob). Encrypt content if Seal is usable, else plaintext fallback.
        const base = { id, walletAddress: wallet, createdAt: createdAt.current[id], updatedAt: now };
        let record: ConversationRecord;
        if (isSealUsable()) {
          try {
            const enc = await encryptConversation(jsonBytes, wallet);
            record = { ...base, enc };
          } catch {
            // Encrypt failed (key-server down / kill-switch off) → plaintext fallback.
            record = { ...base, messages: serialized };
          }
        } else {
          record = { ...base, messages: serialized };
        }

        // Write-auth (session token) + title key (one sign each, both cached for the session).
        const authFields = await ensureWriteAuth(wallet, signPersonalMessage);
        const justDerivedKey = !titleKeyReady.current;
        const titleKey = await ensureTitleKey(wallet, signPersonalMessage);
        titleKeyReady.current = true;
        const titleEnc = await encryptTitle(plainTitle, titleKey);

        const body = { ...record, titleEnc, ...authFields };
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data: { ok?: boolean; blobId?: string } = await res.json().catch(() => ({}));
        // "saved" only when the server confirms the Redis index write (report-after-HSET).
        if (data.ok) {
          cache.current.set(id, messages);
          if (activeId !== id) setActiveId(id);
          const item: SessionItem = {
            id,
            title: plainTitle, // we know the plaintext here — show it immediately
            titleEnc,
            blobId: data.blobId ?? "",
            createdAt: createdAt.current[id],
            updatedAt: now,
          };
          setList((cur) => [item, ...cur.filter((c) => c.id !== id)]);
          // First key derivation this session → re-decrypt to reveal any locked rows.
          if (justDerivedKey) void refresh();
          return id;
        }
      } catch {
        /* fail-soft — in-memory thread kept; save silently no-ops */
      } finally {
        saving.current = false;
        // Drain the queue: a newer save was requested while this one ran → save it now.
        const queued = pendingSave.current;
        if (queued) {
          pendingSave.current = null;
          void saveCurrentRef.current?.(queued);
        }
      }
      return null;
    },
    [wallet, activeId, signPersonalMessage, refresh],
  );

  // Keep the ref pointing at the LATEST saveCurrent so the finally-drain never calls a
  // stale closure (idRef pins the conversation id regardless).
  saveCurrentRef.current = saveCurrent;

  /** Explicit unlock: re-open with a forced signature (no auto shortcut). */
  const unlock = useCallback((id: string) => open(id), [open]);

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
