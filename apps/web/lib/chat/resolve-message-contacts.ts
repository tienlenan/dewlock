/**
 * resolve-message-contacts — split a sent message into plain-text + contact segments so the
 * user's message bubble can show "Name (0x1234…)" for each saved friend it mentions.
 *
 * On submit the composer rewrites @mentions to each contact's resolved 0x ADDRESS (see
 * mention.ts), so a sent "send 0.2 SUI to 0xabc, 0xdef" carries addresses. This matches each
 * occurrence by ADDRESS or by typed NAME (word-bounded, longest-first so "Mom Wallet" beats
 * "Mom") and renders the friendly "Name (0x1234…)". A pasted bare 0x with no saved contact
 * stays plain text. DISPLAY-ONLY: the Guardian still re-resolves the recipient at send time.
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
  const valid = contacts.filter((c) => c.name && c.address);
  if (!valid.length || !text) return [text];

  // A sent message now carries each mention's resolved 0x ADDRESS (substituteMentions), so match
  // both the address AND the name (for typed bare names). Longest token first so a full 0x address
  // and multi-word names win over shorter substrings. Either way we render the friendly name.
  const tokens = valid
    .flatMap((c) => [
      { pat: c.address, contact: c },
      { pat: c.name, contact: c },
    ])
    .sort((a, b) => b.pat.length - a.pat.length);
  const pattern = tokens.map((t) => escapeRegExp(t.pat)).join("|");
  const re = new RegExp(`\\b(${pattern})\\b`, "gi");

  const out: MessageSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const matched = m[1].toLowerCase();
    const contact = valid.find(
      (c) => c.address.toLowerCase() === matched || c.name.toLowerCase() === matched,
    );
    out.push(contact ? { name: contact.name, address: contact.address } : m[1]);
    last = m.index + m[1].length;
    if (m.index === re.lastIndex) re.lastIndex++; // guard against any zero-length match loop
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
