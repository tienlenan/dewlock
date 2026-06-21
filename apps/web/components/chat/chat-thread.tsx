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
import { Streamdown } from "streamdown";
import { PortfolioCard } from "@/components/portfolio-card";
import { ReceiptCard, type ReceiptStatus } from "@/components/receipt-card";
import { ProtocolList, type ApiResponse as ProtocolsData } from "@/components/protocols/protocol-list";
import { SwapOptionsCard, type SwapOptionsData } from "@/components/chat/swap-options-card";
import { LendOptionsCard, type LendOptionsData } from "@/components/chat/lend-options-card";
import { SwapFormCard, type SwapFormData } from "@/components/chat/swap-form-card";
import { LimitOrderFormCard, type LimitOrderFormData } from "@/components/chat/limit-order-form-card";
import { ActionFormCard, type ActionFormData } from "@/components/chat/action-form-card";
import { ContactPickerCard, type ContactPickerData } from "@/components/chat/contact-picker-card";
import { ReceiveCard, type ReceiveCardData } from "@/components/receive-card";
import { AgentThinkingLoader } from "@/components/chat/agent-thinking-loader";
import { EcosystemYieldsCard } from "@/components/chat/ecosystem-yields-card";
import { EcosystemTvlCard } from "@/components/chat/ecosystem-tvl-card";
import { EcosystemTokensCard } from "@/components/chat/ecosystem-tokens-card";
import { ProfileChatCard } from "@/components/dashboard/profile-chat-card";
import { ProtocolMetricsSection } from "@/components/dashboard/protocol-metrics-section";
import type { UserStatsData, BadgeStateDto } from "@/components/dashboard/types";
import {
  MemoryChip,
  useRecalledMemory,
  buildRecalledChips,
} from "@/components/app/memory-chip";
import type { TxPreviewData } from "@/components/tx-preview-card";
import type { PortfolioCardProps } from "@/components/portfolio-card";
import { useSignAndExecuteTx, WysiwysError } from "@/lib/use-sign-and-execute-tx";
import { emitTxConfirmed } from "@/lib/tx-events";
import { useReceiptStream } from "./use-receipt-stream";
import { ReceiptProgressInline } from "./receipt-progress-inline";
import { WelcomeActions } from "./welcome-actions";
import { SupportedProtocolsCard } from "./supported-protocols-card";
import {
  DefiPositionsSection,
  type DefiPositionsData,
} from "@/components/app/defi-positions-section";
import { BmOnboardingCard } from "@/components/app/bm-onboarding-card";

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
  /** Resolved Sui object (HEAD anchor or on-chain Walrus Blob object). */
  suiObjectId?: string | null;
  /** Async receipt pipeline status. */
  status?: ReceiptStatus;
}

export type ToolCard =
  | { type: "tx-preview"; pendingTx: PendingTx }
  | { type: "block"; blockReasons: string[]; blockGates: string[] }
  | { type: "portfolio"; portfolio: PortfolioCardProps }
  | { type: "protocols"; protocols: ProtocolsData }
  | { type: "swap-options"; swapOptions: SwapOptionsData }
  | { type: "lend-options"; lendOptions: LendOptionsData }
  | { type: "swap-form"; swapForm: SwapFormData }
  | { type: "limit-order-form"; limitOrderForm: LimitOrderFormData }
  | { type: "action-form"; form: ActionFormData }
  | { type: "contact-picker"; picker: ContactPickerData }
  | { type: "receive"; receive: ReceiveCardData }
  | {
      type: "user-stats";
      userStats: { stats: UserStatsData; badges: { earned: BadgeStateDto[]; locked: BadgeStateDto[] } };
    }
  | { type: "protocol-metrics" }
  // Read-only Sui-ecosystem discovery cards — each self-fetches its /api/ecosystem/* route.
  | { type: "ecosystem-yields" }
  | { type: "ecosystem-tvl" }
  | { type: "ecosystem-tokens" }
  | { type: "receipt"; receipt: TxReceipt }
  | { type: "wysiwys-error"; wysiwysMessage: string }
  /**
   * agent-error: shown when the streaming request fails (network error,
   * gateway timeout, 429, etc.). Separate from wysiwys-error to enable
   * a retry action without discarding the conversation.
   */
  | { type: "agent-error"; message: string; retryable: boolean }
  /** DeepBook order lifecycle + lending positions card */
  | { type: "defi-positions"; positions: DefiPositionsData }
  /** Two-step BalanceManager onboarding (shown when onboarding_required gate fires) */
  | { type: "bm-onboarding"; walletAddress: string };

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
  /** Send a new chat message — used by card quick-actions (e.g. portfolio row sell/send). */
  onSend?: (text: string) => void;
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
// Prepare-trade result shapes (duplicated minimally from use-copilot-chat for
// the inline prepare→preview flow; no NL round needed).
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

// ---------------------------------------------------------------------------
// Optimistic-hide record — tracks acted rows with a timestamp so we can
// suppress indexer-lag resurrections within a bounded window (~12 s).
// ---------------------------------------------------------------------------

interface HiddenEntry { hiddenAt: number }

function isStillHidden(entry: HiddenEntry, WINDOW_MS = 12_000): boolean {
  return Date.now() - entry.hiddenAt < WINDOW_MS;
}

// ---------------------------------------------------------------------------
// DefiPositionsCardWithActions — self-contained card that owns:
//   • optimistic hide state (hiddenOrderIds / hiddenCoinKeys)
//   • inline prepare→preview→sign loop (cancel / withdraw)
//   • onboarding_required → replaces card with bm-onboarding via onReplace
// ---------------------------------------------------------------------------

function DefiPositionsCardWithActions({
  positions,
  walletAddress,
  onReplace,
}: {
  positions: DefiPositionsData;
  walletAddress?: string;
  onReplace: (card: ToolCard) => void;
}) {
  // hidden order ids: Map<orderId, HiddenEntry>
  const [hiddenOrders, setHiddenOrders] = useState<Map<string, HiddenEntry>>(new Map());
  // hidden coin keys: Map<coinKey, HiddenEntry>
  const [hiddenCoins, setHiddenCoins] = useState<Map<string, HiddenEntry>>(new Map());

  // inline pending tx (cancel / withdraw)
  const [inlineTx, setInlineTx] = useState<PrepareTradePass | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  // Context needed to optimistic-hide after signing
  // Keys are scoped per-BM: `${balanceManagerId}:${orderId}` and `${balanceManagerId}:${coinKey}`
  const pendingActionRef = useRef<
    | { kind: "order"; scopedKey: string }
    | { kind: "coin"; scopedKey: string }
    | null
  >(null);

  // ── Derive visible sets (keys scoped per-BM: `${bmId}:${orderId}` etc.) ──

  const hiddenOrderIds = new Set(
    [...hiddenOrders.entries()]
      .filter(([, e]) => isStillHidden(e))
      .map(([id]) => id),
  );
  const hiddenCoinKeys = new Set(
    [...hiddenCoins.entries()]
      .filter(([, e]) => isStillHidden(e))
      .map(([key]) => key),
  );

  // ── prepareAndPreview ────────────────────────────────────────────────────

  const prepareAndPreview = useCallback(
    async (body: Record<string, unknown>) => {
      if (!walletAddress) return;
      setPreparing(true);
      setInlineError(null);
      try {
        const res = await fetch("/api/prepare-trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, ...body }),
        });
        const data = (await res.json()) as PrepareTradeResult;
        if (!data.ok) {
          const block = data as PrepareTradeBlock;
          // onboarding_required → swap this card for the BM onboarding flow
          if (block.gates.includes("onboarding_required")) {
            onReplace({ type: "bm-onboarding", walletAddress });
            return;
          }
          setInlineError(block.reasons.join("; "));
          return;
        }
        setInlineTx(data as PrepareTradePass);
      } catch (e) {
        setInlineError(e instanceof Error ? e.message : "Network error");
      } finally {
        setPreparing(false);
      }
    },
    [walletAddress, onReplace],
  );

  // ── Cancel handler ────────────────────────────────────────────────────────

  const handleCancel = useCallback(
    (orderId: string, poolKey: string, balanceManagerId: string, coinTypeIn: string) => {
      // Scope the hide key per-BM so cancelling an order in one account
      // doesn't hide the same orderId in another account.
      pendingActionRef.current = { kind: "order", scopedKey: `${balanceManagerId}:${orderId}` };
      void prepareAndPreview({
        actionType: "cancel_order",
        poolKey,
        orderId,
        balanceManagerId,
        coinTypeIn,
      });
    },
    [prepareAndPreview],
  );

  // ── Withdraw handler ──────────────────────────────────────────────────────

  const handleWithdraw = useCallback(
    (coinType: string, _coinSymbol: string, humanAmount: string, balanceManagerId: string) => {
      // Find coinKey for this coinType in the specific BM to optimistic-hide the row.
      // Scoped per-BM so hiding a coin in one account doesn't affect another.
      const bm = positions.deepbook.balanceManagers.find(
        (b) => b.balanceManagerId === balanceManagerId,
      );
      const bal = bm?.settledBalances.find((b) => b.coinType === coinType);
      if (bal) {
        pendingActionRef.current = {
          kind: "coin",
          scopedKey: `${balanceManagerId}:${bal.coinKey}`,
        };
      }

      // Convert human amount → native units
      const DECIMALS: Record<string, number> = {
        "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI": 9,
        "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": 6,
        "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP": 6,
      };
      const decimals = DECIMALS[coinType] ?? 9;
      const amountInNative = BigInt(
        Math.round(parseFloat(humanAmount) * 10 ** decimals),
      ).toString();

      void prepareAndPreview({
        actionType: "withdraw_settled",
        coinTypeIn: coinType,
        amountInNative,
        balanceManagerId,
        argProvenance: { amount: "user_turn" },
      });
    },
    [positions.deepbook.balanceManagers, prepareAndPreview],
  );

  // ── Claim settled handler ─────────────────────────────────────────────────
  // Settle filled/owed balances pool→BM (no amount/coin — the server settles every pool
  // that owes this BM). Funds then surface as Available and withdraw via the normal flow.

  const handleClaim = useCallback(
    (_coinType: string, _coinSymbol: string, balanceManagerId: string) => {
      void prepareAndPreview({
        actionType: "claim_settled",
        balanceManagerId,
        argProvenance: {},
      });
    },
    [prepareAndPreview],
  );

  // ── Inline sign success → optimistic hide ─────────────────────────────────

  const handleSignSuccess = useCallback(() => {
    const action = pendingActionRef.current;
    if (action?.kind === "order") {
      setHiddenOrders((prev) => new Map(prev).set(action.scopedKey, { hiddenAt: Date.now() }));
    }
    if (action?.kind === "coin") {
      setHiddenCoins((prev) => new Map(prev).set(action.scopedKey, { hiddenAt: Date.now() }));
    }
    pendingActionRef.current = null;
    setInlineTx(null);
    emitTxConfirmed();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
      <DefiPositionsSection
        data={positions}
        hiddenOrderIds={hiddenOrderIds}
        hiddenCoinKeys={hiddenCoinKeys}
        onCancel={handleCancel}
        onWithdraw={handleWithdraw}
        onClaim={handleClaim}
      />

      {/* Preparing spinner */}
      {preparing && (
        <p
          className="split-mono"
          style={{ fontSize: 11, color: "var(--fg-muted)", margin: 0 }}
        >
          Preparing transaction…
        </p>
      )}

      {/* Inline error */}
      {inlineError && !preparing && (
        <div
          style={{
            maxWidth: 440,
            borderRadius: 10,
            border: "1px solid color-mix(in srgb, var(--destructive) 40%, transparent)",
            background: "color-mix(in srgb, var(--destructive) 5%, transparent)",
            padding: "10px 13px",
            fontSize: 12.5,
            color: "var(--destructive)",
          }}
        >
          {inlineError}
        </div>
      )}

      {/* Inline tx preview + sign */}
      {inlineTx && (
        <InlineTxSign
          prepared={inlineTx}
          walletAddress={walletAddress}
          onSuccess={handleSignSuccess}
          onCancel={() => {
            setInlineTx(null);
            pendingActionRef.current = null;
          }}
          onError={(msg) => {
            setInlineTx(null);
            pendingActionRef.current = null;
            setInlineError(msg);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineTxSign — one hook instance per inline tx (rules-of-hooks safe).
// ---------------------------------------------------------------------------

function InlineTxSign({
  prepared,
  walletAddress,
  onSuccess,
  onCancel,
  onError,
}: {
  prepared: PrepareTradePass;
  walletAddress?: string;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const { signAndExecute } = useSignAndExecuteTx({ approvedDigest: prepared.approvedDigest });

  const handleConfirm = useCallback(async () => {
    setIsPending(true);
    try {
      await signAndExecute({ transaction: prepared.txBytes });
      onSuccess();
    } catch (err) {
      const msg =
        err instanceof WysiwysError
          ? "Transaction bytes changed since Guardian approval — blocked for safety."
          : err instanceof Error
          ? err.message
          : String(err);
      onError(msg);
    } finally {
      setIsPending(false);
    }
  }, [signAndExecute, prepared.txBytes, onSuccess, onError]);

  return (
    <TxPreviewCard
      preview={prepared.preview}
      isPending={isPending}
      onConfirm={() => void handleConfirm()}
      onCancel={onCancel}
    />
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function ChatThread({ messages, onReplaceCard, walletAddress, onSend }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    /*
     * role="log" + aria-live="polite": announces new messages to screen readers
     * without interrupting ongoing speech (polite = waits for current utterance).
     * aria-label provides a descriptive region name for AT landmark navigation.
     */
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation"
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
        {/* Welcome + action cards + memory chips — shown on empty thread */}
        <WelcomeRow showMemory={isEmpty} walletAddress={walletAddress} onSend={onSend} />

        {/* Message list */}
        {messages.map((msg) => (
          <MessageRow
            key={msg.id}
            message={msg}
            onReplaceCard={onReplaceCard}
            walletAddress={walletAddress}
            onSend={onSend}
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

function WelcomeRow({
  showMemory,
  walletAddress,
  onSend,
}: {
  showMemory: boolean;
  walletAddress?: string;
  onSend?: (text: string) => void;
}) {
  // Fetch recalled memory from memwal via /api/memory-recall.
  // Returns null while loading; { hasReal: false } when memwal not configured.
  const recalled = useRecalledMemory(walletAddress);

  // Only show memory chips when memwal returned REAL recalled preferences.
  // No sample/fabricated chips — an honest generic line is shown otherwise.
  const chips = recalled?.hasReal ? buildRecalledChips(recalled) : [];
  const isReal = Boolean(recalled?.hasReal);

  return (
    <div className="flex gap-3">
      <DewdropAvatar />
      <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
        <div style={{ fontSize: "14.5px", lineHeight: 1.55, color: "var(--fg)" }}>
          Hi — I'm your Dewlock copilot. Tell me what you want to do in plain language.
          I build one unsigned transaction; the Guardian re-derives and dry-runs it before{" "}
          <strong>you</strong> sign.
        </div>

        {/* Default action cards + supported protocols — empty thread only */}
        {showMemory && (
          <>
            <WelcomeActions onSend={onSend} />
            <SupportedProtocolsCard onSend={onSend} />
          </>
        )}

        {showMemory && isReal && chips.length > 0 && (
          <>
            {/* Real recalled memory — only shown when memwal returned data */}
            <div style={{ marginTop: 7, fontSize: "12.5px", color: "var(--fg-muted)" }}>
              I recall your preferences from memory:
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {chips.map((chip) => (
                <MemoryChip key={chip} text={chip} />
              ))}
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
  onSend,
}: {
  message: ChatMessage;
  onReplaceCard: (messageId: string, cardIndex: number, replacement: ToolCard) => void;
  walletAddress?: string;
  onSend?: (text: string) => void;
}) {
  const isUser = message.role === "user";

  // Detect if this assistant message has a block card — use blocked avatar
  const cards = message.cards ?? [];
  const hasBlock = cards.some((c) => c.type === "block");

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
            // Break long unbroken tokens (0x addresses, hashes) so they wrap
            // inside the bubble instead of overflowing it.
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
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
        {/* "Thinking" gap — shown after the request is sent but before the first
            token or card lands. A random dot-matrix loader fills the wait. */}
        {message.streaming && !message.text && cards.length === 0 ? (
          <div style={{ display: "flex", alignItems: "flex-end", minHeight: 30, marginTop: -4, marginBottom: 10 }}>
            <AgentThinkingLoader />
          </div>
        ) : (
          /* Assistant text — rendered as streaming markdown (Streamdown handles
             incomplete markdown mid-stream); the blinking cursor follows while streaming. */
          (message.text || message.streaming) && (
            <div className="dewlock-md" style={{ fontSize: "14px", color: "var(--fg)", marginBottom: 10, lineHeight: 1.55, overflowWrap: "anywhere" }}>
              {message.text && <Streamdown>{message.text}</Streamdown>}
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
          )
        )}

        {/* Tool cards */}
        {cards.map((card, idx) => (
          <CardSlot
            key={idx}
            card={card}
            onReplace={(replacement) => onReplaceCard(message.id, idx, replacement)}
            walletAddress={walletAddress}
            onSend={onSend}
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
  onSend,
}: {
  card: ToolCard;
  onReplace: (replacement: ToolCard) => void;
  walletAddress?: string;
  onSend?: (text: string) => void;
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
    // When the only gate is onboarding_required, surface the BM setup wizard
    // instead of a plain block message — the user can act immediately.
    if (card.blockGates.includes("onboarding_required") && walletAddress) {
      return <BmOnboardingCard walletAddress={walletAddress} />;
    }
    return <BlockCard reasons={card.blockReasons} gates={card.blockGates} />;
  }
  if (card.type === "portfolio") {
    return (
      <PortfolioCard
        {...card.portfolio}
        onAction={
          onSend
            ? (kind, ticker) =>
                // Swap → open the swap form (user picks amount); never auto "sell all".
                onSend(kind === "swap" ? `swap ${ticker}` : `Send ${ticker}`)
            : undefined
        }
      />
    );
  }
  if (card.type === "protocols") {
    return <ProtocolList data={card.protocols} />;
  }
  if (card.type === "swap-options") {
    return <SwapOptionsCard data={card.swapOptions} />;
  }
  if (card.type === "lend-options") {
    const lo = card.lendOptions;
    return (
      <LendOptionsCard
        data={lo}
        onChoose={
          onSend
            ? (protocol) => {
                const verb = lo.verb === "repay" ? "repay" : "deposit";
                const amt = lo.amountHuman ? `${lo.amountHuman} ` : "";
                onSend(`${verb} ${amt}${lo.coinSymbol} to ${protocol}`);
              }
            : undefined
        }
      />
    );
  }
  if (card.type === "limit-order-form") {
    return <LimitOrderFormCard data={card.limitOrderForm} onSend={onSend} />;
  }
  if (card.type === "swap-form") {
    return <SwapFormCard data={card.swapForm} onSend={onSend} />;
  }
  if (card.type === "action-form") {
    return <ActionFormCard form={card.form} onSend={onSend} />;
  }
  if (card.type === "contact-picker") {
    return <ContactPickerCard data={card.picker} onSend={onSend} />;
  }
  if (card.type === "receive") {
    return <ReceiveCard data={card.receive} />;
  }
  if (card.type === "user-stats") {
    // Self-fetches the durable profile for the connected wallet (real level/badges).
    return <ProfileChatCard walletAddress={walletAddress} />;
  }
  if (card.type === "protocol-metrics") {
    // Self-fetches /api/metrics for live TVL (registry counts come from the tool result).
    return <ProtocolMetricsSection />;
  }
  if (card.type === "ecosystem-yields") {
    return <EcosystemYieldsCard />;
  }
  if (card.type === "ecosystem-tvl") {
    return <EcosystemTvlCard />;
  }
  if (card.type === "ecosystem-tokens") {
    return <EcosystemTokensCard />;
  }
  if (card.type === "receipt") {
    return (
      <ReceiptCard
        txDigest={card.receipt.txDigest}
        approvedDigest={card.receipt.approvedDigest}
        blobId={card.receipt.blobId}
        anchorObjectId={card.receipt.anchorObjectId}
        suiObjectId={card.receipt.suiObjectId}
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
  if (card.type === "agent-error") {
    return (
      <div
        role="alert"
        style={{
          maxWidth: "440px",
          borderRadius: "10px",
          border: "1px solid color-mix(in srgb, var(--destructive) 30%, transparent)",
          background: "color-mix(in srgb, var(--destructive) 4%, var(--bg-elev))",
          padding: "12px 14px",
          fontSize: "13px",
          lineHeight: 1.5,
        }}
      >
        <div style={{ color: "var(--destructive)", fontWeight: 600, marginBottom: 4 }}>
          {card.retryable ? "Request failed — try again" : "Error"}
        </div>
        <div style={{ color: "var(--fg-muted)" }}>{card.message}</div>
        {card.retryable && (
          <div style={{ marginTop: 8, fontSize: "12px", color: "var(--fg-faint)" }}>
            Use the input below to resend your message.
          </div>
        )}
      </div>
    );
  }
  if (card.type === "defi-positions") {
    return (
      <DefiPositionsCardWithActions
        positions={card.positions}
        walletAddress={walletAddress}
        onReplace={onReplace}
      />
    );
  }
  if (card.type === "bm-onboarding") {
    return <BmOnboardingCard walletAddress={card.walletAddress} />;
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

  // SSE receipt pipeline — streams live per-step progress into the dialog.
  const receiptStream = useReceiptStream();

  // Reset the stream on unmount (aborts the fetch reader).
  useEffect(() => receiptStream.reset, [receiptStream.reset]);

  // Commits the final receipt card into the thread (it replaces THIS component,
  // ending the inline progress). Called automatically once the pipeline finishes.
  const commitReceipt = useCallback(() => {
    const r = receiptStream.state.result;
    onReplace({
      type: "receipt",
      receipt: {
        txDigest: txDigestRef.current,
        approvedDigest: pendingTx.approvedDigest,
        blobId: r?.blobId ?? null,
        anchorObjectId: r?.anchorObjectId ?? null,
        suiObjectId: r?.suiObjectId ?? null,
        status: r?.status ?? "blob_only",
      },
    });
    receiptStream.reset();
  }, [receiptStream, onReplace, pendingTx.approvedDigest]);

  // Auto-commit ~1.4s after the pipeline settles — long enough to read the final
  // "saved" state, then the inline progress resolves into the durable receipt card.
  // Ref-indirected so commitReceipt's changing identity can't reschedule the timer.
  const commitRef = useRef(commitReceipt);
  commitRef.current = commitReceipt;
  const finished =
    !receiptStream.state.active &&
    (receiptStream.state.result !== null || receiptStream.state.error !== null);
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => commitRef.current(), 1400);
    return () => clearTimeout(t);
  }, [finished]);

  async function handleConfirm() {
    setIsPending(true);
    try {
      // Pass txBytes as base64 string directly — must NOT reconstruct via
      // Transaction.from() as that changes byte layout and breaks WYSIWYS digest.
      const resp = await signAndExecute({ transaction: pendingTx.txBytes });
      const digest = (resp as { digest: string }).digest;
      txDigestRef.current = digest;

      // Tell balance views to refetch — the wallet balance changed on-chain.
      emitTxConfirmed();

      // Stream the receipt pipeline (blob → memwal XP → profile → anchor) into the
      // inline progress panel below the card. The receipt card is committed to the
      // thread automatically once the pipeline finishes (commitReceipt).
      void receiptStream.start({
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
        // Real USD value (Guardian trusted-price valuation) → recorded in the action log
        // so "today via Dewlock" volume + this receipt's USD aren't $0.
        estimatedUsdValue: pendingTx.preview.estimatedUsdValue ?? 0,
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
    receiptStream.reset();
    onReplace({ type: "wysiwys-error", wysiwysMessage: "Transaction cancelled." });
  }

  const showProgress =
    receiptStream.state.active ||
    receiptStream.state.result !== null ||
    receiptStream.state.error !== null ||
    receiptStream.state.steps.length > 0;

  return (
    <>
      <TxPreviewCard
        preview={pendingTx.preview}
        // Lock the card once the pipeline starts — its Confirm/Cancel must not
        // re-fire while the receipt streams below it.
        isPending={isPending || showProgress}
        onConfirm={() => void handleConfirm()}
        onCancel={handleCancel}
      />
      {showProgress && <ReceiptProgressInline state={receiptStream.state} />}
    </>
  );
}
