/**
 * Memory inventory — the canonical catalog of what Dewlock persists in memwal,
 * grouped GLOBAL (seeded knowledge) vs USER (per-wallet state), with each
 * category's recall prefix + whether it is clearable.
 *
 * Clearability reality (verified against @mysten-incubation/memwal): the SDK has
 * NO delete/forget API. So a category is clearable ONLY when it is "pointer-backed"
 * (a single latest-wins pointer we can overwrite with an empty marker). Append-only
 * categories (raw per-entry writes) CANNOT be cleared — we show them honestly as
 * permanent rather than faking deletion. The action log is the XP/level source of
 * truth and is permanent by design.
 */

export type MemoryScope = "global" | "user";

export interface MemoryCategory {
  /** Stable key used in the API + UI. */
  key: string;
  /** Human label. */
  label: string;
  /** One-line description of what it does. */
  description: string;
  scope: MemoryScope;
  /** Exact line prefix used to recall + filter (memwal recall is fuzzy). */
  prefix: string;
  /** True only for pointer-backed categories that can be overwritten/cleared. */
  clearable: boolean;
  /** Why it can't be cleared (shown in the UI) — null when clearable. */
  permanentReason: string | null;
}

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  {
    key: "token-map",
    label: "Token map",
    description: "Seeded symbol → address resolution cache for the copilot.",
    scope: "global",
    prefix: "token map:",
    clearable: false,
    permanentReason: "Shared seeded knowledge (append-only).",
  },
  {
    key: "action-log",
    label: "Activity & XP",
    description: "Immutable log of your actions — the source of your level, XP, and badges.",
    scope: "user",
    prefix: "action log:",
    clearable: false,
    permanentReason: "Permanent — your earned level/XP can't be cleared here.",
  },
  {
    key: "risk-cap",
    label: "Committed cap",
    description: "Your per-trade / daily spend cap + risk profile (mirrors the server cap).",
    scope: "user",
    prefix: "risk cap:",
    clearable: false,
    permanentReason: "Re-seeded from your configured caps (append-only).",
  },
  {
    // Pointer-backed friend address book (Walrus blob + memwal pointer). Clearable via a
    // tombstone — unlike the old append-only per-contact lines, which are no longer written.
    // The count/samples are sourced from the book (listContacts), not a prefix recall.
    key: "contact",
    label: "Contacts",
    description: "Your saved friend address book (name → address) used for sends.",
    scope: "user",
    prefix: "contacts-book:",
    clearable: true,
    permanentReason: null,
  },
  {
    key: "wallet-profile",
    label: "Profile snapshot",
    description: "Durable level/XP/badges pointer (a backstop for the live derivation).",
    scope: "user",
    prefix: "wallet-profile:",
    clearable: false,
    permanentReason: "Auto-managed backstop — rebuilt from your activity.",
  },
  {
    // Conversation index now lives in Upstash Redis (exact key-value), not memwal.
    // The count/samples come from the store (listConversations), not a prefix recall;
    // `prefix` is retained only for the stable category key. Clearable via Redis DEL.
    key: "conversation-index",
    label: "Conversations",
    description: "Index of your saved chat conversations (titles encrypted).",
    scope: "user",
    prefix: "conversation-index:",
    clearable: true,
    permanentReason: null,
  },
];

export function getCategory(key: string): MemoryCategory | undefined {
  return MEMORY_CATEGORIES.find((c) => c.key === key);
}
