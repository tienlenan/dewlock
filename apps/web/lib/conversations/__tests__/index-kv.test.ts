/**
 * Tests for the Upstash Redis conversation index (index-kv) against an in-memory fake
 * of the @upstash/redis client — no live Redis. Covers CRUD + sort, wallet lowercasing,
 * the monotonic-updatedAt (rollback) guard, the field/title caps, and env detection.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";

// `server-only` is a Next.js build guard, not resolvable in the vitest node env — stub it.
vi.mock("server-only", () => ({}));

// In-memory fake Redis (hoisted so the mock factory + tests share one store).
const r = vi.hoisted(() => ({ store: new Map<string, Map<string, unknown>>() }));
vi.mock("@upstash/redis", () => {
  class FakeRedis {
    constructor(_opts: unknown) {}
    private bucket(key: string) {
      let m = r.store.get(key);
      if (!m) {
        m = new Map();
        r.store.set(key, m);
      }
      return m;
    }
    async hgetall<T = unknown>(key: string): Promise<T | null> {
      const m = r.store.get(key);
      if (!m || m.size === 0) return null;
      return Object.fromEntries(m) as T;
    }
    async hget<T = unknown>(key: string, field: string): Promise<T | null> {
      return (r.store.get(key)?.get(field) ?? null) as T | null;
    }
    async hset(key: string, kv: Record<string, unknown>): Promise<number> {
      const m = this.bucket(key);
      let added = 0;
      for (const [f, v] of Object.entries(kv)) {
        if (!m.has(f)) added++;
        m.set(f, v);
      }
      return added;
    }
    async hdel(key: string, ...fields: string[]): Promise<number> {
      const m = r.store.get(key);
      let n = 0;
      if (m) for (const f of fields) if (m.delete(f)) n++;
      return n;
    }
    async hlen(key: string): Promise<number> {
      return r.store.get(key)?.size ?? 0;
    }
    async del(...keys: string[]): Promise<number> {
      let n = 0;
      for (const k of keys) if (r.store.delete(k)) n++;
      return n;
    }
  }
  return { Redis: FakeRedis };
});

import {
  kvGetIndex,
  kvUpsertEntry,
  kvDeleteEntry,
  kvClearIndex,
  isKvConfigured,
  type KvIndexEntry,
} from "../index-kv";

const WALLET = "0x" + "a".repeat(64);
const entry = (id: string, updatedAt: number, titleEnc = `enc-${id}`): KvIndexEntry => ({
  id,
  blobId: `blob-${id}`,
  titleEnc,
  createdAt: updatedAt,
  updatedAt,
});

beforeAll(() => {
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
});

beforeEach(() => {
  r.store.clear();
});

describe("index-kv — CRUD + sort", () => {
  it("upserts and lists newest-first", async () => {
    expect(await kvUpsertEntry(WALLET, entry("c1", 1000))).toEqual({ ok: true });
    expect(await kvUpsertEntry(WALLET, entry("c2", 2000))).toEqual({ ok: true });
    const list = await kvGetIndex(WALLET);
    expect(list.map((e) => e.id)).toEqual(["c2", "c1"]);
    expect(list[0]).toMatchObject({ id: "c2", blobId: "blob-c2", titleEnc: "enc-c2" });
  });

  it("replaces an existing entry in place", async () => {
    await kvUpsertEntry(WALLET, entry("c1", 1000, "old"));
    await kvUpsertEntry(WALLET, entry("c1", 1500, "new"));
    const list = await kvGetIndex(WALLET);
    expect(list).toHaveLength(1);
    expect(list[0].titleEnc).toBe("new");
  });

  it("deletes one entry and clears all", async () => {
    await kvUpsertEntry(WALLET, entry("c1", 1000));
    await kvUpsertEntry(WALLET, entry("c2", 2000));
    await kvDeleteEntry(WALLET, "c1");
    expect((await kvGetIndex(WALLET)).map((e) => e.id)).toEqual(["c2"]);
    await kvClearIndex(WALLET);
    expect(await kvGetIndex(WALLET)).toEqual([]);
  });

  it("returns [] for an unknown wallet", async () => {
    expect(await kvGetIndex(WALLET)).toEqual([]);
  });
});

describe("index-kv — keying + guards", () => {
  it("lowercases the wallet so mixed-case reads/writes hit the same hash", async () => {
    await kvUpsertEntry("0x" + "A".repeat(64), entry("c1", 1000));
    expect((await kvGetIndex("0x" + "a".repeat(64))).map((e) => e.id)).toEqual(["c1"]);
  });

  it("rejects a stale (older updatedAt) upsert — monotonic rollback guard", async () => {
    await kvUpsertEntry(WALLET, entry("c1", 2000));
    expect(await kvUpsertEntry(WALLET, entry("c1", 1000))).toEqual({ ok: false, reason: "stale" });
    // equal updatedAt is allowed (idempotent retry)
    expect(await kvUpsertEntry(WALLET, entry("c1", 2000))).toEqual({ ok: true });
  });

  it("rejects an oversized titleEnc", async () => {
    const huge = "x".repeat(9000);
    expect(await kvUpsertEntry(WALLET, entry("c1", 1000, huge))).toEqual({
      ok: false,
      reason: "title too large",
    });
  });

  it("rejects a NEW entry once the per-wallet field cap is hit", async () => {
    for (let i = 0; i < 2000; i++) {
      const res = await kvUpsertEntry(WALLET, entry(`k${i}`, 1000 + i));
      expect(res.ok).toBe(true);
    }
    expect(await kvUpsertEntry(WALLET, entry("overflow", 9999))).toEqual({
      ok: false,
      reason: "index full",
    });
    // updating an EXISTING id is still allowed at the cap
    expect(await kvUpsertEntry(WALLET, entry("k0", 5000))).toEqual({ ok: true });
  });
});

describe("index-kv — env detection", () => {
  it("detects either the UPSTASH_ or KV_REST_API_ credential pair", () => {
    const saved = { ...process.env };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.KV_REST_API_URL = "https://fake.kv";
    process.env.KV_REST_API_TOKEN = "kv-token";
    expect(isKvConfigured()).toBe(true);

    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    expect(isKvConfigured()).toBe(false);

    Object.assign(process.env, saved);
  });
});
