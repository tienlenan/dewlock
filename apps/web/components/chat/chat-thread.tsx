"use client";

/**
 * ChatThread — renders the conversation and parses the NDJSON agent stream.
 *
 * Message types in thread:
 *  - user: plain text bubble (right-aligned, accent-soft tint)
 *  - assistant: dewdrop avatar + text + embedded tool-result cards
 *
 * Card types (ToolCard.type):
 *  "tx-preview" → TxPreviewCard (pending confirmation)
 *  "block"      → BlockCard (Guardian refused, terminal)
 *  "portfolio"  → PortfolioCard (read-only balance view)
 *  "receipt"    → ReceiptCard (post-sign success)
 *  "wysiwys-error" → inline error (bytes changed or user cancelled)
 *
 * Memory chips: shown once at the top of an empty thread as sample recall notes.
 *
 * WYSIWYS signing: TxPreviewCardWithSigning owns one useSignAndExecuteTx hook
 * per card — rules-of-hooks compliant, approvedDigest baked per card instance.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { TxPreviewCard } from "@/components/tx-preview-card";
import { BlockCard } from "@/components/block-card";
import { PortfolioCard } from "@/components/portfolio-card";
import { ReceiptCard, type ReceiptStatus } from "@/components/receipt-card";
import { MemoryChip, SAMPLE_MEMORY_CHIPS } from "@/components/app/memory-chip";
import type { TxPreviewData } from "@/components/tx-preview-card";
import type { PortfolioCardProps } from "@/components/portfolio-card";
import { useSignAndExecuteTx, WysiwysError } from "@dewlock/sui/sign";
import { useReceiptReadiness, type ReceiptReadiness } from "./use-receipt-readiness";

// ---------------------------------------------------------------------------
// Shared types — keep identical to preserve contract with use-copilot-chat
// ---------------------------------------------------------------------------

export interface PendingTx {
  txBytes: string;
  approvedDigest: string;
  preview: TxPreviewData;
}

export interface TxReceipt {
  txDigest: string;
  approvedDigest: string;
  /** Walrus blobId for the immutable action receipt (null until async write resolves). */
  blobId?: string | null;
  /** Sui anchor HEAD object id (null until anchor resolves). */
  anchorObjectId?: string | null;
  /** Async receipt pipeline status. */
  status?: ReceiptStatus;
}

export type ToolCard =
  | { type: "tx-preview"; pendingTx: PendingTx }
  | { type: "block"; blockReasons: string[]; blockGates: string[] }
  | { type: "portfolio"; portfolio: PortfolioCardProps }
  | { type: "receipt"; receipt: TxReceipt }
  | { type: "wysiwys-error"; wysiwysMessage: string };

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  cards: ToolCard[];
  streaming?: boolean;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatThreadProps {
  messages: ChatMessage[];
  onReplaceCard: (messageId: string, cardIndex: number, replacement: ToolCard) => void;
  /** Signer's public wallet address — used to key the Sui receipt anchor HEAD. */
  walletAddress?: string;
}

// ---------------------------------------------------------------------------
// Dewdrop avatar — matches mockup assistant icon (30×30 rounded square)
// ---------------------------------------------------------------------------

function DewdropAvatar({ variant = "normal" }: { variant?: "normal" | "blocked" }) {
  const bg = variant === "blocked"
    ? "color-mix(in srgb, var(--destructive) 14%, transparent)"
    : "var(--accent-soft)";
  const fill = variant === "blocked" ? "var(--destructive)" : "var(--accent)";
  return (
    <div
      className="shrink-0 flex items-center justify-center"
      style={{ width: 30, height: 30, borderRadius: 9, background: bg }}
      aria-hidden
    >
      <svg width="13" height="21" viewBox="0 0 16 26" fill="none">
        <path d="M8 2C8 2 2 8.5 2 13a6 6 0 0 0 12 0C14 8.5 8 2 8 2Z" fill={fill} />
        {variant === "normal" && (
          <rect x="5" y="15" width="6" height="6" rx="1.2" fill="var(--accent-soft)" stroke={fill} strokeWidth="1.5" />
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function ChatThread({ messages, onReplaceCard, walletAddress }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{
        padding: "26px clamp(16px, 4vw, 40px)",
        // Custom scrollbar matching mockup
        scrollbarWidth: "thin",
        scrollbarColor: "var(--border-strong) transparent",
      }}
    >
      <div
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Welcome + memory chips — shown on empty thread */}
        <WelcomeRow showMemory={isEmpty} />

        {/* Message list */}
        {messages.map((msg) => (
          <MessageRow
            key={msg.id}
            message={msg}
            onReplaceCard={onReplaceCard}
            walletAddress={walletAddress}
          />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WelcomeRow — always visible; memory chips shown only before first message
// ---------------------------------------------------------------------------

function WelcomeRow({ showMemory }: { showMemory: boolean }) {
  return (
    <div className="flex gap-3">
      <DewdropAvatar />
      <div style={{ flex: 1, paddingTop: 3 }}>
        <div style={{ fontSize: "14.5px", lineHeight: 1.55, color: "var(--fg)" }}>
          Hi — I'm your Dewlock copilot. Tell me what you want to do in plain language.
          I build one unsigned transaction; the Guardian re-derives and dry-runs it before{" "}
          <strong>you</strong> sign.
        </div>

        {showMemory && (
          <>
            {/* Memory recall note */}
            <div style={{ marginTop: 7, fontSize: "12.5px", color: "var(--fg-muted)" }}>
              I remember your{" "}
              <strong style={{ color: "var(--fg)" }}>$5,000</strong> daily cap, a{" "}
              <strong style={{ color: "var(--fg)" }}>conservative</strong> risk profile, and that{" "}
              <strong style={{ color: "var(--fg)" }}>888.sui</strong> is a saved contact.
            </div>

            {/* Memory chips — labeled preview */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {SAMPLE_MEMORY_CHIPS.map((chip) => (
                <MemoryChip key={chip} text={chip} />
              ))}
              <span
                className="split-mono self-center"
                style={{ fontSize: "9px", color: "var(--fg-faint)", marginLeft: 2 }}
              >
                · sample
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageRow
// ---------------------------------------------------------------------------

function MessageRow({
  message,
  onReplaceCard,
  walletAddress,
}: {
  message: ChatMessage;
  onReplaceCard: (messageId: string, cardIndex: number, replacement: ToolCard) => void;
  walletAddress?: string;
}) {
  const isUser = message.role === "user";

  // Detect if this assistant message has a block card — use blocked avatar
  const hasBlock = message.cards.some((c) => c.type === "block");

  if (isUser) {
    return (
      <div className="flex justify-end" style={{ animation: "fadeUp 0.25s ease both" }}>
        <div
          style={{
            maxWidth: "78%",
            background: "var(--accent-soft)",
            color: "var(--accent-ink)",
            padding: "10px 14px",
            borderRadius: "14px 14px 4px 14px",
            fontSize: "14px",
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3" style={{ animation: "fadeUp 0.3s ease both" }}>
      <DewdropAvatar variant={hasBlock ? "blocked" : "normal"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Assistant text */}
        {(message.text || message.streaming) && (
          <div style={{ fontSize: "14px", color: "var(--fg)", marginBottom: 10, lineHeight: 1.55 }}>
            {message.text}
            {message.streaming && (
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 13,
                  marginLeft: 2,
                  background: "currentColor",
                  opacity: 0.6,
                  animation: "pulse 1s ease-in-out infinite",
                  verticalAlign: "text-bottom",
                }}
              />
            )}
          </div>
        )}

        {/* Tool cards */}
        {message.cards.map((card, idx) => (
          <CardSlot
            key={idx}
            card={card}
            onReplace={(replacement) => onReplaceCard(message.id, idx, replacement)}
            walletAddress={walletAddress}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardSlot
// ---------------------------------------------------------------------------

function CardSlot({
  card,
  onReplace,
  walletAddress,
}: {
  card: ToolCard;
  onReplace: (replacement: ToolCard) => void;
  walletAddress?: string;
}) {
  if (card.type === "tx-preview") {
    return (
      <TxPreviewCardWithSigning
        pendingTx={card.pendingTx}
        onReplace={onReplace}
        walletAddress={walletAddress}
      />
    );
  }
  if (card.type === "block") {
    return <BlockCard reasons={card.blockReasons} gates={card.blockGates} />;
  }
  if (card.type === "portfolio") {
    return <PortfolioCard {...card.portfolio} />;
  }
  if (card.type === "receipt") {
    return (
      <ReceiptCard
        txDigest={card.receipt.txDigest}
        approvedDigest={card.receipt.approvedDigest}
        blobId={card.receipt.blobId}
        anchorObjectId={card.receipt.anchorObjectId}
        status={card.receipt.status}
      />
    );
  }
  if (card.type === "wysiwys-error") {
    return (
      <div
        style={{
          maxWidth: "440px",
          borderRadius: "10px",
          border: "1px solid color-mix(in srgb, var(--destructive) 40%, transparent)",
          background: "color-mix(in srgb, var(--destructive) 5%, transparent)",
          padding: "12px 14px",
          fontSize: "13px",
          color: "var(--destructive)",
          lineHeight: 1.45,
        }}
      >
        {card.wysiwysMessage}
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// TxPreviewCardWithSigning — one hook instance per pending tx card.
//
// WHY a separate component: React's rules of hooks require hooks to be called
// unconditionally at the component level. Each tx-preview card has a different
// approvedDigest, so we need one hook instance per card. Rendering as a
// component (not inlining in CardSlot) keeps the hook call stable and
// correctly scoped to this card's approvedDigest.
// ---------------------------------------------------------------------------

function TxPreviewCardWithSigning({
  pendingTx,
  onReplace,
  walletAddress,
}: {
  pendingTx: PendingTx;
  onReplace: (replacement: ToolCard) => void;
  walletAddress?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  // Store txDigest after sign so the readiness callback can include it in the patch.
  const txDigestRef = useRef<string>("");

  const { signAndExecute } = useSignAndExecuteTx({
    approvedDigest: pendingTx.approvedDigest,
  });

  // Readiness callback: patches the receipt card in-place when blob/anchor land.
  const handleReadiness = useCallback(
    (readiness: ReceiptReadiness) => {
      onReplace({
        type: "receipt",
        receipt: {
          txDigest: txDigestRef.current,
          approvedDigest: pendingTx.approvedDigest,
          blobId: readiness.blobId,
          anchorObjectId: readiness.anchorObjectId,
          // "not_found" is a poll-only internal state; surface it as blob_only to the card.
          status: readiness.status === "not_found" ? "blob_only" : readiness.status,
        },
      });
    },
    [onReplace, pendingTx.approvedDigest],
  );

  const { submitReceipt, cancel: cancelReceipt } = useReceiptReadiness(handleReadiness);

  // Cancel any in-flight receipt poll on unmount.
  useEffect(() => cancelReceipt, [cancelReceipt]);

  async function handleConfirm() {
    setIsPending(true);
    try {
      // Pass txBytes as base64 string directly — must NOT reconstruct via
      // Transaction.from() as that changes byte layout and breaks WYSIWYS digest.
      const resp = await signAndExecute({ transaction: pendingTx.txBytes });
      const digest = (resp as { digest: string }).digest;
      txDigestRef.current = digest;

      // Render the receipt card immediately with pending status (no layout shift).
      onReplace({
        type: "receipt",
        receipt: {
          txDigest: digest,
          approvedDigest: pendingTx.approvedDigest,
          blobId: null,
          anchorObjectId: null,
          status: "pending",
        },
      });

      // Fire-and-forget the async receipt pipeline.
      // onReadiness will patch the card when blobId / anchorObjectId resolve.
      void submitReceipt({
        txDigest: digest,
        approvedDigest: pendingTx.approvedDigest,
        action: pendingTx.preview.actionLabel ?? "transfer",
        args: {
          coinTypeIn: pendingTx.preview.coinTypeIn,
          coinTypeOut: pendingTx.preview.coinTypeOut,
          amountInNative: pendingTx.preview.amountInNative,
          recipientAddress: pendingTx.preview.recipientAddress,
        },
        dryRunEffects: pendingTx.preview.balanceDeltas,
        verdict: "approved",
        walletAddress: walletAddress ?? "0x0",
      });
    } catch (err) {
      if (err instanceof WysiwysError) {
        onReplace({
          type: "wysiwys-error",
          wysiwysMessage:
            "Transaction bytes changed since Guardian approval — blocked for your safety. " +
            "Please start a new transaction.",
        });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        onReplace({ type: "wysiwys-error", wysiwysMessage: `Signing failed: ${msg}` });
      }
    } finally {
      setIsPending(false);
    }
  }

  function handleCancel() {
    cancelReceipt();
    onReplace({ type: "wysiwys-error", wysiwysMessage: "Transaction cancelled." });
  }

  return (
    <TxPreviewCard
      preview={pendingTx.preview}
      isPending={isPending}
      onConfirm={() => void handleConfirm()}
      onCancel={handleCancel}
    />
  );
}
