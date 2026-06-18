/**
 * Conversation (de)serialization for durable persistence.
 *
 * SAFETY INVARIANT: never persist signable material. `tx-preview` cards carry
 * `pendingTx.txBytes` + `approvedDigest` (the exact bytes a wallet would sign) —
 * those are transient and MUST NOT be written to a blob. We drop tx-preview
 * cards on serialize; receipt cards (public on-chain digest / blob id) are safe
 * to keep. Rehydrated conversations are read-only history, not re-signable.
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

/** True when a card is safe to persist (no signable bytes). */
function isPersistable(card: ToolCard): card is PersistableCard {
  return card.type !== "tx-preview";
}

/** Serialize chat messages for storage — drops tx-preview cards + transient flags. */
export function serializeMessages(messages: ChatMessage[]): SerializableMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    cards: m.cards.filter(isPersistable),
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
