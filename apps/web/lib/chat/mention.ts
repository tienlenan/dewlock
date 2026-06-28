/**
 * mention — pure helpers for the @mention friends menu in the chat composer.
 *
 * The composer stays a plain <input>; we track the caret to know when an `@query`
 * is being typed (open + filter the menu), insert the FULL canonical `@Name` on
 * select, and on submit rewrite each `@Name` to that contact's RESOLVED 0x ADDRESS
 * (captured from the dropdown pick, not re-parsed from rendered text downstream) so
 * multi-word/duplicate names can't be mis-read. DISPLAY/INPUT convenience only — the
 * Guardian still re-resolves and re-checks the recipient server-side at send time.
 */

export interface MentionContact {
  name: string;
  address: string;
}

export interface ActiveMention {
  /** The single-token query typed after "@" (used to open + filter the menu). */
  query: string;
  /** Index of the "@" in the text. */
  start: number;
  /** Caret index (exclusive end of the `@query` slice). */
  end: number;
}

/**
 * Detect an in-progress `@query` immediately preceding the caret. Returns null when
 * the caret is not inside a fresh single-token mention (e.g. a space already closed it,
 * or the "@" is glued to a word like an email). The query is single-token by design —
 * multi-word contact names are still selectable; the full name is inserted on select.
 */
export function activeMentionQuery(text: string, caret: number): ActiveMention | null {
  const upto = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const at = upto.lastIndexOf("@");
  if (at < 0) return null;
  // "@" must start the line or follow whitespace (avoid matching "user@host").
  const before = at > 0 ? upto[at - 1] : " ";
  if (!/\s/.test(before)) return null;
  const between = upto.slice(at + 1);
  if (/\s/.test(between)) return null; // whitespace already closed the token
  return { query: between, start: at, end: upto.length };
}

/**
 * Replace the active `@query` slice with the full canonical `@${name} ` (spaces allowed,
 * e.g. "@Mom Wallet "). Returns the new text + caret position (after the trailing space).
 */
export function applyMentionSelection(
  text: string,
  mention: { start: number; end: number },
  name: string,
): { text: string; caret: number } {
  const insert = `@${name} `;
  const next = text.slice(0, mention.start) + insert + text.slice(mention.end);
  return { text: next, caret: mention.start + insert.length };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Sentinels (char codes 0 and 1) wrapping each resolved mention, so ADJACENT mentions
// are detectable even when the contact name contains spaces ("Mom Wallet"). Built at
// runtime so no literal control bytes live in source; stripped before return.
const MENTION_OPEN = String.fromCharCode(0);
const MENTION_CLOSE = String.fromCharCode(1);

/**
 * Smart recipient capture at submit: rewrite each `@Name` matching a saved contact (longest-first,
 * so "Mom Wallet" wins over "Mom") to that contact's RESOLVED 0x ADDRESS. The recipient is captured
 * from the dropdown selection here — NOT re-parsed from rendered text downstream — so multi-word and
 * duplicate names can't be mis-read. A pasted/typed 0x or `.sui` is left as-is (a 0x flows straight
 * through; a `.sui` is resolved server/atomic-side). Unknown `@x` is left intact.
 *
 * Two mentions separated only by whitespace ("@Alice @Bob") are joined with ", " so the
 * deterministic multi-recipient parser fans the send out to every friend — the menu inserts
 * "@Name " with no connector, so adjacent mentions are the natural multi-recipient form.
 */
export function substituteMentions(text: string, contacts: MentionContact[]): string {
  let out = text;
  const sorted = [...contacts]
    .filter((c) => c.name && c.address)
    .sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) {
    // "@Name" not followed by a word char/hyphen, so "@Al" can't partial-match "@Alice".
    const re = new RegExp(`@${escapeRegExp(c.name)}(?![\\w-])`, "gi");
    out = out.replace(re, `${MENTION_OPEN}${c.address}${MENTION_CLOSE}`);
  }
  // Adjacent mentions ("@Alice @Bob") → comma so multi-recipient parsing splits them. A typed
  // connector ("@Alice and @Bob", "@Alice, @Bob") has non-space between, so it is left as-is.
  out = out.replace(new RegExp(`${MENTION_CLOSE}\\s+${MENTION_OPEN}`, "g"), ", ");
  return out.replace(new RegExp(`[${MENTION_OPEN}${MENTION_CLOSE}]`, "g"), "");
}

/**
 * Filter contacts for the menu using matchContacts precedence (exact → prefix → substring),
 * capped. An empty query (just "@") lists everyone (capped).
 */
export function filterContacts<T extends MentionContact>(contacts: T[], query: string, cap = 8): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts.slice(0, cap);
  const exact = contacts.filter((c) => c.name.toLowerCase() === q);
  const prefix = contacts.filter((c) => {
    const n = c.name.toLowerCase();
    return n !== q && n.startsWith(q);
  });
  const sub = contacts.filter((c) => {
    const n = c.name.toLowerCase();
    return !n.startsWith(q) && n.includes(q);
  });
  return [...exact, ...prefix, ...sub].slice(0, cap);
}
