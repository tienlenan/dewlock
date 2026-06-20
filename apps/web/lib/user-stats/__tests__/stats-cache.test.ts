/**
 * Tests for the user-stats Redis cache against an in-memory fake of @upstash/redis.
 * Covers read/write (with TTL) / invalidate round-trips, miss → null, and the
 * fail-soft no-op when Redis isn't configured.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";

// `server-only` is a Next.js build guard, not resolvable in the vitest node env — stub it.
vi.mock("server-only", () => ({}));

// In-memory fake Redis (hoisted so the mock factory + tests share one store).
const r = vi.hoisted(() => ({ store: new Map<string, unknown>(), lastSetOpts: null as unknown }));
vi.mock("@upstash/redis", () => {
  class FakeRedis {
    constructor(_opts: unknown) {}
    async get<T = unknown>(key: string): Promise<T | null> {
      return (r.store.has(key) ? (r.store.get(key) as T) : null);
    }
    async set(key: string, value: unknown, opts?: unknown): Promise<string> {
      r.store.set(key, value);
      r.lastSetOpts = opts;
      return "OK";
    }
    async del(...keys: string[]): Promise<number> {
      let n = 0;
      for (const k of keys) if (r.store.delete(k)) n++;
      return n;
    }
  }
  return { Redis: FakeRedis };
});

import { readStatsCache, writeStatsCache, invalidateStatsCache } from "../stats-cache";

const WALLET = "0x" + "9".repeat(64);

beforeAll(() => {
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
});

beforeEach(() => {
  r.store.clear();
  r.lastSetOpts = null;
});

describe("stats-cache", () => {
  it("returns null on a miss", async () => {
    expect(await readStatsCache(WALLET)).toBeNull();
  });

  it("write → read round-trips and lowercases the wallet key", async () => {
    const payload = { level: { level: 3 }, stats: { txCount: 5 } };
    await writeStatsCache("0x" + "A".repeat(64), payload);
    expect(await readStatsCache("0x" + "a".repeat(64))).toEqual(payload);
  });

  it("writes with a TTL", async () => {
    await writeStatsCache(WALLET, { level: 1 });
    expect(r.lastSetOpts).toMatchObject({ ex: expect.any(Number) });
  });

  it("invalidate drops the cached value", async () => {
    await writeStatsCache(WALLET, { level: 2 });
    expect(await readStatsCache(WALLET)).not.toBeNull();
    await invalidateStatsCache(WALLET);
    expect(await readStatsCache(WALLET)).toBeNull();
  });
});

describe("stats-cache — fail-soft when Redis unconfigured", () => {
  it("read returns null and write/invalidate no-op without throwing", async () => {
    const saved = { ...process.env };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    await expect(writeStatsCache(WALLET, { level: 9 })).resolves.toBeUndefined();
    await expect(readStatsCache(WALLET)).resolves.toBeNull();
    await expect(invalidateStatsCache(WALLET)).resolves.toBeUndefined();

    Object.assign(process.env, saved);
  });
});
