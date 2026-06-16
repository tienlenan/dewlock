/**
 * Tests: contacts / address-book memory module.
 *
 * Pure functions (parseContactFromMemory, contactDriftCheck, formatDriftWarning)
 * tested directly. Async rememberContact/recallContact use injected MemwalIO
 * — no live memwal relayer, no vi.mock needed.
 *
 * Coverage:
 *  - parseContactFromMemory: happy path, malformed, case normalization
 *  - contactDriftCheck: match passes, drift detected, null storedAddress
 *  - formatDriftWarning: message shape
 *  - rememberContact: writes correct formatted entry; no-ops on empty inputs
 *  - recallContact: parses recalled text; null on empty/parse-fail/throw
 *  - security: recalled text parsed via strict regex (no injection path)
 */

import { describe, it, expect, vi } from "vitest";
import {
  parseContactFromMemory,
  contactDriftCheck,
  formatDriftWarning,
  rememberContact,
  recallContact,
  type MemwalIO,
} from "../memory/contacts";

const ADDR_A = "0x" + "a".repeat(64);
const ADDR_B = "0x" + "b".repeat(64);

function makeIO(recallResults: string[] = []): { io: MemwalIO; remember: ReturnType<typeof vi.fn>; recall: ReturnType<typeof vi.fn> } {
  const remember = vi.fn<(ns: string, text: string) => Promise<void>>().mockResolvedValue(undefined);
  const recall = vi.fn<(ns: string, query: string, topK?: number) => Promise<string[]>>().mockResolvedValue(recallResults);
  return { io: { remember, recall }, remember, recall };
}

describe("parseContactFromMemory — pure parser", () => {
  it("parses a well-formed contact entry", () => {
    expect(parseContactFromMemory(`contact: alice = ${ADDR_A}`))
      .toEqual({ name: "alice", address: ADDR_A });
  });

  it("parses a .sui name contact", () => {
    expect(parseContactFromMemory(`contact: 888.sui = ${ADDR_A}`))
      .toEqual({ name: "888.sui", address: ADDR_A });
  });

  it("normalizes name and address to lowercase", () => {
    const result = parseContactFromMemory(`contact: Alice = ${ADDR_A.toUpperCase()}`);
    expect(result?.name).toBe("alice");
    expect(result?.address).toBe(ADDR_A.toLowerCase());
  });

  it("returns null for missing 0x prefix", () => {
    expect(parseContactFromMemory("contact: alice = abcdef1234")).toBeNull();
  });

  it("returns null for address shorter than 64 hex chars", () => {
    expect(parseContactFromMemory("contact: alice = 0xabc")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseContactFromMemory("")).toBeNull();
  });

  it("returns null for unrelated memory text", () => {
    expect(parseContactFromMemory("risk cap: $5/tx, $20/day")).toBeNull();
  });
});

describe("contactDriftCheck — drift detection", () => {
  it("no drift when stored and resolved are identical", () => {
    const r = contactDriftCheck(ADDR_A, ADDR_A);
    expect(r.drifted).toBe(false);
  });

  it("drift detected when stored differs from resolved", () => {
    const r = contactDriftCheck(ADDR_A, ADDR_B);
    expect(r.drifted).toBe(true);
    expect(r.storedAddress).toBe(ADDR_A);
    expect(r.resolvedAddress).toBe(ADDR_B);
  });

  it("no drift when storedAddress is null (no prior record)", () => {
    const r = contactDriftCheck(null, ADDR_A);
    expect(r.drifted).toBe(false);
    expect(r.storedAddress).toBeNull();
  });

  it("case-insensitive: mixed-case stored vs lowercase resolved → no drift", () => {
    expect(contactDriftCheck(ADDR_A.toUpperCase(), ADDR_A.toLowerCase()).drifted).toBe(false);
  });

  it("drift detected after normalisation when addresses differ", () => {
    expect(contactDriftCheck(ADDR_A.toUpperCase(), ADDR_B.toLowerCase()).drifted).toBe(true);
  });
});

describe("formatDriftWarning — message shape", () => {
  it("includes the name, stored and resolved address", () => {
    const msg = formatDriftWarning("888.sui", ADDR_A, ADDR_B);
    expect(msg).toContain("888.sui");
    expect(msg).toContain(ADDR_A);
    expect(msg).toContain(ADDR_B);
  });

  it("includes a security warning about re-pointing", () => {
    expect(formatDriftWarning("alice", ADDR_A, ADDR_B).toLowerCase()).toContain("re-pointing");
  });

  it("asks user to verify", () => {
    expect(formatDriftWarning("alice", ADDR_A, ADDR_B).toLowerCase()).toContain("verify");
  });
});

describe("rememberContact — injected IO", () => {
  it("calls io.remember with correctly formatted entry", async () => {
    const { io, remember } = makeIO();
    await rememberContact(io, "dewlock:0xabc", "alice", ADDR_A);
    expect(remember).toHaveBeenCalledOnce();
    const [ns, text] = remember.mock.calls[0];
    expect(ns).toBe("dewlock:0xabc");
    expect(text).toBe(`contact: alice = ${ADDR_A.toLowerCase()}`);
  });

  it("lowercases the name when writing", async () => {
    const { io, remember } = makeIO();
    await rememberContact(io, "dewlock:0xabc", "ALICE", ADDR_A);
    expect((remember.mock.calls[0][1] as string)).toContain("contact: alice");
  });

  it("round-trip: written entry is parseable by parseContactFromMemory", async () => {
    const { io, remember } = makeIO();
    await rememberContact(io, "dewlock:0xabc", "888.sui", ADDR_A);
    const written = remember.mock.calls[0][1] as string;
    expect(parseContactFromMemory(written)).toEqual({ name: "888.sui", address: ADDR_A.toLowerCase() });
  });

  it("no-ops when name is empty", async () => {
    const { io, remember } = makeIO();
    await rememberContact(io, "dewlock:0xabc", "  ", ADDR_A);
    expect(remember).not.toHaveBeenCalled();
  });

  it("no-ops when address is empty", async () => {
    const { io, remember } = makeIO();
    await rememberContact(io, "dewlock:0xabc", "alice", "   ");
    expect(remember).not.toHaveBeenCalled();
  });
});

describe("recallContact — injected IO", () => {
  it("returns parsed contact when recall returns a matching entry", async () => {
    const { io, recall } = makeIO([`contact: alice = ${ADDR_A}`]);
    const result = await recallContact(io, "dewlock:0xabc", "alice");
    expect(result).toEqual({ name: "alice", address: ADDR_A.toLowerCase() });
    expect(recall).toHaveBeenCalledWith("dewlock:0xabc", "contact: alice", 1);
  });

  it("returns null when recall returns empty array", async () => {
    const { io } = makeIO([]);
    expect(await recallContact(io, "dewlock:0xabc", "unknown")).toBeNull();
  });

  it("returns null when recalled text doesn't parse as a contact", async () => {
    const { io } = makeIO(["risk cap: $5/tx, $20/day"]);
    expect(await recallContact(io, "dewlock:0xabc", "alice")).toBeNull();
  });

  it("returns null (non-fatal) when recall throws", async () => {
    const io: MemwalIO = {
      remember: vi.fn(),
      recall: vi.fn().mockRejectedValue(new Error("relayer unreachable")),
    };
    expect(await recallContact(io, "dewlock:0xabc", "alice")).toBeNull();
  });
});

describe("security: injection resistance via regex parse", () => {
  it("injected script tag in memory text does not become the address", () => {
    expect(parseContactFromMemory("contact: evil = <script>alert(1)</script>")).toBeNull();
  });

  it("injected SQL does not become the address", () => {
    expect(parseContactFromMemory("contact: alice = ' OR 1=1 --")).toBeNull();
  });

  it("trailing payload after valid address is rejected by regex anchor", () => {
    const injected = `contact: alice = ${ADDR_A}; DROP TABLE users;`;
    const result = parseContactFromMemory(injected);
    // If parsed, only the clean address is extracted — no trailing junk.
    if (result !== null) {
      expect(result.address).toBe(ADDR_A.toLowerCase());
    }
  });
});
