/**
 * remember() must be BOUNDED + FAIL-SOFT: a slow or failing memwal relayer can never hang
 * the serverless write path (which surfaced as the "save to memwal" error on a fresh wallet)
 * nor throw into the caller. The Walrus blob is the authoritative store; the memwal pointer
 * is best-effort. These tests lock both properties.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Control the memwal SDK's rememberAndWait timing/rejection.
const rememberAndWait = vi.fn();
vi.mock("@mysten-incubation/memwal", () => ({
  MemWal: { create: () => ({ rememberAndWait }) },
}));

import { remember } from "../memory";

describe("memwal remember() — bounded + fail-soft", () => {
  beforeEach(() => {
    vi.stubEnv("MEMWAL_ACCOUNT_ID", "test-acct");
    vi.stubEnv("MEMWAL_DELEGATE_KEY", "test-key");
    rememberAndWait.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resolves (never throws) when the relayer rejects", async () => {
    rememberAndWait.mockRejectedValue(new Error("relayer 500"));
    await expect(remember("dewlock:0xreject", "hello")).resolves.toBeUndefined();
  });

  it("returns within the wait bound when the relayer hangs (never blocks the caller)", async () => {
    vi.useFakeTimers();
    rememberAndWait.mockReturnValue(new Promise<void>(() => {})); // never resolves
    let settled = false;
    const p = remember("dewlock:0xhang", "hello").then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(12_000);
    await p;
    expect(settled).toBe(true);
  });

  it("no-ops (no SDK call) when memory is not configured", async () => {
    vi.stubEnv("MEMWAL_ACCOUNT_ID", "");
    vi.stubEnv("MEMWAL_DELEGATE_KEY", "");
    await remember("dewlock:0xoff", "hello");
    expect(rememberAndWait).not.toHaveBeenCalled();
  });

  it("trips a circuit-breaker on a 429 and pauses further writes until the window passes", async () => {
    vi.useFakeTimers();
    // First write hits the relayer rate limit → trips the breaker.
    rememberAndWait.mockRejectedValueOnce(
      new Error('Walrus Memory server error (429): {"error":"Rate limit exceeded","retry_after_seconds":60}'),
    );
    await remember("dewlock:0x429", "first");
    expect(rememberAndWait).toHaveBeenCalledTimes(1);

    // During the cooldown, further writes are immediate no-ops — the relayer is NOT hit again
    // (this is the fix: no more hammering the rate-limited key + no log spam).
    rememberAndWait.mockResolvedValue(undefined);
    await remember("dewlock:0x429", "during-cooldown");
    expect(rememberAndWait).toHaveBeenCalledTimes(1); // still 1 — skipped while cooling down

    // After the retry window elapses, writes resume.
    await vi.advanceTimersByTimeAsync(61_000);
    await remember("dewlock:0x429", "after-cooldown");
    expect(rememberAndWait).toHaveBeenCalledTimes(2);
  });
});
