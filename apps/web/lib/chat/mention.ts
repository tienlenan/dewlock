/**
 * mention — pure helpers for the @mention friends menu in the chat composer.
 *
 * The composer stays a plain <input>; we track the caret to know when an `@query`
 * is being typed (open + filter the menu), insert the FULL canonical `@Name` on
 * select, and on submit rewrite each `@Name` back to the bare contact name so the
 * existing deterministic resolver (matchContacts → unique name → 1 match) handles
 * the send. DISPLAY/INPUT convenience only — no security weight.
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

/**
 * Rewrite each `@Name` whose Name matches a known contact (longest-first, so "Mom Wallet"
 * wins over "Mom") to the bare contact name. Unknown `@x` tokens are left intact. The bare
 * name then flows through the existing deterministic contact resolver on the server.
 */
export function substituteMentions(text: string, contactNames: string[]): string {
  let out = text;
  const names = [...contactNames].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const name of names) {
    // "@Name" not followed by a word char/hyphen, so "@Al" can't partial-match "@Alice".
    const re = new RegExp(`@${escapeRegExp(name)}(?![\\w-])`, "gi");
    out = out.replace(re, name);
  }
  return out;
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
