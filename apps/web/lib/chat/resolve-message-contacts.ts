/**
 * resolve-message-contacts — split a sent message into plain-text + contact segments so the
 * user's message bubble can show "Name (0x1234…)" for each saved friend it mentions.
 *
 * On submit the composer rewrites @mentions to bare contact NAMES (see mention.ts), so a
 * sent "send 0.2 SUI to Alice, Bob" carries names, not addresses. This re-attaches the saved
 * address to each name occurrence (word-bounded, longest-first so "Mom Wallet" beats "Mom").
 * DISPLAY-ONLY: the Guardian still re-resolves the recipient server-side at send time.
 */

export interface MessageContact {
  name: string;
  address: string;
}

/** A run of plain text, or a resolved contact occurrence. */
export type MessageSegment = string | { name: string; address: string };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split `text` into ordered segments: plain strings interleaved with `{name,address}` for
 * each saved-contact name occurrence. Returns `[text]` unchanged when there are no contacts.
 */
export function splitMessageByContacts(text: string, contacts: MessageContact[]): MessageSegment[] {
  const names = contacts
    .filter((c) => c.name && c.address)
    .sort((a, b) => b.name.length - a.name.length);
  if (!names.length || !text) return [text];

  const pattern = names.map((c) => escapeRegExp(c.name)).join("|");
  const re = new RegExp(`\\b(${pattern})\\b`, "gi");
  const out: MessageSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const contact = names.find((c) => c.name.toLowerCase() === m![1].toLowerCase());
    out.push(contact ? { name: contact.name, address: contact.address } : m[1]);
    last = m.index + m[1].length;
    if (m.index === re.lastIndex) re.lastIndex++; // guard against any zero-length match loop
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
