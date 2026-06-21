import { describe, it, expect } from "vitest";
import { parseIntent } from "@dewlock/agent/intent/parse-intent";
import { WELCOME_ACTION_INTENTS, DISCOVER_ACTION_INTENTS } from "@/components/chat/welcome-actions";

/**
 * Drift guard: every welcome action card's intent string must keep parsing to a concrete
 * action via the deterministic parser. If a chip string drifts out of sync with parse-intent,
 * this fails instead of silently routing through the LLM.
 */
describe("welcome action intents", () => {
  it("each value-action card intent maps to the expected concrete action", () => {
    const actions = WELCOME_ACTION_INTENTS.map((t) => parseIntent(t)?.action ?? null);
    expect(actions).toEqual(["swap_form", "limit_order_form", "send", "lend", "portfolio"]);
  });

  it("each discovery card intent maps to its ecosystem action", () => {
    const actions = DISCOVER_ACTION_INTENTS.map((t) => parseIntent(t)?.action ?? null);
    expect(actions).toEqual(["ecosystemYields", "ecosystemTvl", "ecosystemTokens"]);
  });
});
