/**
 * Conversation (de)serialization for durable persistence.
 *
 * SAFETY INVARIANT: never persist signable material. `tx-preview` cards carry
 * `pendingTx.txBytes` + `approvedDigest` (the exact bytes a wallet would sign) —
 * those are transient and MUST NOT be written to a blob. On serialize we DROP the
 * signable bytes; a tx-preview that carries a `rebuildCommand` is converted to a
 * `tx-rebuild` card holding ONLY that command (intent params, not bytes), so a reloaded
 * conversation can re-issue it for a fresh, re-checked preview. Receipt cards (public
 * on-chain digest / blob id) are safe to keep.
 */

import type { ChatMessage, ToolCard } from "@/components/chat/chat-thread";

/** A card safe to persist — everything except the signable tx-preview. */
export type PersistableCard = Exclude<ToolCard, { type: "tx-preview" }>;

export interface SerializableMessage {
  id: string;
  role: ChatMessage["role"];
  text: string;
  cards: PersistableCard[];
}

// Strip a binding marker ([[swap:…]] / [[limit:…]]) for a human-readable rebuild label.
const BIND_MARKER = /\s*\[\[(?:swap|limit):[^\]]*\]\]/gi;

/**
 * Convert a card to its persistable form. A tx-preview is never stored with its signable
 * bytes: with a rebuild command it becomes a non-signable tx-rebuild card; without one it
 * is dropped. Everything else (already non-signable) passes through.
 */
function toPersistable(card: ToolCard): PersistableCard | null {
  if (card.type === "tx-preview") {
    if (!card.rebuildCommand) return null;
    return { type: "tx-rebuild", command: card.rebuildCommand, label: card.rebuildCommand.replace(BIND_MARKER, "").trim() };
  }
  return card;
}

/** Serialize chat messages for storage — drops signable bytes (tx-preview → tx-rebuild). */
export function serializeMessages(messages: ChatMessage[]): SerializableMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    cards: m.cards.map(toPersistable).filter((c): c is PersistableCard => c !== null),
  }));
}

/** Rehydrate stored messages back into chat messages (read-only history). */
export function deserializeMessages(stored: SerializableMessage[]): ChatMessage[] {
  return stored.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    // Default to [] — older/partial stored conversations may omit cards, and a
    // message with undefined cards crashes every consumer that maps/finds over it.
    cards: (m.cards ?? []) as ToolCard[],
    streaming: false,
  }));
}

/** Derive a short conversation title from the first user message. */
export function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.text.trim());
  const raw = firstUser?.text.trim() ?? "New conversation";
  return raw.length > 48 ? `${raw.slice(0, 47)}…` : raw;
}
