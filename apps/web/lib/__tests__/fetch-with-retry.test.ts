/**
 * Tests for fetchJsonWithRetry — the auto-retry wrapper used by self-fetching cards
 * whose backend has a cold path. Mocks global.fetch; uses tiny backoff for speed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchJsonWithRetry } from "../fetch-with-retry";

const ok = (data: unknown) => ({ ok: true, json: async () => data }) as unknown as Response;
const httpErr = (status: number) => ({ ok: false, status }) as unknown as Response;

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchJsonWithRetry", () => {
  it("returns JSON on first success (no retry)", async () => {
    const f = vi.fn(async () => ok({ a: 1 }));
    global.fetch = f as unknown as typeof fetch;
    const res = await fetchJsonWithRetry<{ a: number }>("/x", { backoffMs: 1 });
    expect(res).toEqual({ a: 1 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure then succeeds within the attempt budget", async () => {
    let n = 0;
    const f = vi.fn(async () => {
      n++;
      if (n < 3) throw new DOMException("The operation was aborted", "AbortError");
      return ok({ ok: true });
    });
    global.fetch = f as unknown as typeof fetch;
    const res = await fetchJsonWithRetry<{ ok: boolean }>("/x", { attempts: 3, backoffMs: 1 });
    expect(res).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("retries on an HTTP non-ok response", async () => {
    let n = 0;
    const f = vi.fn(async () => {
      n++;
      return n < 2 ? httpErr(500) : ok({ done: true });
    });
    global.fetch = f as unknown as typeof fetch;
    const res = await fetchJsonWithRetry<{ done: boolean }>("/x", { attempts: 3, backoffMs: 1 });
    expect(res).toEqual({ done: true });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all attempts", async () => {
    const f = vi.fn(async () => {
      throw new DOMException("The operation was aborted", "AbortError");
    });
    global.fetch = f as unknown as typeof fetch;
    await expect(fetchJsonWithRetry("/x", { attempts: 3, backoffMs: 1 })).rejects.toBeDefined();
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("stops immediately when the caller signal is already aborted (no fetch)", async () => {
    const f = vi.fn(async () => ok({ a: 1 }));
    global.fetch = f as unknown as typeof fetch;
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      fetchJsonWithRetry("/x", { attempts: 3, backoffMs: 1, signal: ctrl.signal }),
    ).rejects.toBeDefined();
    expect(f).not.toHaveBeenCalled();
  });

  it("does not retry past the cap (attempts=2 → exactly 2 calls)", async () => {
    const f = vi.fn(async () => httpErr(503));
    global.fetch = f as unknown as typeof fetch;
    await expect(fetchJsonWithRetry("/x", { attempts: 2, backoffMs: 1 })).rejects.toBeDefined();
    expect(f).toHaveBeenCalledTimes(2);
  });
});
