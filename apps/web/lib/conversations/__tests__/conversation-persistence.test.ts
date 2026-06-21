/**
 * Tests for conversation persistence: the serializer safety invariant (NEVER persist
 * signable tx bytes) and the conversation-store orchestration over a Walrus content
 * blob + a Redis index. The index (index-kv) and Walrus are mocked — no live services.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatMessage, ToolCard } from "@/components/chat/chat-thread";
import { serializeMessages, deserializeMessages, deriveTitle } from "../serialize";

// --- Walrus content blob (publish/read only — no memwal on the conversation path) ---
const h = vi.hoisted(() => ({ blobs: new Map<string, unknown>(), n: 0 }));
vi.mock("@dewlock/walrus", () => ({
  publishJsonBlob: async (_kind: string, value: unknown) => {
    const blobId = `blob-${++h.n}`;
    h.blobs.set(blobId, value);
    return { status: "published", blobId, objectId: null, hash: "x" };
  },
  readJsonBlob: async (id: string) => h.blobs.get(id) ?? null,
}));

// --- In-memory fake of the Redis index (index-kv) ---
type StoredVal = { blobId: string; titleEnc: string; createdAt: number; updatedAt: number };
const kv = vi.hoisted(() => ({
  store: new Map<string, Map<string, StoredVal>>(),
  configured: true,
  throwOnUpsert: false, // simulate a Redis write failure (network/credentials)
}));
vi.mock("../index-kv", () => ({
  isKvConfigured: () => kv.configured,
  kvGetIndex: async (wallet: string) => {
    const m = kv.store.get(wallet.toLowerCase());
    if (!m) return [];
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
  kvUpsertEntry: async (wallet: string, entry: { id: string } & StoredVal) => {
    if (kv.throwOnUpsert) throw new Error("redis down");
    const key = wallet.toLowerCase();
    let m = kv.store.get(key);
    if (!m) {
      m = new Map();
      kv.store.set(key, m);
    }
    const cur = m.get(entry.id);
    if (cur && entry.updatedAt < cur.updatedAt) return { ok: false, reason: "stale" };
    const { id, ...v } = entry;
    m.set(id, v);
    return { ok: true };
  },
  kvDeleteEntry: async (wallet: string, id: string) => {
    kv.store.get(wallet.toLowerCase())?.delete(id);
  },
  kvClearIndex: async (wallet: string) => {
    kv.store.delete(wallet.toLowerCase());
  },
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
  h.n = 0;
  kv.store.clear();
  kv.configured = true;
  kv.throwOnUpsert = false;
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
    expect(deserializeMessages(out)[1].cards[0].type).toBe("block");
  });

  it("converts a tx-preview WITH a rebuild command into a non-signable tx-rebuild card", () => {
    const cmd = "swap 1 SUI to USDC via Aftermath Router [[swap:in=0x2::sui::SUI|out=0xusdc::usdc::USDC|src=aftermath]]";
    const messages: ChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        text: "prepared",
        cards: [
          { type: "tx-preview", rebuildCommand: cmd, pendingTx: { txBytes: "AAAAsignable", approvedDigest: "0xdeadbeef", preview: {} } } as unknown as ToolCard,
        ],
      },
    ];
    const out = serializeMessages(messages);
    const json = JSON.stringify(out);
    // Still NO signable material persisted.
    expect(json).not.toContain("txBytes");
    expect(json).not.toContain("AAAAsignable");
    expect(json).not.toContain("approvedDigest");
    // But a re-issuable command (intent params) + a clean label survive.
    expect(out[0].cards).toHaveLength(1);
    const card = out[0].cards[0] as unknown as { type: string; command: string; label: string };
    expect(card.type).toBe("tx-rebuild");
    expect(card.command).toContain("src=aftermath");
    expect(card.label).toBe("swap 1 SUI to USDC via Aftermath Router"); // marker stripped
    expect(deserializeMessages(out)[0].cards[0].type).toBe("tx-rebuild");
  });

  it("derives a title from the first user message", () => {
    const messages: ChatMessage[] = [{ id: "u1", role: "user", text: "How's my portfolio?", cards: [] }];
    expect(deriveTitle(messages)).toBe("How's my portfolio?");
  });
});

describe("conversation-store — Redis index + Walrus blob", () => {
  function record(id: string, updatedAt: number): ConversationRecord {
    return {
      id,
      walletAddress: WALLET,
      createdAt: updatedAt,
      updatedAt,
      messages: [{ id: "u", role: "user", text: id, cards: [] }],
    };
  }

  it("upserts, lists (newest first), reads, and removes", async () => {
    expect(await upsertConversation(record("c1", 1000), "enc-c1")).toMatchObject({ ok: true });
    expect(await upsertConversation(record("c2", 2000), "enc-c2")).toMatchObject({ ok: true });

    const list = await listConversations(WALLET);
    expect(list.map((c) => c.id)).toEqual(["c2", "c1"]); // newest first
    expect(list[0].titleEnc).toBe("enc-c2"); // index stores ciphertext title

    const got = await getConversation(WALLET, "c1");
    expect(got?.id).toBe("c1");

    expect(await removeConversation(WALLET, "c1")).toBe(true);
    expect((await listConversations(WALLET)).map((c) => c.id)).toEqual(["c2"]);
  });

  it("never writes a plaintext title onto the content blob (server stays title-blind)", async () => {
    await upsertConversation(record("c1", 1000), "enc-secret-title");
    const blob = [...h.blobs.values()][0] as Record<string, unknown>;
    expect(blob.title).toBeUndefined();
    expect(blob.titleEnc).toBeUndefined();
    expect(JSON.stringify(blob)).not.toContain("enc-secret-title");
  });

  it("report-after-HSET: a failed index write returns ok:false (no false 'saved')", async () => {
    kv.throwOnUpsert = true;
    const res = await upsertConversation(record("c1", 1000), "enc-c1");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("index");
    expect(res.blobId).toBeTruthy(); // blob published, but NOT reported as saved
    expect(await listConversations(WALLET)).toEqual([]);
  });

  it("rejects a stale (non-monotonic) upsert via the index guard", async () => {
    await upsertConversation(record("c1", 2000), "enc-new");
    const res = await upsertConversation(record("c1", 1000), "enc-old"); // older stamp
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("stale");
  });

  it("fail-soft when Redis is unconfigured", async () => {
    kv.configured = false;
    expect(await listConversations(WALLET)).toEqual([]);
    expect(await getConversation(WALLET, "c1")).toBeNull();
    expect(await upsertConversation(record("c1", 1), "enc")).toMatchObject({ ok: false, reason: "unconfigured" });
  });

  it("clearConversations empties the list (one atomic DEL)", async () => {
    await upsertConversation(record("c1", 1000), "enc-c1");
    await upsertConversation(record("c2", 2000), "enc-c2");
    expect((await listConversations(WALLET)).length).toBe(2);

    expect(await clearConversations(WALLET)).toBe(true);
    expect(await listConversations(WALLET)).toEqual([]);
  });

  it("a deleted conversation does not resurrect (Redis is authoritative)", async () => {
    await upsertConversation(record("c1", 1000), "enc-c1");
    await upsertConversation(record("c2", 2000), "enc-c2");
    expect(await removeConversation(WALLET, "c1")).toBe(true);
    expect((await listConversations(WALLET)).map((c) => c.id)).toEqual(["c2"]);

    // A later genuine re-save with a newer stamp brings it back (normal upsert).
    await upsertConversation(record("c1", 3000), "enc-c1b");
    expect((await listConversations(WALLET)).map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});
