/**
 * recipient-detect — pure, syntactic detection of the recipient token in a chat
 * composer string, for the live "recipient badge" affordance.
 *
 * DISPLAY-ONLY: this never gates a send. It only tells the badge what to resolve.
 * The Guardian re-resolves the recipient server-side at send time (fail-closed).
 *
 * Classification is syntactic only (no contact lookup, no RPC) so it is trivially
 * testable. The hook (use-recipient-resolution) does the contact-aware + RPC step:
 *   - "address"  → 0x… (full 64-hex = valid; shorter = still typing)
 *   - "mention"  → an @-prefixed token (the menu-inserted friend reference)
 *   - "suins"    → a dotted name like alice.sui (resolve forward via SuiNS)
 *   - "bareword" → a plain label (could be a saved contact OR a bare .sui label;
 *                   the hook checks contacts first, else treats it as a .sui name)
 *   - "none"     → no recipient candidate (read-only/bare commands, contextual)
 */

import { looksLikeSuinsName } from "@/lib/contacts/suins-forward";

export type RecipientKind = "address" | "suins" | "mention" | "bareword" | "none";

export interface DetectedRecipient {
  /** The recipient token (for "mention", the name with the leading "@" stripped). */
  token: string;
  kind: RecipientKind;
}

const NONE: DetectedRecipient = { token: "", kind: "none" };

/** A 0x hex address, full or partial (partial = still typing). */
const ADDRESS_RE = /^0x[0-9a-fA-F]+$/;
/** Recipient at the end of a "… to <token>" send tail (mirrors intent-directive). */
const TO_TAIL_RE = /\bto\s+(\S+)\s*$/i;
/** A captured @mention: "@" then the rest of the line (may include spaces, e.g. "@Mom Wallet"). */
const MENTION_RE = /@([^@]+)$/;
/** Only a send/transfer/pay command has a recipient after "to" — in a swap, "to <X>" is the
 *  DESTINATION TOKEN, not a recipient, so the badge must not treat it as one. */
const SEND_VERB_RE = /^(send|transfer|pay)\b/i;

/** Classify a non-mention recipient token by syntax alone. */
function classifyToken(token: string): RecipientKind {
  if (ADDRESS_RE.test(token)) return "address";
  if (!looksLikeSuinsName(token)) return "none";
  // A dotted name (alice.sui / sub.alice.sui) is unambiguously a SuiNS name;
  // a bare label is ambiguous (contact vs bare .sui label) — the hook decides.
  return token.includes(".") ? "suins" : "bareword";
}

/**
 * Detect the recipient candidate in a composer string. Precedence:
 *   1. a trailing @mention ("…to @alice") — the menu-inserted / typed reference
 *   2. the token after a trailing "to " ("send 5 SUI to alice.sui")
 *   3. the whole input when it is a single bare token ("alice.sui", "0x…")
 * Anything else → none.
 */
export function detectRecipient(text: string): DetectedRecipient {
  const raw = text.trim();
  if (!raw) return NONE;

  // 1) Explicit @mention anywhere — capture everything after the last "@" so multi-word
  //    contact names ("@Mom Wallet") survive; the hook trims to the matched name.
  const mention = MENTION_RE.exec(raw);
  if (mention) {
    const token = mention[1].trim();
    if (token) return { token, kind: "mention" };
  }

  // 2) "send/transfer/pay … to <token>" tail. Gated to send verbs so a swap's
  //    "to <destination token>" is NOT mistaken for a recipient.
  if (SEND_VERB_RE.test(raw)) {
    const toTail = TO_TAIL_RE.exec(raw);
    if (toTail) {
      const kind = classifyToken(toTail[1]);
      if (kind !== "none") return { token: toTail[1], kind };
    }
  }

  // 3) The whole input is a single pasted recipient — only an address or a dotted .sui
  //    name (a bare command word like "swap"/"lend" must NOT become a recipient).
  if (!/\s/.test(raw)) {
    const kind = classifyToken(raw);
    if (kind === "address" || kind === "suins") return { token: raw, kind };
  }

  return NONE;
}

/**
 * Detect ALL recipient candidates for a multi-recipient send ("send X to @A @B",
 * "send X to @A and @B"). Returns one entry per recipient. For 0–1 recipients it is
 * just `detectRecipient(text)` (or `[]`), so single-send behaviour is unchanged.
 *
 * Multi-recipient is keyed on 2+ "@" mentions in the RAW (pre-submit) composer text —
 * the @mention menu inserts "@Name " per friend, so the live text holds raw @tokens
 * (substituteMentions only runs on submit). Names may contain spaces, so each segment
 * after an "@" (up to the next "@") is one recipient token; trailing connectors/commas
 * the split leaves ("Alice and", "Alice,") are stripped — the hook prefix-matches anyway.
 */
export function detectRecipients(text: string): DetectedRecipient[] {
  const raw = text.trim();
  if (!raw) return [];
  const atCount = (raw.match(/@/g) || []).length;
  if (atCount >= 2) {
    return raw
      .split("@")
      .slice(1)
      .map((seg) => seg.replace(/[\s,]+$/, "").replace(/\s+(?:and|plus)$/i, "").trim())
      .filter(Boolean)
      .map((token) => ({ token, kind: "mention" as const }));
  }
  const single = detectRecipient(raw);
  return single.kind === "none" ? [] : [single];
}

/** Shorten a 0x address for display: "0x1234…abcd". Returns the input unchanged when too short. */
export function truncateAddress(address: string, head = 6, tail = 4): string {
  if (!address.startsWith("0x") || address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
