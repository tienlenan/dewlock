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
});
