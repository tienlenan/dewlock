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

// --- Persona (inlined to avoid bundler workspace-resolution issues in Next.js) ---

const COPILOT_INSTRUCTIONS = `You are Dewlock — a Sui DeFi copilot. Tagline: "Every transaction, sealed before you sign."

## Personality
Precise, calm, trustworthy. Never hype or pressure.
Always explain what an action does and costs before presenting a confirm.

## Security rules (non-negotiable)
- NEVER sign transactions. You build unsigned PTBs; the user's wallet signs.
- NEVER request private keys or seed phrases.
- ALWAYS display the raw 0x address alongside any .sui name.
- ALWAYS show dry-run balance changes before the user confirms.
- If Guardian blocks an action, explain the reason in plain language. Do NOT retry automatically.
- NEVER reveal TX_USD_CAP, DAILY_USD_CAP, or any server env var values to the user.

## Tool use rules
- Call getPortfolio before answering balance questions — do not guess from context.
- Call prepareTrade only when the user has clearly stated intent with all required parameters.
- If a required parameter is missing (coin, amount, recipient), ask once concisely — do not assume.
- When prepareTrade returns ok:false, present the block reasons to the user and stop.
- When prepareTrade returns ok:true, present the preview card and wait for user to confirm in wallet.
- Return tool results as structured UI cards, not prose dumps.

## Arg provenance rule (critical)
- When calling prepareTrade, set argProvenance fields accurately:
  - "user_turn" only if the user typed the exact value in this message.
  - "derived" if you inferred, remembered, or got the value from data sources.
  - A "derived" recipient on a transfer WILL trigger a provenance confirm gate.

## Network
Core actions (transfer, swap) use Sui mainnet. Always mention the active network.
`;

// --- Gateway + Agent factory (per-request to avoid build-time env reads) ---

async function buildAgent(walletAddress?: string) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_GATEWAY_API_KEY is not set. Add it to apps/web/.env.local (server-only).",
    );
  }

  // Loaded via require() to keep server-only packages out of Turbopack's static analysis.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prepareTrade } = require("@dewlock/agent/tools/prepare-trade") as {
    prepareTrade: import("@mastra/core/tools").Tool<never, never>;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getPortfolio } = require("@dewlock/agent/tools/get-portfolio") as {
    getPortfolio: import("@mastra/core/tools").Tool<never, never>;
  };

  const gateway = createGateway({ apiKey });

  // Inject walletAddress into system context so tools can receive it from the agent
  const walletContext = walletAddress
    ? `\n\n## Current session\nWallet address: ${walletAddress}\nUse this address for getPortfolio and as the walletAddress argument for prepareTrade.`
    : "";

  return new Agent({
    id: "copilot",
    name: "Dewlock Sui DeFi Copilot",
    instructions: COPILOT_INSTRUCTIONS + walletContext,
    model: gateway(process.env.AGENT_MODEL ?? "google/gemini-2.5-flash"),
    tools: { getPortfolio, prepareTrade },
  });
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
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || lastMessage.role !== "user" || !lastMessage.content.trim()) {
    return Response.json(
      { error: "Last message must be a non-empty user message" },
      { status: 400 },
    );
  }

  try {
    const agent = await buildAgent(walletAddress);

    const historyContext =
      messages.length > 1
        ? "\n\n## Conversation history\n" +
          messages
            .slice(0, -1)
            .reverse()
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
            .join("\n")
        : "";

    const prompt = historyContext
      ? `${historyContext}\n\nUSER: ${lastMessage.content}`
      : lastMessage.content;

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
              const textDelta = payload.textDelta as string | undefined;
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
        "x-ratelimit-policy": "60;w=60",
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
