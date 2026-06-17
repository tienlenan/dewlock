/**
 * Tests: POST /api/bridge-redeem — input validation + server-side Gate-8 fetch.
 *
 * The route require()s the real prepareBridgeRedeem (matching the prepare-trade
 * route pattern), so a malformed VAA exercises the real fail-closed flow. We mock
 * only the chain fetch (fetchCurrentGuardianSetIndex) to assert the index is
 * fetched SERVER-side (never trusted from the request body) and that a bad VAA
 * blocks (422) rather than building a redeem.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/wormhole/guardian-set", () => ({
  fetchCurrentGuardianSetIndex: vi.fn(),
}));

import { fetchCurrentGuardianSetIndex } from "@/lib/wormhole/guardian-set";
import { POST } from "../bridge-redeem/route";

const mockFetchIdx = fetchCurrentGuardianSetIndex as unknown as import("vitest").Mock<() => Promise<number | undefined>>;

const WALLET = "0x" + "a".repeat(64);
function post(body: unknown) {
  return new NextRequest("http://localhost/api/bridge-redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bridge-redeem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchIdx.mockResolvedValue(4);
  });

  it("400 on an invalid wallet address (before any chain fetch)", async () => {
    const res = await POST(post({ walletAddress: "0xnope", vaaBase64: "AAA" }));
    expect(res.status).toBe(400);
    expect(mockFetchIdx).not.toHaveBeenCalled();
  });

  it("400 when the VAA is missing", async () => {
    const res = await POST(post({ walletAddress: WALLET }));
    expect(res.status).toBe(400);
  });

  it("valid input fetches the guardian-set index SERVER-side and fail-closes a bad VAA (422)", async () => {
    const res = await POST(post({ walletAddress: WALLET, vaaBase64: "ZGVhZGJlZWY=" }));
    // The index is read server-side, never from the body.
    expect(mockFetchIdx).toHaveBeenCalledTimes(1);
    // A malformed VAA never builds a redeem — the real flow blocks.
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });
});
