"use client";

/**
 * useCopilotChat — state + stream-parsing hook for the Dewlock chat UI.
 *
 * Responsibilities:
 *  - Owns the messages array (user + assistant with embedded tool cards).
 *  - Streams /api/agent responses, parsing NDJSON lines into text deltas and cards.
 *  - Exposes onReplaceCard so ChatThread can swap a card when the user
 *    confirms (tx-preview → receipt) or cancels (tx-preview → wysiwys-error).
 *
 * NDJSON line shapes consumed from /api/agent:
 *  {"type":"text","text":"..."}
 *  {"type":"tool-result","toolName":"prepareTrade","result":{...}}
 *  {"type":"tool-result","toolName":"getPortfolio","result":{...}}
 *  {"type":"error","message":"..."}
 *  {"type":"done"}
 *
 * Tool result → ToolCard mapping:
 *  prepareTrade ok:true  → { type: "tx-preview", pendingTx: { txBytes, approvedDigest, preview } }
 *  prepareTrade ok:false → { type: "block", blockReasons, blockGates }
 *  getPortfolio          → { type: "portfolio", portfolio: {...} }
 */

import { useState, useCallback, useRef } from "react";
import type { ChatMessage, ToolCard, PendingTx } from "./chat-thread";
import type { TxPreviewData } from "@/components/tx-preview-card";
import type { PortfolioCardProps } from "@/components/portfolio-card";
import type { ApiResponse as ProtocolsData } from "@/components/protocols/protocol-list";
import type { SwapOptionsData } from "@/components/chat/swap-options-card";
import type { LendOptionsData } from "@/components/chat/lend-options-card";
import type { SwapFormData } from "@/components/chat/swap-form-card";
import type { LimitOrderFormData } from "@/components/chat/limit-order-form-card";
import type { ActionFormData } from "@/components/chat/action-form-card";
import type { ContactPickerData } from "@/components/chat/contact-picker-card";
import type { ReceiveCardData } from "@/components/receive-card";
import type { UserStatsData, BadgeStateDto } from "@/components/dashboard/types";

// ---------------------------------------------------------------------------
// NDJSON line shapes
// ---------------------------------------------------------------------------

type AgentLine =
  | { type: "text"; text: string }
  | { type: "tool-result"; toolName: string; result: unknown }
  | { type: "error"; message: string }
  | { type: "done" };

// ---------------------------------------------------------------------------
// prepareTrade result shapes (mirrors prepare-trade.ts output schema)
// ---------------------------------------------------------------------------

interface PrepareTradePass {
  ok: true;
  approvedDigest: string;
  txBytes: string;
  preview: TxPreviewData;
}

interface PrepareTradeBlock {
  ok: false;
  reasons: string[];
  gates: string[];
}

type PrepareTradeResult = PrepareTradePass | PrepareTradeBlock;

function isPrepareTradeResult(v: unknown): v is PrepareTradeResult {
  return (
    typeof v === "object" &&
    v !== null &&
    "ok" in v &&
    typeof (v as Record<string, unknown>).ok === "boolean"
  );
}

// ---------------------------------------------------------------------------
// getPortfolio result shape (mirrors get-portfolio.ts output schema)
// ---------------------------------------------------------------------------

interface PortfolioResult {
  walletAddress: string;
  balances: PortfolioCardProps["balances"];
  totalEstimatedUsdValue: number;
  network: "mainnet";
  demoFixture: boolean;
}

function isPortfolioResult(v: unknown): v is PortfolioResult {
  return (
    typeof v === "object" &&
    v !== null &&
    "balances" in v &&
    Array.isArray((v as Record<string, unknown>).balances)
  );
}

// ---------------------------------------------------------------------------
// Card factory helpers
// ---------------------------------------------------------------------------

function makePreviewCard(result: PrepareTradePass): ToolCard {
  const preview: TxPreviewData = {
    ...result.preview,
    // Ensure approvedDigest is on the preview for TxPreviewCard's digest display
    approvedDigest: result.approvedDigest,
  };
  const pendingTx: PendingTx = {
    txBytes: result.txBytes,
    approvedDigest: result.approvedDigest,
    preview,
  };
  return { type: "tx-preview", pendingTx };
}

function makeBlockCard(result: PrepareTradeBlock): ToolCard {
  return {
    type: "block",
    blockReasons: result.reasons,
    blockGates: result.gates,
  };
}

function makePortfolioCard(result: PortfolioResult): ToolCard {
  return {
    type: "portfolio",
    portfolio: {
      walletAddress: result.walletAddress,
      balances: result.balances,
      totalEstimatedUsdValue: result.totalEstimatedUsdValue,
      network: result.network,
      demoFixture: result.demoFixture,
    },
  };
}

// Read-only display tools → cards (no value path; never build/sign here).
function hasKeys(v: unknown, keys: string[]): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && keys.every((k) => k in v);
}

export function toolResultToCard(toolName: string, result: unknown): ToolCard | null {
  if (toolName === "prepareTrade" && isPrepareTradeResult(result)) {
    return result.ok ? makePreviewCard(result) : makeBlockCard(result);
  }
  if (toolName === "getPortfolio" && isPortfolioResult(result)) {
    return makePortfolioCard(result);
  }
  if (toolName === "listProtocols" && hasKeys(result, ["active", "excluded"])) {
    return { type: "protocols", protocols: result as unknown as ProtocolsData };
  }
  if (toolName === "getSwapOptions" && hasKeys(result, ["options", "coinTypeIn"])) {
    return { type: "swap-options", swapOptions: result as unknown as SwapOptionsData };
  }
  if (toolName === "getLendOptions" && hasKeys(result, ["options", "coinType", "verb"])) {
    return { type: "lend-options", lendOptions: result as unknown as LendOptionsData };
  }
  if (toolName === "getSwapForm" && hasKeys(result, ["coins"])) {
    return { type: "swap-form", swapForm: result as unknown as SwapFormData };
  }
  if (toolName === "getLimitOrderForm" && hasKeys(result, ["pools"])) {
    return { type: "limit-order-form", limitOrderForm: result as unknown as LimitOrderFormData };
  }
  if (toolName === "requestActionForm" && hasKeys(result, ["formAction", "needs"])) {
    return { type: "action-form", form: result as unknown as ActionFormData };
  }
  if (toolName === "requestContactPicker" && hasKeys(result, ["candidates", "query"])) {
    return { type: "contact-picker", picker: result as unknown as ContactPickerData };
  }
  if (toolName === "getReceiveInfo" && hasKeys(result, ["address", "qrData"])) {
    return { type: "receive", receive: result as unknown as ReceiveCardData };
  }
  if (toolName === "getUserStats" && hasKeys(result, ["stats", "badges"])) {
    const r = result as { stats: unknown; badges: unknown };
    return {
      type: "user-stats",
      userStats: r as { stats: UserStatsData; badges: { earned: BadgeStateDto[]; locked: BadgeStateDto[] } },
    };
  }
  if (toolName === "getProtocolMetrics" && hasKeys(result, ["supportedProtocols", "perProtocol"])) {
    // Card self-fetches /api/metrics for live TVL; the registry counts are in `result`.
    return { type: "protocol-metrics" };
  }
  // Ecosystem discovery markers → self-fetching cards (routed by toolName; the
  // tool result is just a { chain: "Sui" } marker — the card owns the data fetch).
  if (toolName === "getStablecoinYields") {
    return { type: "ecosystem-yields" };
  }
  if (toolName === "getTopTvl") {
    return { type: "ecosystem-tvl" };
  }
  if (toolName === "getTrendingTokens") {
    return { type: "ecosystem-tokens" };
  }
  if (
    toolName === "getDefiPositions" &&
    hasKeys(result, ["walletAddress", "deepbook", "lending"])
  ) {
    // Safe: hasKeys guard validates the required top-level shape at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { type: "defi-positions", positions: result as any };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stable ID generator
// ---------------------------------------------------------------------------

// IDs must stay unique even after rehydrating a saved conversation (whose
// messages already carry msg-* ids) — a plain reset-on-reload counter collides
// with rehydrated ids. Prefer crypto.randomUUID; fall back to counter+entropy.
let idSeq = 0;
function nextId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `msg-${crypto.randomUUID()}`;
  }
  return `msg-${++idSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

// The form cards append a deterministic binding marker to their command — the server
// reads it, the user shouldn't see it. Strip it (and trailing space) from the displayed
// bubble. Formats kept in sync with parse-intent SWAP_BIND_RE / LIMIT_BIND_RE.
//   swap-form:  [[swap:in=…|out=…|src=…]]
//   limit-form: [[limit:pool=…|side=…|price=…|qty=…|exp=…]]
const SWAP_BIND_MARKER = /\s*\[\[swap:in=[^|\]]+\|out=[^|\]]+(?:\|src=[^\]]+)?\]\]/i;
const LIMIT_BIND_MARKER = /\s*\[\[limit:pool=[^|\]]+\|side=[^|\]]+\|price=[^|\]]+\|qty=[^|\]]+\|exp=[^\]]+\]\]/i;
function stripBindMarkers(text: string): string {
  return text.replace(SWAP_BIND_MARKER, "").replace(LIMIT_BIND_MARKER, "").trim();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCopilotChat(
  walletAddress: string,
  // The freshest friend book — passed to /api/agent so "send to <name>" resolves a
  // just-added/deleted contact without waiting on memwal indexing (~30s lag). A ref keeps
  // sendMessage's identity stable while always sending the latest list.
  contacts: { name: string; address: string }[] = [],
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const currentAssistantId = useRef<string | null>(null);
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;

  /** Append a text delta to the last assistant message. */
  const appendText = useCallback((delta: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { ...last, text: last.text + delta }];
    });
  }, []);

  /** Append a tool card to the last assistant message. */
  const appendCard = useCallback((card: ToolCard) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      return [
        ...prev.slice(0, -1),
        { ...last, cards: [...last.cards, card] },
      ];
    });
  }, []);

  /**
   * Replace a specific card in a named message.
   * Used by ChatThread when the user confirms (→ receipt) or cancels (→ error).
   */
  const onReplaceCard = useCallback(
    (messageId: string, cardIndex: number, replacement: ToolCard) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          return {
            ...msg,
            cards: msg.cards.map((c, i) => (i === cardIndex ? replacement : c)),
          };
        }),
      );
    },
    [],
  );

  /**
   * Send a free-text message through /api/agent (LLM path).
   * Streams the NDJSON response, building the assistant message incrementally.
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      // The form cards append a deterministic binding marker (swap or limit). Show a
      // clean bubble, but send the FULL text (with marker) to the agent so the
      // server-side intent parser binds the exact coin types / order params.
      const displayText = stripBindMarkers(text);

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        text: displayText,
        cards: [],
      };

      const assistantId = nextId();
      currentAssistantId.current = assistantId;

      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        cards: [],
        streaming: true,
      };

      // Snapshot history before state update for the fetch body. Prior messages use their
      // already-clean display text; the just-sent turn sends the FULL text (with the binding
      // marker) so the server-side intent parser can bind the exact coin types.
      const historyForAgent = [
        ...messages.map((m) => ({ role: m.role, content: m.text })),
        { role: "user" as const, content: text },
      ];

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: historyForAgent, walletAddress, contacts: contactsRef.current }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          const is429 = res.status === 429;
          appendCard({
            type: "agent-error",
            message: is429
              ? "You're sending messages too quickly. Please wait a moment and try again."
              : `Request failed (${res.status}): ${errText.slice(0, 200)}`,
            retryable: true,
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Read NDJSON stream line by line
        outer: while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // All complete lines (last element may be a partial line)
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let parsed: AgentLine;
            try {
              parsed = JSON.parse(trimmed) as AgentLine;
            } catch {
              continue; // non-JSON line — skip silently
            }

            if (parsed.type === "text") {
              appendText(parsed.text);
            } else if (parsed.type === "tool-result") {
              const card = toolResultToCard(parsed.toolName, parsed.result);
              if (card) {
                // Stamp the raw command (with its binding marker) so a reloaded conversation
                // can offer a "re-build" affordance — the signable bytes are never persisted,
                // only this command, which re-runs the full pipeline for a fresh preview.
                if (card.type === "tx-preview") card.rebuildCommand = text;
                appendCard(card);
              }
            } else if (parsed.type === "error") {
              // Server-side stream error — surface as a card, not raw text.
              appendCard({ type: "agent-error", message: parsed.message, retryable: false });
            } else if (parsed.type === "done") {
              break outer;
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Network / fetch-level error (offline, DNS, AbortError) — retryable.
        appendCard({
          type: "agent-error",
          message: `Connection error: ${msg}`,
          retryable: true,
        });
      } finally {
        // Clear streaming cursor on the assistant message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m,
          ),
        );
        currentAssistantId.current = null;
        setIsStreaming(false);
      }
    },
    // messages snapshot is intentionally captured at call time for history context
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStreaming, messages, walletAddress, appendText, appendCard],
  );

  /** Replace the whole thread (rehydrate a saved conversation). */
  const loadMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
  }, []);

  /** Clear the thread (start a new conversation). */
  const reset = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isStreaming, sendMessage, onReplaceCard, loadMessages, reset };
}
