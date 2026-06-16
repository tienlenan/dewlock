/**
 * Tests: conviction-streak cap memory module.
 *
 * Pure functions (parseCapFromMemory, formatCapBlockWithRecall) are tested directly.
 * The async rememberCommittedCap/recallCommittedCap functions use injected MemwalIO
 * — no live memwal relayer needed; tests pass mock IO objects directly.
 *
 * Coverage:
 *  - parseCapFromMemory: happy path + malformed inputs
 *  - formatCapBlockWithRecall: correct message shape for tx_cap and daily_cap
 *  - rememberCommittedCap: calls io.remember with correct formatted string
 *  - recallCommittedCap: parses recalled text; null on empty/parse-fail/throw
 *  - round-trip: written entry is parseable by parseCapFromMemory
 */

import { describe, it, expect, vi } from "vitest";
import {
  parseCapFromMemory,
  formatCapBlockWithRecall,
  rememberCommittedCap,
  recallCommittedCap,
  type MemwalIO,
} from "../memory/conviction-streak";

// Build a mock MemwalIO — no @dewlock/walrus needed.
function makeIO(recallResults: string[] = []): { io: MemwalIO; remember: ReturnType<typeof vi.fn>; recall: ReturnType<typeof vi.fn> } {
  const remember = vi.fn<(ns: string, text: string) => Promise<void>>().mockResolvedValue(undefined);
  const recall = vi.fn<(ns: string, query: string, topK?: number) => Promise<string[]>>().mockResolvedValue(recallResults);
  return { io: { remember, recall }, remember, recall };
}

describe("parseCapFromMemory — pure parser", () => {
  it("parses a well-formed cap entry (integer caps)", () => {
    const result = parseCapFromMemory("risk cap: $5/tx, $20/day; risk profile: conservative");
    expect(result).toEqual({ txUsd: 5, dailyUsd: 20, riskProfile: "conservative" });
  });

  it("parses a cap entry with decimal amounts", () => {
    const result = parseCapFromMemory("risk cap: $5.50/tx, $50.00/day; risk profile: moderate");
    expect(result).toEqual({ txUsd: 5.5, dailyUsd: 50, riskProfile: "moderate" });
  });

  it("returns null when tx cap is missing", () => {
    expect(parseCapFromMemory("risk profile: conservative")).toBeNull();
  });

  it("returns null when daily cap is missing", () => {
    expect(parseCapFromMemory("risk cap: $5/tx; risk profile: conservative")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseCapFromMemory("")).toBeNull();
  });

  it("returns null for completely unrelated text", () => {
    expect(parseCapFromMemory("contact: alice = 0xabc")).toBeNull();
  });

  it("case-insensitive match for RISK CAP", () => {
    const result = parseCapFromMemory("RISK CAP: $10/TX, $100/DAY; RISK PROFILE: aggressive");
    expect(result).not.toBeNull();
    expect(result?.txUsd).toBe(10);
    expect(result?.dailyUsd).toBe(100);
    expect(result?.riskProfile).toBe("aggressive");
  });

  it("defaults riskProfile to 'unknown' when profile label absent", () => {
    const result = parseCapFromMemory("risk cap: $5/tx, $20/day");
    expect(result).not.toBeNull();
    expect(result?.riskProfile).toBe("unknown");
  });
});

describe("formatCapBlockWithRecall — block reason formatter", () => {
  const cap = { txUsd: 5, dailyUsd: 20, riskProfile: "conservative" };

  it("tx_cap block includes the per-tx cap and amount", () => {
    const msg = formatCapBlockWithRecall(40, cap, "tx_cap");
    expect(msg).toContain("$5/tx");
    expect(msg).toContain("$40.00");
    expect(msg).toContain("conservative");
    expect(msg).toContain("frozen");
  });

  it("daily_cap block includes the daily cap and amount", () => {
    const msg = formatCapBlockWithRecall(25, cap, "daily_cap");
    expect(msg).toContain("$20/day");
    expect(msg).toContain("$25.00");
    expect(msg).toContain("conservative");
  });

  it("message frames this as a user-set rule", () => {
    const msg = formatCapBlockWithRecall(100, cap, "tx_cap");
    expect(msg.toLowerCase()).toContain("you set");
  });
});

describe("recallCommittedCap — injected IO", () => {
  it("returns the parsed cap when recall returns a matching entry", async () => {
    const { io, recall } = makeIO(["risk cap: $5/tx, $20/day; risk profile: conservative"]);
    const result = await recallCommittedCap(io, "dewlock:0xabc");
    expect(result).toEqual({ txUsd: 5, dailyUsd: 20, riskProfile: "conservative" });
    expect(recall).toHaveBeenCalledWith("dewlock:0xabc", "risk cap", 1);
  });

  it("returns null when recall returns empty array", async () => {
    const { io } = makeIO([]);
    expect(await recallCommittedCap(io, "dewlock:0xabc")).toBeNull();
  });

  it("returns null when recalled text doesn't parse", async () => {
    const { io } = makeIO(["some unrelated memory text"]);
    expect(await recallCommittedCap(io, "dewlock:0xabc")).toBeNull();
  });

  it("returns null (non-fatal) when recall throws", async () => {
    const io: MemwalIO = {
      remember: vi.fn(),
      recall: vi.fn().mockRejectedValue(new Error("relayer unreachable")),
    };
    expect(await recallCommittedCap(io, "dewlock:0xabc")).toBeNull();
  });
});

describe("rememberCommittedCap — injected IO", () => {
  it("calls io.remember with the correct formatted string", async () => {
    const { io, remember } = makeIO();
    await rememberCommittedCap(io, "dewlock:0xabc", 5, 20, "conservative");
    expect(remember).toHaveBeenCalledOnce();
    const [ns, text] = remember.mock.calls[0];
    expect(ns).toBe("dewlock:0xabc");
    expect(text).toBe("risk cap: $5/tx, $20/day; risk profile: conservative");
  });

  it("round-trip: written text is parseable by parseCapFromMemory", async () => {
    const { io, remember } = makeIO();
    await rememberCommittedCap(io, "dewlock:0xabc", 10, 50, "moderate");
    const written = remember.mock.calls[0][1] as string;
    const parsed = parseCapFromMemory(written);
    expect(parsed).toEqual({ txUsd: 10, dailyUsd: 50, riskProfile: "moderate" });
  });
});
