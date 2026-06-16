/**
 * Tests: receipt builder + Walrus blob degrade path.
 *
 * Covered:
 *  1. buildAndPublishReceipt constructs the canonical payload shape.
 *  2. When publishJsonBlob returns not_configured, the result status is not_configured
 *     (blob-only degrade — never throws).
 *  3. Receipt payload is content-addressed: same inputs → same hash.
 *  4. verdict "blocked" receipts carry blockReasons/blockGates, txDigest null.
 *  5. schemaVersion is always 1.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock publishJsonBlob so tests never reach Walrus network
// ---------------------------------------------------------------------------

vi.mock("../blob.js", () => ({
  publishJsonBlob: vi.fn(),
  contentHash: (value: unknown) => {
    // Deterministic stub — real implementation uses sha256; here we stringify.
    return `hash:${JSON.stringify(value).slice(0, 32)}`;
  },
}));

import { buildAndPublishReceipt } from "../receipt.js";
import { publishJsonBlob } from "../blob.js";

const mockPublish = vi.mocked(publishJsonBlob);

describe("buildAndPublishReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: approved receipt payload shape ──────────────────────────────

  it("constructs canonical approved receipt payload", async () => {
    mockPublish.mockResolvedValueOnce({
      status: "published",
      blobId: "blob-abc123",
      objectId: "obj-xyz",
      hash: "deadbeef",
    });

    const result = await buildAndPublishReceipt({
      txDigest: "DwmfkQ9bX1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
      approvedDigest: "sha256-approved-digest",
      action: "transfer",
      args: { coinTypeIn: "0x2::sui::SUI", amountInNative: "1000000000" },
      dryRunEffects: [{ coinType: "0x2::sui::SUI", amount: "-1000000000" }],
      verdict: "approved",
    });

    expect(result.blob.status).toBe("published");
    expect(result.blob.blobId).toBe("blob-abc123");
    expect(result.receipt.verdict).toBe("approved");
    expect(result.receipt.schemaVersion).toBe(1);
    expect(result.receipt.txDigest).toBe("DwmfkQ9bX1aBcDeFgHiJkLmNoPqRsTuVwXyZ");
    expect(result.receipt.blockReasons).toEqual([]);
    expect(result.receipt.blockGates).toEqual([]);
    expect(result.receipt.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO-8601
  });

  // ── Test 2: blob-only degrade (not_configured) ──────────────────────────

  it("returns not_configured status without throwing when Walrus is unconfigured", async () => {
    mockPublish.mockResolvedValueOnce({
      status: "not_configured",
      blobId: null,
      objectId: null,
      hash: "deadbeef",
    });

    const result = await buildAndPublishReceipt({
      txDigest: "abc123",
      approvedDigest: null,
      action: "swap",
      args: {},
      dryRunEffects: null,
      verdict: "approved",
    });

    // Must not throw; must surface the not_configured status.
    expect(result.blob.status).toBe("not_configured");
    expect(result.blob.blobId).toBeNull();
    // Receipt payload is still constructed correctly.
    expect(result.receipt.action).toBe("swap");
    expect(result.receipt.schemaVersion).toBe(1);
  });

  // ── Test 3: already_certified treated as success ─────────────────────────

  it("treats already_certified blob as a success (content-addressed dedup)", async () => {
    mockPublish.mockResolvedValueOnce({
      status: "already_certified",
      blobId: "blob-dedup",
      objectId: null,
      hash: "deadbeef",
    });

    const result = await buildAndPublishReceipt({
      txDigest: "tx-dup",
      approvedDigest: "digest-dup",
      action: "transfer",
      args: { recipient: "0xabc" },
      dryRunEffects: [],
      verdict: "approved",
    });

    expect(result.blob.status).toBe("already_certified");
    expect(result.blob.blobId).toBe("blob-dedup");
  });

  // ── Test 4: BLOCK receipt (txDigest null, blockReasons populated) ────────

  it("builds a BLOCK receipt with null txDigest and block metadata", async () => {
    mockPublish.mockResolvedValueOnce({
      status: "published",
      blobId: "blob-block",
      objectId: "obj-block",
      hash: "deadbeef2",
    });

    const result = await buildAndPublishReceipt({
      txDigest: null,
      approvedDigest: null,
      action: "near_miss",
      args: {},
      dryRunEffects: null,
      verdict: "blocked",
      blockReasons: ["Lookalike: 888-l.sui differs at final char"],
      blockGates: ["suins_lookalike"],
    });

    expect(result.receipt.txDigest).toBeNull();
    expect(result.receipt.verdict).toBe("blocked");
    expect(result.receipt.blockReasons).toEqual([
      "Lookalike: 888-l.sui differs at final char",
    ]);
    expect(result.receipt.blockGates).toEqual(["suins_lookalike"]);
    expect(result.receipt.schemaVersion).toBe(1);
  });

  // ── Test 5: publishJsonBlob called exactly once with kind "action-receipt" ─

  it("calls publishJsonBlob with kind 'action-receipt'", async () => {
    mockPublish.mockResolvedValueOnce({
      status: "published",
      blobId: "blob-kind-check",
      objectId: null,
      hash: "h",
    });

    await buildAndPublishReceipt({
      txDigest: "tx-kind",
      approvedDigest: null,
      action: "transfer",
      args: {},
      dryRunEffects: null,
      verdict: "approved",
    });

    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledWith(
      "action-receipt",
      expect.objectContaining({ action: "transfer", schemaVersion: 1 }),
    );
  });
});
