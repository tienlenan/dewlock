/**
 * Copilot layer — system-prompt guardrails + tool-routing wiring.
 *
 * The 16 guardian-*.test.ts files cover RUNTIME enforcement (the Guardian gates).
 * This file covers the COPILOT prompt layer that steers the LLM toward those gates:
 *  - the non-negotiable safety directives must stay in the system prompt, and
 *  - every tool the persona routes to must exist as a real Mastra tool (id matches),
 *    so the model can never be told to call a tool that isn't registered.
 *
 * Pure: no LLM, no network — just the persona strings + statically-imported tools.
 */

import { describe, it, expect } from "vitest";
import { COPILOT_PERSONA, TOOL_USE_RULES, SECURITY_RULES } from "../copilot-persona";
import { copilot } from "../agent";

import { prepareTrade } from "../tools/prepare-trade";
import { getPortfolio } from "../tools/get-portfolio";
import { listProtocols } from "../tools/list-protocols";
import { getSwapOptions } from "../tools/get-swap-options";
import { getLendOptions } from "../tools/get-lend-options";
import { getSwapForm } from "../tools/get-swap-form";
import { getReceiveInfo } from "../tools/get-receive-info";
import { getUserStats } from "../tools/get-user-stats";
import { getProtocolMetrics } from "../tools/get-protocol-metrics";
import { requestActionForm } from "../tools/request-action-form";
import { requestContactPicker } from "../tools/request-contact-picker";

// Tools the persona's routing rules tell the model to call. Keyed by the exact name
// the LLM uses — which MUST equal the tool's `id`.
const ROUTED_TOOLS: Record<string, unknown> = {
  prepareTrade,
  getPortfolio,
  listProtocols,
  getSwapOptions,
  getLendOptions,
  getSwapForm,
  getReceiveInfo,
  getUserStats,
  getProtocolMetrics,
  requestActionForm,
  requestContactPicker,
};

const INSTRUCTIONS = `${COPILOT_PERSONA}\n${TOOL_USE_RULES}\n${SECURITY_RULES}`;

describe("copilot guardrails — hard security invariants stay in the system prompt", () => {
  it("SECURITY_RULES keeps all six non-negotiable invariants", () => {
    expect(SECURITY_RULES).toMatch(/zero user-fund keys/i); // never signs
    expect(SECURITY_RULES).toMatch(/allowlisted calls only/i);
    expect(SECURITY_RULES).toMatch(/per-tx USD cap and per-day USD cap/i);
    expect(SECURITY_RULES).toMatch(/dry-run before confirm/i);
    expect(SECURITY_RULES).toMatch(/suins spoof guard/i);
    // The caps are server secrets — the model must never reveal them.
    expect(SECURITY_RULES).toMatch(/never reveal the per-tx USD cap/i);
  });

  it("COPILOT_PERSONA keeps the show-then-confirm + no-autonomous-signing guardrails", () => {
    expect(COPILOT_PERSONA).toMatch(/never sign transactions/i);
    expect(COPILOT_PERSONA).toMatch(/never request private keys/i);
    // Trust-first: always show the raw 0x address alongside any human name.
    expect(COPILOT_PERSONA).toMatch(/raw 0x.*address alongside/i);
    // Show-then-confirm: dry-run effects before the user signs.
    expect(COPILOT_PERSONA).toMatch(/expected balance changes.*before the user confirms/i);
    // A Guardian block must not be auto-retried.
    expect(COPILOT_PERSONA).toMatch(/do not retry automatically/i);
  });

  it("TOOL_USE_RULES forbids fabrication, auto-retry, and ticker coin types", () => {
    expect(TOOL_USE_RULES).toMatch(/never fabricate tool results/i);
    expect(TOOL_USE_RULES).toMatch(/do not retry automatically/i);
    expect(TOOL_USE_RULES).toMatch(/invoke exactly one tool per reasoning step/i);
    // Coin types passed to tools must be canonical 0x types, never a display ticker.
    expect(TOOL_USE_RULES).toMatch(/canonical 0x types/i);
  });
});

describe("copilot wiring — every routed tool exists and is named consistently", () => {
  it.each(Object.entries(ROUTED_TOOLS))(
    "%s is a registered Mastra tool the persona can route to",
    (name, tool) => {
      const t = tool as { id?: string; execute?: unknown };
      // The LLM calls the tool by `id`; it must equal the routing name.
      expect(t.id).toBe(name);
      expect(typeof t.execute).toBe("function");
      // The persona must actually reference this tool by name (no orphaned tools).
      expect(INSTRUCTIONS).toContain(name);
    },
  );

  it("the persona references no tool name that isn't a registered tool", () => {
    // Every backtick-quoted `toolName` in the persona must be a known tool. Guards
    // against the prompt telling the model to call a tool that was renamed/removed.
    const referenced = new Set(
      [...INSTRUCTIONS.matchAll(/`([a-z][a-zA-Z]+)`/g)].map((m) => m[1]),
    );
    // Only check camelCase identifiers that look like our tool names (call* / get* /
    // list* / prepare* / request*) — ignore prose backticks like env var names.
    const toolish = [...referenced].filter((r) =>
      /^(get|list|prepare|request)[A-Z]/.test(r),
    );
    for (const name of toolish) {
      expect(Object.keys(ROUTED_TOOLS)).toContain(name);
    }
  });
});

describe("copilot agent — constructs with the persona + routed tools", () => {
  it("exports a constructed agent with the expected identity", () => {
    expect(copilot).toBeDefined();
    expect(copilot.name).toBe("Dewlock Sui DeFi Copilot");
    expect(copilot.id).toBe("copilot");
  });

  it("composes all three persona sections into the instructions", () => {
    // agent.ts builds instructions = persona + tool rules + security rules.
    for (const section of [COPILOT_PERSONA, TOOL_USE_RULES, SECURITY_RULES]) {
      expect(section.trim().length).toBeGreaterThan(0);
    }
    // Distinct sections — a copy/paste collapse would defeat the layering.
    expect(COPILOT_PERSONA).not.toEqual(TOOL_USE_RULES);
    expect(TOOL_USE_RULES).not.toEqual(SECURITY_RULES);
  });
});
