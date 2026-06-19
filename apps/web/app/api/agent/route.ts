/**
 * Dewlock agent API route — POST /api/agent
 * Server-only: reads AI_GATEWAY_API_KEY from env (never NEXT_PUBLIC_).
 *
 * Emits NDJSON (one JSON object per line). Line types:
 *  {"type":"text","text":"..."}
 *  {"type":"tool-result","toolName":"prepareTrade","result":{...}}
 *  {"type":"tool-result","toolName":"getPortfolio","result":{...}}
 *  {"type":"error","message":"..."}
 *  {"type":"done"}
 *
 * Security invariants:
 *  - AI_GATEWAY_API_KEY is a gateway key only — NOT a Sui signing key.
 *  - No user-fund keys in this file or its transitive server imports.
 *  - Input validated at boundary before reaching the agent.
 *  - Guardian runs inside prepareTrade — no PTB reaches the LLM on a block.
 *  - CORS locked to app origin; rate-limit header included.
 *  - walletAddress is public wallet address only, never a private key.
 */

import { Agent } from "@mastra/core/agent";
import { createGateway } from "@ai-sdk/gateway";
import { NextRequest } from "next/server";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { seedPopularTokens } from "@/lib/seed-popular-tokens";
import { seedCommittedCap } from "@/lib/seed-committed-cap";

export const maxDuration = 60;

// 60 req/min per IP — generous for a streaming chat endpoint
const RATE_LIMIT_MAX = 60;

// --- Gateway + Agent factory (per-request to avoid build-time env reads) ---

async function buildAgent(walletAddress?: string) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_GATEWAY_API_KEY is not set. Add it to apps/web/.env.local (server-only).",
    );
  }

  // Loaded via require() to keep server-only packages out of Turbopack's static analysis.
  type AnyTool = import("@mastra/core/tools").Tool<never, never>;
  /* eslint-disable @typescript-eslint/no-require-imports */
  // Single source of truth for routing/persona — shared with the standalone agent + tests.
  const { COPILOT_PERSONA, TOOL_USE_RULES, SECURITY_RULES } = require("@dewlock/agent/copilot-persona") as {
    COPILOT_PERSONA: string;
    TOOL_USE_RULES: string;
    SECURITY_RULES: string;
  };
  const { prepareTrade } = require("@dewlock/agent/tools/prepare-trade") as { prepareTrade: AnyTool };
  const { getPortfolio } = require("@dewlock/agent/tools/get-portfolio") as { getPortfolio: AnyTool };
  const { listProtocols } = require("@dewlock/agent/tools/list-protocols") as { listProtocols: AnyTool };
  const { getSwapOptions } = require("@dewlock/agent/tools/get-swap-options") as { getSwapOptions: AnyTool };
  const { getLendOptions } = require("@dewlock/agent/tools/get-lend-options") as { getLendOptions: AnyTool };
  const { getSwapForm } = require("@dewlock/agent/tools/get-swap-form") as { getSwapForm: AnyTool };
  const { getReceiveInfo } = require("@dewlock/agent/tools/get-receive-info") as { getReceiveInfo: AnyTool };
  const { getProtocolMetrics } = require("@dewlock/agent/tools/get-protocol-metrics") as { getProtocolMetrics: AnyTool };
  const { getUserStats } = require("@dewlock/agent/tools/get-user-stats") as { getUserStats: AnyTool };
  const { requestActionForm } = require("@dewlock/agent/tools/request-action-form") as { requestActionForm: AnyTool };
  const { requestContactPicker } = require("@dewlock/agent/tools/request-contact-picker") as { requestContactPicker: AnyTool };
  /* eslint-enable @typescript-eslint/no-require-imports */

  const gateway = createGateway({ apiKey });

  // Inject walletAddress into system context so tools can receive it from the agent
  const walletContext = walletAddress
    ? `\n\n## Current session\nWallet address: ${walletAddress}\nUse this address for getPortfolio and as the walletAddress argument for prepareTrade.`
    : "";

  return new Agent({
    id: "copilot",
    name: "Dewlock Sui DeFi Copilot",
    instructions: `${COPILOT_PERSONA}\n${TOOL_USE_RULES}\n${SECURITY_RULES}${walletContext}`,
    model: gateway(process.env.AGENT_MODEL ?? "google/gemini-2.5-flash"),
    tools: { getPortfolio, prepareTrade, listProtocols, getSwapOptions, getLendOptions, getSwapForm, getReceiveInfo, getProtocolMetrics, getUserStats, requestActionForm, requestContactPicker },
  });
}

/** A friend-book entry the client supplies (its freshest copy) for name resolution. */
interface ContactInput {
  name: string;
  address: string;
}

/** Validate + normalize the client-supplied contacts (bounded; 0x addresses only). */
function sanitizeContacts(raw: unknown): ContactInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ContactInput[] = [];
  for (const c of raw.slice(0, 100)) {
    if (!c || typeof c !== "object") continue;
    const name = (c as Record<string, unknown>).name;
    const address = (c as Record<string, unknown>).address;
    if (typeof name === "string" && typeof address === "string" && /^0x[0-9a-fA-F]{64}$/.test(address)) {
      out.push({ name: name.slice(0, 64), address: address.toLowerCase() });
    }
  }
  return out;
}

// --- Request / response types ---

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  /** Wallet address injected by client (public — not a key). */
  walletAddress?: string;
  /** The client's freshest friend book — used for deterministic "send to <name>" resolution. */
  contacts?: ContactInput[];
}

function isValidBody(body: unknown): body is RequestBody {
  if (!body || typeof body !== "object") return false;
  const { messages } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every(
    (m) =>
      m &&
      typeof m === "object" &&
      typeof (m as Record<string, unknown>).role === "string" &&
      typeof (m as Record<string, unknown>).content === "string",
  );
}

// --- CORS headers ---

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
  const isAllowed =
    allowedOrigins.length === 0 || (origin != null && allowedOrigins.includes(origin));
  return {
    "access-control-allow-origin": isAllowed && origin ? origin : "null",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

/** Serialize a value to a NDJSON line (JSON + newline). */
function ndjsonLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

// --- Route handler ---

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Rate-limit check — applied before any body parsing to fail fast.
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, scope: "agent" });
  if (rl.limited) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { ...corsHeaders(origin), ...rateLimitHeaders(rl, RATE_LIMIT_MAX) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return Response.json(
      {
        error:
          "Body must be { messages: [{role, content}], walletAddress?: string }",
      },
      { status: 400 },
    );
  }

  const { messages, walletAddress } = body;
  // The client supplies its freshest friend book (memwal recall lags ~30s, so a server
  // read would miss a just-added/deleted contact). Used for deterministic name resolution.
  const contacts = sanitizeContacts((body as RequestBody).contacts);

  // Seed the popular-token symbol→address map into this wallet's memwal (once per
  // process). Fire-and-forget — never blocks the chat; resolution-only (see helper).
  void seedPopularTokens(walletAddress);
  // Seed the committed risk cap (mirrors the server-enforced caps) so the memory
  // chip recalls real preferences instead of an empty state. Fire-and-forget.
  void seedCommittedCap(walletAddress);
  // Warm the USD price cache (importing it also registers the live-price provider
  // into getTrustedUsdPrice). Fire-and-forget — conservative floors cover a cold cache.
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const { refreshUsdPrices } = require("@dewlock/sui/price-oracle") as { refreshUsdPrices: () => Promise<void> };
    void refreshUsdPrices();
  } catch {
    // best-effort warm; floors apply until the cache populates
  }
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || lastMessage.role !== "user" || !lastMessage.content.trim()) {
    return Response.json(
      { error: "Last message must be a non-empty user message" },
      { status: 400 },
    );
  }

  // Single-action guard: a message bundling 2+ distinct value actions (e.g. "send … and
  // swap …") is refused BEFORE the LLM — we stream guidance to do one action per message
  // and call no value tool. Deterministic; never throws into the turn.
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const { detectMultiAction } = require("@dewlock/agent/intent/detect-multi-action") as {
      detectMultiAction: (text: string) => { multi: boolean; actions: string[] };
    };
    const ma = detectMultiAction(lastMessage.content);
    if (ma.multi) {
      const labels: Record<string, string> = {
        send: "send", swap: "swap/sell", lend: "lend", bridge: "bridge", limit: "place a limit order",
      };
      const numbered = ma.actions.map((a, i) => `(${i + 1}) ${labels[a] ?? a}`).join(" and ");
      const guidance =
        `I handle one action per message — that keeps each transaction clear and lets the Guardian ` +
        `verify exactly what you'll sign. You asked to ${numbered}. Which would you like to start with? ` +
        `Send that one on its own and I'll prepare it.`;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(ndjsonLine({ type: "text", text: guidance }));
          controller.enqueue(ndjsonLine({ type: "done" }));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "x-content-type-options": "nosniff",
          "cache-control": "no-cache",
          ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
          ...corsHeaders(origin),
        },
      });
    }
  } catch {
    // Detection failure must never block the turn — fall through to normal routing.
  }

  try {
    const agent = await buildAgent(walletAddress);

    // Deterministic intent pre-parse: for self-contained commands, inject a strong
    // routing directive so the LLM calls the right tool with the right args (fixes
    // "lending"→portfolio, applies the USDC→SUI / sell→USDC + "all"+gas rules).
    // Ambiguous input → no directive → normal LLM routing. The Guardian still gates.
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const { buildIntentDirective } = require("@dewlock/agent/intent/intent-directive") as {
      buildIntentDirective: (
        text: string,
        wallet?: string,
        contactBook?: { name: string; address: string }[],
      ) => Promise<string | null>;
    };
    let directive: string | null = null;
    try {
      // Pass the client's book so "send to <name>" resolves deterministically (1 → send,
      // 2+ → contact picker, 0 → SuiNS) — the LLM never matches or supplies a 0x.
      directive = await buildIntentDirective(lastMessage.content, walletAddress, contacts);
    } catch {
      directive = null; // never block the turn on intent parsing
    }

    const historyContext =
      messages.length > 1
        ? "\n\n## Conversation history\n" +
          messages
            .slice(0, -1)
            .reverse()
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
            .join("\n")
        : "";

    // High-recency reminder (last thing the model reads) — flash-class models otherwise
    // restate the card's data in prose. If a card renders, the text MUST be one short sentence.
    const REPLY_REMINDER =
      "REMINDER: if you call a tool that renders a card, your text reply is ONE short sentence " +
      "(e.g. \"I've prepared your transfer of 1 SUI on Mainnet.\") — do NOT restate the card's " +
      "amounts, 0x addresses, gas, balance changes, protocol lists, or APYs. Only reply at length " +
      "for plain conversation with no card.";
    const prompt = [directive, historyContext, `USER: ${lastMessage.content}`, REPLY_REMINDER]
      .filter(Boolean)
      .join("\n\n");

    const result = await agent.stream(prompt);

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // fullStream emits typed parts. Mastra 1.x wraps content in `.payload`:
          //   text-delta:  part.payload.textDelta
          //   tool-result: part.payload.toolName + part.payload.result
          // We surface text deltas and tool results as NDJSON lines to the client.
          for await (const part of result.fullStream) {
            // Mastra 1.x wraps chunk content in `.payload`; future versions may
            // flatten it. Defensive fallback: `payload ?? part` ensures both shapes work.
            // Shape A (current): { type, payload: { textDelta | toolName | result } }
            // Shape B (future):  { type, textDelta | toolName | result }
            const raw = part as Record<string, unknown>;
            const payload = (raw.payload as Record<string, unknown> | undefined) ?? raw;
            if (part.type === "text-delta") {
              // Mastra 1.42 carries the delta in `payload.text` (AI SDK v5). Older
              // versions used `textDelta` — keep it as a fallback so both shapes work.
              const textDelta = (payload.text ?? payload.textDelta) as string | undefined;
              if (textDelta) {
                controller.enqueue(
                  ndjsonLine({ type: "text", text: textDelta }),
                );
              }
            } else if (part.type === "tool-result") {
              const toolName = payload.toolName as string | undefined;
              const toolResult = payload.result;
              if (toolName) {
                controller.enqueue(
                  ndjsonLine({
                    type: "tool-result",
                    toolName,
                    result: toolResult,
                  }),
                );
              }
            }
            // step-finish, finish, tool-call parts are skipped (not needed by client)
          }
          controller.enqueue(ndjsonLine({ type: "done" }));
        } catch (e) {
          const message = e instanceof Error ? e.message : "Stream error";
          controller.enqueue(ndjsonLine({ type: "error", message }));
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "x-content-type-options": "nosniff",
        "cache-control": "no-cache",
        ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent error";
    console.error("[api/agent] error:", message);
    return Response.json(
      { error: message },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export async function GET() {
  return Response.json(
    { error: "Method not allowed. Use POST /api/agent with { messages: [...] }" },
    { status: 405, headers: { allow: "POST, OPTIONS" } },
  );
}
