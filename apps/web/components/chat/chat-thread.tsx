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
import { TxRebuildCard } from "@/components/tx-rebuild-card";
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
import { ChainPlanCard, isAtomicEligible } from "@/components/chat/chain-plan-card";
import { splitMessageByContacts } from "@/lib/chat/resolve-message-contacts";
import { truncateAddress } from "@/lib/chat/recipient-detect";
import { resolveSuinsAddress, looksLikeSuinsName } from "@/lib/contacts/suins-forward";
import { useSuiClient } from "@mysten/dapp-kit";
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
import { friendlySignError, isRetryableStaleSignError } from "@/lib/sign-error-message";
import { emitTxConfirmed } from "@/lib/tx-events";
import { useLivePositions } from "@/lib/use-live-positions";
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

/**
 * When a tx-preview card is issued for a chain step, this tag lets the sign
 * handler call back into the chain stepper on confirm/block instead of just
 * replacing the card with a receipt.  The signing path checks this field and
 * fires the appropriate stepper callback after the wallet responds.
 */
export interface ChainStepContext {
  planId: string;
  stepIndex: number;
  /** Fully-qualified coin type produced by this step (e.g. USDC from swap). */
  outputCoinType: string | null;
}

export type ToolCard =
  | {
      type: "tx-preview";
      pendingTx: PendingTx;
      rebuildCommand?: string;
      /** Present only when this tx is step k of a sequential chain plan. */
      chainContext?: ChainStepContext;
    }
  // tx-rebuild: what a reloaded conversation shows where a tx-preview was. We never
  // persist signable bytes, so it carries only the command to re-issue → fresh preview.
  | { type: "tx-rebuild"; command: string; label: string }
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
  /** Sequential multi-step chain plan (Track A) — drives N-sign cycle. */
  | { type: "chain-plan"; plan: import("@/components/chat/chain-plan-card").ChainPlanData }
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

/**
 * Callbacks for the sequential chain signing loop.
 * Provided by the parent (app/page.tsx) which owns the useChainPlanStepper instance.
 */
export interface ChainSignCallbacks {
  /**
   * Called when the user clicks "Prepare Step N" on a chain-plan card.
   * The chain stepper snapshots balances, waits for stale objects, composes the
   * command, and re-submits it via sendMessage.
   */
  onStartChainStep: (
    planId: string,
    stepIndex: number,
    plan: import("@/components/chat/chain-plan-card").ChainPlanData,
  ) => void;

  /**
   * Called by TxPreviewCardWithSigning after a chain step's tx confirms on-chain.
   * The chain stepper reads the post-balance delta and surfaces the resolved amount.
   */
  onChainStepConfirmed: (
    planId: string,
    stepIndex: number,
    txDigest: string,
    touchedObjIds: string[],
    outputCoinType: string | null,
  ) => void;

  /**
   * Called when a chain step is blocked by Guardian or sign-rejected by the wallet.
   * Halts the chain and marks subsequent steps cancelled.
   */
  onChainStepBlocked: (
    planId: string,
    stepIndex: number,
    reasons: string[],
  ) => void;

  /**
   * Called when a chain step's sign failed with a TRANSIENT, retry-able error (the
   * prepared bytes went stale because a prior step changed the coin objects). Unlike
   * onChainStepBlocked, this does NOT halt the chain — it resets the step to "pending"
   * so the user can re-prepare it for a fresh build.
   */
  onChainStepStale?: (planId: string, stepIndex: number) => void;
}

interface ChatThreadProps {
  messages: ChatMessage[];
  onReplaceCard: (messageId: string, cardIndex: number, replacement: ToolCard) => void;
  /** Signer's public wallet address — used to key the Sui receipt anchor HEAD. */
  walletAddress?: string;
  /** Send a new chat message — used by card quick-actions (e.g. portfolio row sell/send). */
  onSend?: (text: string) => void;
  /** Chain-plan signing loop callbacks. Absent = chain-plan cards render read-only. */
  chainCallbacks?: ChainSignCallbacks;
  /** Saved friend book — annotates contact names in user bubbles with their address. */
  contacts?: { name: string; address: string }[];
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

  // LIVE data — never the static tool-result snapshot. Reloads on mount + after every
  // confirmed tx so a withdraw/cancel/claim can't leave a stale balance to re-act on.
  const livePositions = useLivePositions(positions, walletAddress);

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
      const bm = livePositions.deepbook.balanceManagers.find(
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
    [livePositions.deepbook.balanceManagers, prepareAndPreview],
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
        data={livePositions}
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
            minWidth: 0,
            borderRadius: 10,
            border: "1px solid color-mix(in srgb, var(--destructive) 40%, transparent)",
            background: "color-mix(in srgb, var(--destructive) 5%, transparent)",
            padding: "10px 13px",
            fontSize: 12.5,
            color: "var(--destructive)",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
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
          : friendlySignError(err instanceof Error ? err.message : String(err));
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

export function ChatThread({ messages, onReplaceCard, walletAddress, onSend, chainCallbacks, contacts = [] }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    /*
     * role="log" + aria-live="polite": announces new messages to screen readers
     * without interrupting ongoing speech (polite = waits for current utterance).
     * The in-progress chain-plan card simply renders inline as the last message —
     * no sticky/fixed slot (that broke the layout); being the last message keeps it
     * naturally pinned at the bottom while the chain runs.
     */
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      className="flex-1"
      style={{
        overflowY: "auto",
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
            chainCallbacks={chainCallbacks}
            contacts={contacts}
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

/** Render a user message with each saved-contact name annotated as "Name (0x1234…)" so the
 *  bubble shows who a "send … to Alice, Bob" actually targets. Display-only — the Guardian
 *  re-resolves the recipient server-side at send time. */
function UserMessageText({
  text,
  contacts,
}: {
  text: string;
  contacts: { name: string; address: string }[];
}) {
  const segments = splitMessageByContacts(text, contacts);
  return (
    <>
      {segments.map((seg, i) =>
        typeof seg === "string" ? (
          <span key={i}>{seg}</span>
        ) : (
          <span key={i}>
            {seg.name}
            <span style={{ opacity: 0.6, fontSize: "0.92em" }}> ({truncateAddress(seg.address)})</span>
          </span>
        ),
      )}
    </>
  );
}

function MessageRow({
  message,
  onReplaceCard,
  walletAddress,
  onSend,
  chainCallbacks,
  contacts = [],
}: {
  message: ChatMessage;
  onReplaceCard: (messageId: string, cardIndex: number, replacement: ToolCard) => void;
  walletAddress?: string;
  onSend?: (text: string) => void;
  chainCallbacks?: ChainSignCallbacks;
  contacts?: { name: string; address: string }[];
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
          <UserMessageText text={message.text} contacts={contacts} />
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
            chainCallbacks={chainCallbacks}
            contacts={contacts}
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
  chainCallbacks,
  contacts = [],
}: {
  card: ToolCard;
  onReplace: (replacement: ToolCard) => void;
  walletAddress?: string;
  onSend?: (text: string) => void;
  chainCallbacks?: ChainSignCallbacks;
  contacts?: { name: string; address: string }[];
}) {
  if (card.type === "tx-preview") {
    return (
      <TxPreviewCardWithSigning
        pendingTx={card.pendingTx}
        onReplace={onReplace}
        walletAddress={walletAddress}
        chainContext={card.chainContext}
        onChainStepConfirmed={chainCallbacks?.onChainStepConfirmed}
        onChainStepBlocked={chainCallbacks?.onChainStepBlocked}
        onChainStepStale={chainCallbacks?.onChainStepStale}
      />
    );
  }
  if (card.type === "tx-rebuild") {
    // Re-issue the original command → fresh prepareTrade → fresh, re-checked tx-preview.
    return <TxRebuildCard label={card.label} onRebuild={() => onSend?.(card.command)} />;
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
          minWidth: 0,
          borderRadius: "10px",
          border: "1px solid color-mix(in srgb, var(--destructive) 40%, transparent)",
          background: "color-mix(in srgb, var(--destructive) 5%, transparent)",
          padding: "12px 14px",
          fontSize: "13px",
          color: "var(--destructive)",
          lineHeight: 1.45,
          // Long 0x object ids / addresses in a raw error must wrap, not overflow the card.
          overflowWrap: "anywhere",
          wordBreak: "break-word",
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
  if (card.type === "chain-plan") {
    return (
      <ChainPlanWithComposite
        plan={card.plan}
        onStartStep={
          chainCallbacks
            ? (stepIndex) =>
                chainCallbacks.onStartChainStep(
                  card.plan.originalText,
                  stepIndex,
                  card.plan,
                )
            : undefined
        }
        onReplace={onReplace}
        walletAddress={walletAddress}
        chainCallbacks={chainCallbacks}
        contacts={contacts}
      />
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
  chainContext,
  onChainStepConfirmed,
  onChainStepBlocked,
  onChainStepStale,
}: {
  pendingTx: PendingTx;
  onReplace: (replacement: ToolCard) => void;
  walletAddress?: string;
  /** Present when this tx-preview belongs to a chain step. */
  chainContext?: ChainStepContext;
  onChainStepConfirmed?: ChainSignCallbacks["onChainStepConfirmed"];
  onChainStepBlocked?: ChainSignCallbacks["onChainStepBlocked"];
  onChainStepStale?: ChainSignCallbacks["onChainStepStale"];
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

      // If this tx belongs to a chain step, notify the stepper so it can read the
      // post-balance delta and resolve the next step's amount before the user clicks
      // "Prepare Step N+1". The normal receipt flow still runs below — the step's
      // receipt card will appear in the thread as usual.
      if (chainContext && onChainStepConfirmed) {
        // Extract touched object IDs from the balance deltas if available.
        // The preview's balanceDeltas contain coin object mutations from the dry-run.
        const touchedObjIds = extractTouchedObjectIds(pendingTx.preview.balanceDeltas);
        onChainStepConfirmed(
          chainContext.planId,
          chainContext.stepIndex,
          digest,
          touchedObjIds,
          chainContext.outputCoinType,
        );
      }

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
        // WYSIWYS: bytes changed since Guardian approval — block the chain step too.
        if (chainContext && onChainStepBlocked) {
          onChainStepBlocked(chainContext.planId, chainContext.stepIndex, [
            "Transaction bytes changed since Guardian approval — blocked for safety.",
          ]);
        }
        onReplace({
          type: "wysiwys-error",
          wysiwysMessage:
            "Transaction bytes changed since Guardian approval — blocked for your safety. " +
            "Please start a new transaction.",
        });
      } else {
        const raw = err instanceof Error ? err.message : String(err);
        const msg = friendlySignError(raw);
        if (chainContext && isRetryableStaleSignError(raw) && onChainStepStale) {
          // TRANSIENT: the prepared bytes went stale because the prior step changed the
          // coin objects (RPC lag). Do NOT halt the chain — the parent resets the step and
          // AUTO-rebuilds it with FRESH bytes (the stale ones are never resent, so a coin is
          // never equivocated). Show a calm, non-alarming note instead of the scary stale
          // error; if the auto-rebuild gives up, the "Prepare Step N" button remains.
          onChainStepStale(chainContext.planId, chainContext.stepIndex);
          onReplace({
            type: "wysiwys-error",
            wysiwysMessage:
              "Balances moved after the previous step — rebuilding this step with fresh balances. " +
              "A new confirmation should appear shortly; if it doesn't, click “Prepare Step " +
              `${chainContext.stepIndex + 1}” on the plan above to rebuild it.`,
          });
        } else if (chainContext && onChainStepBlocked) {
          // Terminal failure (e.g. user cancelled the wallet popup) → halt the chain.
          onChainStepBlocked(chainContext.planId, chainContext.stepIndex, [msg]);
          onReplace({ type: "wysiwys-error", wysiwysMessage: msg });
        } else {
          onReplace({ type: "wysiwys-error", wysiwysMessage: msg });
        }
      }
    } finally {
      setIsPending(false);
    }
  }

  function handleCancel() {
    receiptStream.reset();
    // User explicitly cancelled — halt the chain at this step.
    if (chainContext && onChainStepBlocked) {
      onChainStepBlocked(chainContext.planId, chainContext.stepIndex, [
        "Transaction cancelled by user.",
      ]);
    }
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

// ---------------------------------------------------------------------------
// extractTouchedObjectIds — extract coin object IDs mutated by a tx.
//
// WHY: waitForObjectVersions (plan-stepper) needs the object IDs that were
// consumed/created by step k so step k+1's builder doesn't pick stale versions.
// The Guardian's dry-run balanceDeltas carry coin object IDs in their change
// records. We extract them here so the chain stepper can wait for them.
//
// Falls back to [] when balanceDeltas is absent/unstructured — the stale-object
// wait is best-effort; the worst outcome is a 0.5 s extra delay, not a failure.
// ---------------------------------------------------------------------------

function extractTouchedObjectIds(
  balanceDeltas: unknown,
): string[] {
  if (!balanceDeltas || !Array.isArray(balanceDeltas)) return [];
  const ids: string[] = [];
  for (const delta of balanceDeltas) {
    if (typeof delta === "object" && delta !== null) {
      const d = delta as Record<string, unknown>;
      // balanceDeltas entries may carry an objectId field from the dry-run effects.
      if (typeof d.objectId === "string") ids.push(d.objectId);
      if (typeof d.coinObjectId === "string") ids.push(d.coinObjectId);
    }
  }
  return [...new Set(ids)]; // deduplicate
}

// ---------------------------------------------------------------------------
// ChainPlanWithComposite — wraps ChainPlanCard and handles the atomic toggle.
//
// WHY a wrapper: ChainPlanCard is a pure display component; the composite-build
// logic needs fetch + state, which would violate rules-of-hooks if inlined into
// CardSlot (a conditional branch). Extracting as a component keeps hooks stable.
//
// Atomic flow:
//  1. User clicks "Run as 1 transaction (atomic)" → handleRunAtomic fires.
//  2. Parse the chain plan steps → compositeLegs (swap leg + lend leg).
//  3. POST /api/prepare-trade with actionType "composite".
//  4. On PASS: call onReplace with a tx-preview card (same sign flow as any tx).
//  5. On BLOCK: surface a brief error note; the sequential plan card remains visible
//     so the user can fall back to step-by-step.
// ---------------------------------------------------------------------------

function ChainPlanWithComposite({
  plan,
  onStartStep,
  onReplace,
  walletAddress,
  chainCallbacks,
  contacts = [],
}: {
  plan: import("@/components/chat/chain-plan-card").ChainPlanData;
  onStartStep?: (stepIndex: number) => void;
  onReplace: (replacement: ToolCard) => void;
  walletAddress?: string;
  chainCallbacks?: ChainSignCallbacks;
  contacts?: { name: string; address: string }[];
}) {
  const suiClient = useSuiClient();
  const [atomicError, setAtomicError] = useState<string | null>(null);
  const [atomicPreparing, setAtomicPreparing] = useState(false);
  const [atomicTx, setAtomicTx] = useState<PrepareTradePass | null>(null);

  /** Resolve a send recipient (saved-friend name / .sui / 0x) to a 0x address for the atomic
   *  proposal — the route requires a resolved 0x and the Guardian anti-leak matches on it. */
  const resolveRecipientTo0x = useCallback(
    async (raw: string): Promise<string | null> => {
      const t = raw.trim();
      if (/^0x[0-9a-fA-F]{1,64}$/.test(t)) return t.toLowerCase();
      const c = contacts.find((x) => x.name.toLowerCase() === t.toLowerCase());
      if (c) return c.address.toLowerCase();
      if (looksLikeSuinsName(t)) {
        try {
          const addr = await resolveSuinsAddress(suiClient, t);
          if (addr) return addr.toLowerCase();
        } catch {
          /* fall through → null */
        }
      }
      return null;
    },
    [contacts, suiClient],
  );

  // ---------------------------------------------------------------------------
  // Clause parsers for the dynamic composite builder.
  // Each parser returns { amountNative, coinTypeIn, coinTypeOut?, recipient? }.
  // Canonical coin types are hardcoded to avoid a round-trip; they match the
  // server-side COIN_TYPES allowlist exactly.
  // ---------------------------------------------------------------------------

  // Canonical coin types (client-side mirror of COIN_TYPES in protocol-constants.ts)
  const CT_SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
  const CT_USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
  const CT_AFSUI = "0xf325ce1300e8dac124071d3152c5c5ee6174914f8bc2161e88329cf579246efc::afsui::AFSUI";

  /** Map a coin symbol to its canonical type. Unknown defaults to SUI. */
  function coinTypeForSym(sym: string): string {
    const s = sym.toUpperCase();
    if (s === "USDC") return CT_USDC;
    if (s === "AFSUI") return CT_AFSUI;
    return CT_SUI; // SUI or unknown
  }

  /** Decimals for a coin symbol. SUI/afSUI = 9, USDC = 6. */
  function decimalsForSym(sym: string): number {
    const s = sym.toUpperCase();
    if (s === "USDC") return 6;
    if (s === "DEEP") return 6;
    return 9;
  }

  /**
   * Parse native amount from a clause like "swap 5 SUI to USDC" or "send 1.5 SUI to 0x...".
   * Matches the first <number> <COIN> occurrence.
   */
  function parseAmountNative(clause: string, verb: string): string {
    const m = clause.match(new RegExp(`${verb}\\s+([\\d.,]+)\\s+([A-Za-z]+)`, "i"));
    if (!m) return "0";
    const human = parseFloat(m[1].replace(/,/g, ""));
    return BigInt(Math.round(human * 10 ** decimalsForSym(m[2]))).toString();
  }

  /**
   * Parse the swap leg from a clause: "swap N SUI to USDC".
   * Returns coinTypeIn, coinTypeOut, amountNative.
   */
  function parseSwapLeg(clause: string): {
    coinTypeIn: string;
    coinTypeOut: string;
    amountNative: string;
  } {
    const m = clause.match(/swap\s+([\d.,]+)\s+([A-Za-z]+)\s+(?:to|for|into)\s+([A-Za-z]+)/i);
    if (m) {
      const human = parseFloat(m[1].replace(/,/g, ""));
      const inSym = m[2];
      const outSym = m[3];
      const nativeAmt = BigInt(Math.round(human * 10 ** decimalsForSym(inSym))).toString();
      return { coinTypeIn: coinTypeForSym(inSym), coinTypeOut: coinTypeForSym(outSym), amountNative: nativeAmt };
    }
    // Fallback: parse just the amount with "swap" verb
    const amtNative = parseAmountNative(clause, "swap");
    return { coinTypeIn: CT_SUI, coinTypeOut: CT_USDC, amountNative: amtNative };
  }

  /**
   * Parse the send leg from a clause: "send 1 SUI to 0xABC..." or "send 5 USDC to alice.sui".
   * Returns coinTypeIn, amountNative, recipient (raw 0x or .sui name; server resolves .sui).
   */
  function parseSendLeg(clause: string): {
    coinTypeIn: string;
    amountNative: string;
    recipient: string | null;
  } {
    // Capture the FULL recipient after "to" — a chain step is one send, so the rest of the
    // clause is the whole recipient. `(.+)$` (not `\S+`) keeps multi-word contact names
    // intact ("Test 1", "Mom Wallet"); a single-token `\S+` truncated them to the first word.
    const m = clause.match(/send\s+([\d.,]+)\s+([A-Za-z]+)\s+(?:to|→)\s+(.+)$/i);
    if (m) {
      const human = parseFloat(m[1].replace(/,/g, ""));
      const sym = m[2];
      const nativeAmt = BigInt(Math.round(human * 10 ** decimalsForSym(sym))).toString();
      // 0x address, .sui name, or a saved-contact name (may contain spaces); strip trailing punctuation.
      const rawRecipient = m[3].trim().replace(/[.,;!?]+$/, "");
      return { coinTypeIn: coinTypeForSym(sym), amountNative: nativeAmt, recipient: rawRecipient };
    }
    const amtNative = parseAmountNative(clause, "send");
    return { coinTypeIn: CT_SUI, amountNative: amtNative, recipient: null };
  }

  /**
   * Parse the stake leg from a clause: "stake 2 SUI" or "stake 2 SUI via haedal".
   */
  function parseStakeLeg(clause: string): {
    coinTypeIn: string;
    amountNative: string;
  } {
    const amtNative = parseAmountNative(clause, "stake");
    return { coinTypeIn: CT_SUI, amountNative: amtNative };
  }

  /**
   * Parse the lend leg from a clause: "deposit 100 USDC into NAVI" or "lend 100 USDC".
   */
  function parseLendLeg(clause: string): {
    coinTypeIn: string;
    amountNative: string;
  } {
    const m = clause.match(/(?:deposit|lend|supply)\s+([\d.,]+)\s+([A-Za-z]+)/i);
    if (m) {
      const human = parseFloat(m[1].replace(/,/g, ""));
      const sym = m[2];
      const nativeAmt = BigInt(Math.round(human * 10 ** decimalsForSym(sym))).toString();
      return { coinTypeIn: coinTypeForSym(sym), amountNative: nativeAmt };
    }
    // Fallback: if no match, amountInNative=0 signals "use prev-output" (server handles).
    return { coinTypeIn: CT_USDC, amountNative: "0" };
  }

  const handleRunAtomic = useCallback(async () => {
    if (!walletAddress || !isAtomicEligible(plan)) return;

    setAtomicPreparing(true);
    setAtomicError(null);

    try {
      // Pre-resolve send recipients (saved friend / .sui / 0x → 0x). The route requires a
      // resolved 0x and the Guardian anti-leak matches on it. Fail clearly if any can't resolve.
      const resolvedRecipients = new Map<number, string>();
      for (let i = 0; i < plan.steps.length; i++) {
        const s = plan.steps[i];
        if (s.category !== "send") continue;
        const { recipient } = parseSendLeg(s.clause);
        const resolved = recipient ? await resolveRecipientTo0x(recipient) : null;
        if (!resolved) {
          setAtomicError(
            recipient
              ? `Couldn't resolve "${recipient}" to an address for the atomic send — use a saved friend, a .sui name, or a 0x address.`
              : "Couldn't read a recipient for one of the send steps.",
          );
          setAtomicPreparing(false);
          return;
        }
        resolvedRecipients.set(i, resolved);
      }

      // Build legs from ALL chain steps (generalized dynamic composite).
      // Map each step.category to its composite actionType and parse amount/coins from clause.
      const compositeLegs: Array<{
        actionType: string;
        coinTypeIn: string;
        coinTypeOut?: string;
        amountInNative: string;
        amountFrom?: string;
        recipient?: string;
        slippageBps?: number;
        lendingProtocol?: string;
      }> = plan.steps.map((step, idx) => {
        const isChained = step.amountFrom === "prev-output";
        if (step.category === "swap") {
          const { coinTypeIn, coinTypeOut, amountNative } = parseSwapLeg(step.clause);
          return {
            actionType: "swap",
            coinTypeIn,
            coinTypeOut,
            amountInNative: isChained ? "0" : amountNative,
            amountFrom: step.amountFrom,
            slippageBps: 50,
          };
        } else if (step.category === "send") {
          const { coinTypeIn, amountNative } = parseSendLeg(step.clause);
          return {
            actionType: "send",
            coinTypeIn,
            amountInNative: amountNative,
            amountFrom: step.amountFrom,
            recipient: resolvedRecipients.get(idx), // pre-resolved 0x (friend/.sui/0x)
          };
        } else if (step.category === "stake") {
          const { coinTypeIn, amountNative } = parseStakeLeg(step.clause);
          return {
            actionType: "stake",
            coinTypeIn,
            amountInNative: isChained ? "0" : amountNative,
            amountFrom: step.amountFrom,
          };
        } else {
          // lend
          const { coinTypeIn, amountNative } = parseLendLeg(step.clause);
          return {
            actionType: "lend_deposit",
            coinTypeIn,
            amountInNative: amountNative,
            amountFrom: step.amountFrom,
            lendingProtocol: "navi",
          };
        }
      });

      // coinTypeIn for the overall proposal = first leg's coinTypeIn
      const firstLeg = compositeLegs[0];
      const firstCoinTypeIn = firstLeg?.coinTypeIn ?? CT_SUI;
      const firstAmountNative = firstLeg?.amountInNative ?? "0";

      const res = await fetch("/api/prepare-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          actionType: "composite",
          coinTypeIn: firstCoinTypeIn,
          amountInNative: firstAmountNative,
          compositeRecipeId: "dynamic",
          compositeLegs,
          argProvenance: { amount: "user_turn" },
        }),
      });

      const data = (await res.json()) as PrepareTradeResult;

      if (!data.ok) {
        // Degrade gracefully — keep the sequential plan card visible so the user just signs
        // step-by-step. The response may be a Guardian block ({reasons}) OR a validation/tool
        // error ({error,message}); read whichever is present so a non-block shape can't crash.
        const block = data as Partial<PrepareTradeBlock> & { message?: string };
        const rawReason =
          Array.isArray(block.reasons) && block.reasons.length > 0
            ? block.reasons.join("; ")
            : block.message ?? "unknown error";
        // A coin/gas shortfall is a balance problem, not a route limitation — say so plainly.
        // (Falling back to step-by-step would hit the SAME shortfall, so don't imply it helps.)
        // Matched by the server's insufficient_gas gate (same gate as a normal SUI swap), with
        // a message-text fallback. The server reason is already user-facing, so surface it.
        const isBalanceShortfall =
          (Array.isArray(block.gates) && block.gates.includes("insufficient_gas")) ||
          /insufficient|not enough sui/i.test(rawReason);
        if (isBalanceShortfall) {
          setAtomicError(
            /sui/i.test(rawReason)
              ? rawReason
              : "Not enough SUI to swap that amount and still cover network gas. Reduce the amount " +
                  "(leave a little SUI for gas) or top up, then try again.",
          );
          return;
        }
        // A composite-build/dry-run failure (e.g. the swap router can't be composed into one
        // PTB for this route) is NOT a security block — surface a clear, non-cryptic note that
        // atomic is off for THIS transaction and we're falling back, rather than a raw MoveAbort.
        const isComposeLimitation =
          /composite|dry-run|aftermath|split_coin|moveabort|construction failed|coinout/i.test(
            rawReason,
          );
        setAtomicError(
          isComposeLimitation
            ? "Atomic (1-transaction) bundling isn't available for this combination right now — it can't be composed into a single PTB. Falling back to step-by-step; your funds and every Guardian check are unaffected."
            : `Atomic unavailable for this transaction: ${rawReason} — falling back to step-by-step.`,
        );
        return;
      }

      // PASS: inject a tx-preview card (replaces this chain-plan card slot).
      // The sign flow is identical to any other tx-preview.
      const pass = data as PrepareTradePass;
      setAtomicTx(pass);
    } catch (err) {
      setAtomicError(
        `Atomic build failed: ${err instanceof Error ? err.message : "network error"} — use step-by-step.`,
      );
    } finally {
      setAtomicPreparing(false);
    }
  }, [walletAddress, plan, isAtomicEligible]);

  // When the atomic tx-preview is ready, replace the chain-plan card slot with a tx-preview.
  // This is the ONE signature path — the composite PTB covers both legs atomically.
  if (atomicTx) {
    return (
      <TxPreviewCardWithSigning
        pendingTx={atomicTx}
        onReplace={(replacement) => {
          setAtomicTx(null);
          onReplace(replacement);
        }}
        walletAddress={walletAddress}
        // Composite tx has no chain step context — it's a single atomic action.
        chainContext={undefined}
        onChainStepConfirmed={chainCallbacks?.onChainStepConfirmed}
        onChainStepBlocked={chainCallbacks?.onChainStepBlocked}
        onChainStepStale={chainCallbacks?.onChainStepStale}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <ChainPlanCard
        plan={plan}
        onStartStep={onStartStep}
        onRunAtomic={isAtomicEligible(plan) ? () => void handleRunAtomic() : undefined}
      />

      {/* Atomic build in-progress indicator */}
      {atomicPreparing && (
        <p
          className="split-mono"
          style={{ fontSize: 11, color: "var(--fg-muted)", margin: 0 }}
        >
          Building atomic transaction…
        </p>
      )}

      {/* Atomic build error — degrade note, sequential plan remains */}
      {atomicError && !atomicPreparing && (
        <div
          style={{
            maxWidth: 380,
            borderRadius: 8,
            border: "1px solid color-mix(in srgb, var(--destructive) 30%, transparent)",
            background: "color-mix(in srgb, var(--destructive) 5%, transparent)",
            padding: "8px 11px",
            fontSize: 11,
            color: "var(--destructive)",
            lineHeight: 1.5,
          }}
        >
          {atomicError}
        </div>
      )}
    </div>
  );
}
