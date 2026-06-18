/**
 * Tests for conversation persistence: the serializer safety invariant
 * (NEVER persist signable tx bytes) and the Walrus+memwal store round-trip.
 * Walrus/memwal is fully mocked — no live services.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatMessage, ToolCard } from "@/components/chat/chat-thread";
import { serializeMessages, deserializeMessages, deriveTitle } from "../serialize";

const h = vi.hoisted(() => ({
  blobs: new Map<string, unknown>(),
  pointers: [] as string[],
  n: 0,
  enabled: true,
}));

vi.mock("@dewlock/walrus", () => ({
  isMemoryEnabled: () => h.enabled,
  memNamespace: (w: string) => `ns:${w}`,
  remember: async (_ns: string, text: string) => { h.pointers.push(text); },
  // Honor topK (the real wrapper passes limit through to the SDK) so "latest
  // pointer among the returned set" is modeled faithfully.
  recall: async (_ns: string, _q: string, topK = 8) => h.pointers.slice(-topK),
  publishJsonBlob: async (_kind: string, value: unknown) => {
    const blobId = `blob-${++h.n}`;
    h.blobs.set(blobId, value);
    return { status: "published", blobId, objectId: null, hash: "x" };
  },
  readJsonBlob: async (id: string) => h.blobs.get(id) ?? null,
}));

import {
  listConversations,
  getConversation,
  upsertConversation,
  removeConversation,
  clearConversations,
  type ConversationRecord,
} from "../conversation-store";

const WALLET = "0x" + "1".repeat(64);

beforeEach(() => {
  h.blobs.clear();
  h.pointers = [];
  h.n = 0;
  h.enabled = true;
});

describe("serializeMessages — safety invariant", () => {
  it("drops tx-preview cards (signable bytes) and keeps safe cards", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", text: "swap 10 SUI", cards: [] },
      {
        id: "a1",
        role: "assistant",
        text: "preview",
        cards: [
          { type: "tx-preview", pendingTx: { txBytes: "AAAAsignable", approvedDigest: "0xdeadbeef", preview: {} } } as unknown as ToolCard,
          { type: "block", blockReasons: ["nope"], blockGates: ["lookalike"] },
        ],
      },
    ];
    const out = serializeMessages(messages);
    const json = JSON.stringify(out);
    expect(json).not.toContain("txBytes");
    expect(json).not.toContain("AAAAsignable");
    expect(json).not.toContain("approvedDigest");
    expect(out[1].cards).toHaveLength(1);
    expect(out[1].cards[0].type).toBe("block");
    // round-trips back to chat messages (read-only history)
    expect(deserializeMessages(out)[1].cards[0].type).toBe("block");
  });

  it("derives a title from the first user message", () => {
    const messages: ChatMessage[] = [{ id: "u1", role: "user", text: "How's my portfolio?", cards: [] }];
    expect(deriveTitle(messages)).toBe("How's my portfolio?");
  });
});

describe("conversation-store — Walrus + memwal round-trip", () => {
  function record(id: string, title: string, updatedAt: number): ConversationRecord {
    return { id, walletAddress: WALLET, title, createdAt: updatedAt, updatedAt, messages: [{ id: "u", role: "user", text: title, cards: [] }] };
  }

  it("upserts, lists (newest first), reads, and removes", async () => {
    expect(await upsertConversation(record("c1", "First", 1000))).toMatchObject({ ok: true });
    expect(await upsertConversation(record("c2", "Second", 2000))).toMatchObject({ ok: true });

    const list = await listConversations(WALLET);
    expect(list.map((c) => c.id)).toEqual(["c2", "c1"]); // newest first

    const got = await getConversation(WALLET, "c1");
    expect(got?.title).toBe("First");

    expect(await removeConversation(WALLET, "c1")).toBe(true);
    expect((await listConversations(WALLET)).map((c) => c.id)).toEqual(["c2"]);
  });

  it("fail-soft when memory is disabled", async () => {
    h.enabled = false;
    expect(await listConversations(WALLET)).toEqual([]);
    expect(await getConversation(WALLET, "c1")).toBeNull();
    expect(await upsertConversation(record("c1", "x", 1))).toMatchObject({ ok: false });
  });

  it("clearConversations empties the list — a clear tombstone wins over the index", async () => {
    await upsertConversation(record("c1", "First", 1000));
    await upsertConversation(record("c2", "Second", 2000));
    expect((await listConversations(WALLET)).length).toBe(2);

    expect(await clearConversations(WALLET)).toBe(true);
    expect(await listConversations(WALLET)).toEqual([]);
  });

  it("a genuine save after a clear reappears (out-dates the tombstone)", async () => {
    await upsertConversation(record("c1", "First", 1000));
    await clearConversations(WALLET);
    expect(await listConversations(WALLET)).toEqual([]);

    // saveCurrent stamps record.updatedAt with the save time — after the clear.
    await upsertConversation(record("c3", "After clear", Date.now() + 60_000));
    expect((await listConversations(WALLET)).map((c) => c.id)).toEqual(["c3"]);
  });
});
