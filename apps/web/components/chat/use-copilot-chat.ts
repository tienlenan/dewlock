"use client";

/**
 * useCopilotChat — state + stream-parsing hook for the Dewlock chat UI.
 *
 * Responsibilities:
 *  - Owns the messages array (user + assistant with embedded tool cards).
 *  - Streams /api/agent responses, parsing NDJSON lines into text deltas and cards.
 *  - Handles /api/prepare-trade demo results, converting them directly to cards.
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
import type { DemoAction } from "./chat-input";
import type { TxPreviewData } from "@/components/tx-preview-card";
import type { PortfolioCardProps } from "@/components/portfolio-card";

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

function toolResultToCard(toolName: string, result: unknown): ToolCard | null {
  if (toolName === "prepareTrade" && isPrepareTradeResult(result)) {
    return result.ok ? makePreviewCard(result) : makeBlockCard(result);
  }
  if (toolName === "getPortfolio" && isPortfolioResult(result)) {
    return makePortfolioCard(result);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stable ID generator
// ---------------------------------------------------------------------------

let idSeq = 0;
function nextId() {
  return `msg-${++idSeq}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCopilotChat(walletAddress: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const currentAssistantId = useRef<string | null>(null);

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
   * Handle a /api/prepare-trade demo result (no LLM involved).
   * Adds a user bubble labelled with the action, then an assistant bubble with the card.
   */
  const onDemoResult = useCallback((action: DemoAction, result: unknown) => {
    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      text: action.label,
      cards: [],
    };

    let card: ToolCard;
    if (isPrepareTradeResult(result)) {
      card = result.ok ? makePreviewCard(result) : makeBlockCard(result);
    } else {
      card = {
        type: "block",
        blockReasons: ["Unexpected response from server."],
        blockGates: ["network"],
      };
    }

    const isPass =
      isPrepareTradeResult(result) && result.ok;

    const assistantMsg: ChatMessage = {
      id: nextId(),
      role: "assistant",
      text: isPass
        ? "Guardian approved. Review the transaction details below before signing."
        : "Guardian blocked this transaction. See the details below.",
      cards: [card],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  }, []);

  /**
   * Send a free-text message through /api/agent (LLM path).
   * Streams the NDJSON response, building the assistant message incrementally.
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        text,
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

      // Snapshot history before state update for the fetch body
      const historyForAgent = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.text,
      }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: historyForAgent, walletAddress }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          appendText(`[Error]: ${errText}`);
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
              if (card) appendCard(card);
            } else if (parsed.type === "error") {
              appendText(`\n[Error]: ${parsed.message}`);
            } else if (parsed.type === "done") {
              break outer;
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendText(`\n[Network error]: ${msg}`);
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

  return { messages, isStreaming, sendMessage, onDemoResult, onReplaceCard };
}
