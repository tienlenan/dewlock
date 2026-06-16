/**
 * Unit tests for apps/web/lib/rate-limit.ts
 *
 * Tests:
 *  - requests below the limit are allowed
 *  - the request that pushes count above max is blocked (429)
 *  - remaining counter decrements correctly
 *  - a new window resets the counter (uses fake timers)
 *  - clientIp extracts from x-forwarded-for correctly
 *  - rateLimitHeaders shapes correctly for allowed and limited results
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Re-import per test to get a fresh module store — vitest module cache is reset
// via vi.resetModules() in beforeEach.
let checkRateLimit: typeof import("../rate-limit").checkRateLimit;
let clientIp: typeof import("../rate-limit").clientIp;
let rateLimitHeaders: typeof import("../rate-limit").rateLimitHeaders;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  const mod = await import("../rate-limit");
  checkRateLimit = mod.checkRateLimit;
  clientIp = mod.clientIp;
  rateLimitHeaders = mod.rateLimitHeaders;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    for (let i = 1; i <= 5; i++) {
      const result = checkRateLimit("192.0.2.1", { max: 5, windowMs: 60_000 });
      expect(result.limited).toBe(false);
      expect(result.remaining).toBe(5 - i);
    }
  });

  it("blocks the request that exceeds max (returns limited:true)", () => {
    // Fill up to max
    for (let i = 0; i < 3; i++) {
      checkRateLimit("192.0.2.2", { max: 3, windowMs: 60_000 });
    }
    // This 4th call exceeds max=3
    const result = checkRateLimit("192.0.2.2", { max: 3, windowMs: 60_000 });
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("remaining is 0 for all subsequent requests after limit hit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("192.0.2.3", { max: 2, windowMs: 60_000 });
    }
    const result = checkRateLimit("192.0.2.3", { max: 2, windowMs: 60_000 });
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("different keys are tracked independently", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("192.0.2.4", { max: 3, windowMs: 60_000 });
    // key A is at max; key B should still be allowed
    const resultA = checkRateLimit("192.0.2.4", { max: 3, windowMs: 60_000 });
    const resultB = checkRateLimit("192.0.2.5", { max: 3, windowMs: 60_000 });
    expect(resultA.limited).toBe(true);
    expect(resultB.limited).toBe(false);
  });

  it("window resets after windowMs elapses", () => {
    // Fill to limit
    for (let i = 0; i < 3; i++) checkRateLimit("192.0.2.6", { max: 3, windowMs: 60_000 });
    let result = checkRateLimit("192.0.2.6", { max: 3, windowMs: 60_000 });
    expect(result.limited).toBe(true);

    // Advance past the window
    vi.advanceTimersByTime(61_000);

    // First request in the new window should be allowed
    result = checkRateLimit("192.0.2.6", { max: 3, windowMs: 60_000 });
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(2);
  });

  it("resetMs is positive and ≤ windowMs", () => {
    const result = checkRateLimit("192.0.2.7", { max: 10, windowMs: 60_000 });
    expect(result.resetMs).toBeGreaterThan(0);
    expect(result.resetMs).toBeLessThanOrEqual(60_000);
  });

  it("uses defaults (max=30, windowMs=60_000) when no options given", () => {
    const result = checkRateLimit("192.0.2.8");
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(29); // 30 max − 1 call
  });
});

describe("clientIp", () => {
  it("extracts first IP from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(headers)).toBe("1.2.3.4");
  });

  it("returns single IP when no comma", () => {
    const headers = new Headers({ "x-forwarded-for": "9.10.11.12" });
    expect(clientIp(headers)).toBe("9.10.11.12");
  });

  it("falls back to 'local' when header absent", () => {
    const headers = new Headers();
    expect(clientIp(headers)).toBe("local");
  });
});

describe("rateLimitHeaders", () => {
  it("includes standard headers for allowed request", () => {
    const result = { limited: false, remaining: 25, resetMs: 45_000 };
    const headers = rateLimitHeaders(result, 30);
    expect(headers["x-ratelimit-limit"]).toBe("30");
    expect(headers["x-ratelimit-remaining"]).toBe("25");
    expect(headers["x-ratelimit-reset"]).toBe("45"); // ceil(45000/1000)
    expect(headers["retry-after"]).toBeUndefined();
  });

  it("includes retry-after when request is limited", () => {
    const result = { limited: true, remaining: 0, resetMs: 30_000 };
    const headers = rateLimitHeaders(result, 30);
    expect(headers["retry-after"]).toBe("30");
    expect(headers["x-ratelimit-remaining"]).toBe("0");
  });
});
