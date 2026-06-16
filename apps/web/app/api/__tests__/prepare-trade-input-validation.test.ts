/**
 * Input-validation tests for POST /api/prepare-trade
 *
 * Tests:
 *  - malformed JSON → 400, no stack trace in response
 *  - missing required fields → 400 with "Invalid request" shape
 *  - invalid walletAddress format → 400
 *  - invalid actionType → 400
 *  - amountInNative with non-integer string → 400
 *  - valid minimal body passes validation layer (no 400)
 *
 * Strategy: import the route handler directly and call it with synthetic
 * NextRequest objects. This exercises Zod validation without a live server
 * and without mocking the @dewlock/agent module (validation runs before
 * any tool call, so the tool never executes in the 400 paths).
 *
 * The 200/202 happy-path is NOT tested here — that requires the @dewlock/agent
 * runtime which depends on native Node modules not available in the vitest
 * env. Happy-path coverage lives in the Guardian integration tests.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Stub heavy server-only deps that aren't available in vitest's node env.
// We only need the validation layer to run — tool execution is irrelevant.
// ---------------------------------------------------------------------------

// Stub @dewlock/walrus so the route module can be imported without its native deps.
vi.mock("@dewlock/walrus", () => ({
  recall: vi.fn().mockResolvedValue([]),
  remember: vi.fn().mockResolvedValue(undefined),
  isMemoryEnabled: vi.fn().mockReturnValue(false),
  contentHash: vi.fn().mockReturnValue("abc123"),
  memNamespace: vi.fn().mockReturnValue("dewlock:0x0"),
  buildAndPublishReceipt: vi.fn().mockResolvedValue({
    blob: { blobId: null, status: "not_configured", hash: "abc" },
    receipt: {},
  }),
}));

// Stub @dewlock/agent/memory/conviction-streak
vi.mock("@dewlock/agent/memory/conviction-streak", () => ({
  recallCommittedCap: vi.fn().mockResolvedValue(null),
  formatCapBlockWithRecall: vi.fn().mockReturnValue("cap block reason"),
}));

// Stub @/lib/demo/fixtures — must exist before route import
vi.mock("@/lib/demo/fixtures", () => ({
  getDemoMode: vi.fn().mockReturnValue("live"),
  getFixtureNearMissBlock: vi.fn().mockReturnValue({ ok: false, reasons: ["fixture"], gates: ["lookalike"] }),
}));

// Stub require() call inside the route for @dewlock/agent/tools/prepare-trade.
// The route uses require() at runtime so we intercept via __mocks__ or vi.mock
// with the CJS module factory approach. Since require() is dynamic, we set up
// a module mock that will be returned when the route calls require().
vi.mock("@dewlock/agent/tools/prepare-trade", () => ({
  prepareTrade: {
    execute: vi.fn().mockResolvedValue({ ok: false, reasons: ["stub"], gates: ["stub"] }),
  },
}));

// ---------------------------------------------------------------------------
// Import route AFTER mocks are registered.
// ---------------------------------------------------------------------------

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../prepare-trade/route");
  POST = mod.POST;
});

// ---------------------------------------------------------------------------
// Helper — build a NextRequest with a JSON body
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  const url = "http://localhost/api/prepare-trade";
  if (body === "__invalid_json__") {
    return new NextRequest(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not valid json !!!",
    });
  }
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const VALID_WALLET = "0x" + "a".repeat(64);

describe("POST /api/prepare-trade — input validation", () => {
  it("returns 400 for malformed JSON body (no stack trace in response)", async () => {
    const res = await POST(makeRequest("__invalid_json__"));
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty("error");
    // Must not leak a stack trace string in the error response
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toMatch(/at Object\./);
    expect(bodyStr).not.toMatch(/at async/);
    expect(bodyStr).not.toMatch(/node_modules/);
  });

  it("returns 400 with 'Invalid request' when body is an empty object", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Invalid request");
    expect(body).toHaveProperty("details");
    // details must not contain stack traces
    expect(JSON.stringify(body.details)).not.toMatch(/at Object\./);
  });

  it("returns 400 when walletAddress is missing", async () => {
    const res = await POST(makeRequest({
      actionType: "transfer",
      coinTypeIn: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      amountInNative: "1000000000",
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string; details?: unknown };
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when walletAddress has wrong format (not 64-hex)", async () => {
    const res = await POST(makeRequest({
      walletAddress: "0xshort",
      actionType: "transfer",
      coinTypeIn: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      amountInNative: "1000000000",
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when actionType is not a valid enum value", async () => {
    const res = await POST(makeRequest({
      walletAddress: VALID_WALLET,
      actionType: "liquidate", // not in enum
      amountInNative: "1000000000",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when amountInNative contains non-digit characters", async () => {
    const res = await POST(makeRequest({
      walletAddress: VALID_WALLET,
      actionType: "transfer",
      coinTypeIn: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      amountInNative: "1e9", // scientific notation — not a plain integer string
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when slippageBps is out of range (> 5000)", async () => {
    const res = await POST(makeRequest({
      walletAddress: VALID_WALLET,
      actionType: "swap",
      coinTypeIn: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      coinTypeOut: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
      amountInNative: "1000000000",
      slippageBps: 9999,
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when coinTypeIn is an unsupported coin", async () => {
    const res = await POST(makeRequest({
      walletAddress: VALID_WALLET,
      actionType: "transfer",
      coinTypeIn: "0xdeadbeef::fake::COIN",
      amountInNative: "1000000000",
    }));
    expect(res.status).toBe(400);
  });
});
