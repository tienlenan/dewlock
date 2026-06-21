"use client";

/**
 * bm-onboarding-step-panels — the two step panels for BmOnboardingCard.
 *
 * Extracted to keep bm-onboarding-card.tsx under 200 LOC.
 *
 * CreateStepPanel  — prepares + signs bm_create; emits new BM id on success.
 * FundStepPanel    — coin picker + amount input; prepares + signs bm_deposit.
 */

import { useState, useCallback } from "react";
import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import { useSignAndExecuteTx, WysiwysError } from "@/lib/use-sign-and-execute-tx";
import { TxPreviewCard } from "@/components/tx-preview-card";
import type { TxPreviewData } from "@/components/tx-preview-card";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface PrepareResult {
  ok: true;
  approvedDigest: string;
  txBytes: string;
  preview: TxPreviewData;
}

// ── Coin constants ────────────────────────────────────────────────────────────

export const COIN_TYPES: Record<string, string> = {
  USDC: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  SUI:  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  DEEP: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
};
export const COIN_DECIMALS: Record<string, number> = { USDC: 6, SUI: 9, DEEP: 6 };
export const COIN_SYMBOLS = ["USDC", "SUI", "DEEP"] as const;
export type CoinSymbol = typeof COIN_SYMBOLS[number];

// ── Shared UI helpers ─────────────────────────────────────────────────────────

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="split-mono"
      style={{
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--fg-muted)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

export function ctaStyle(enabled: boolean): React.CSSProperties {
  return {
    height: 44,
    border: "none",
    borderRadius: 10,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.4,
    width: "100%",
  };
}

// ── Per-instance signing sub-component (one hook per mounted instance) ────────

function SigningStep({
  prepared,
  onSuccess,
  onError,
  onCancel,
}: {
  prepared: PrepareResult;
  onSuccess: (resp: SuiTransactionBlockResponse) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const { signAndExecute } = useSignAndExecuteTx({ approvedDigest: prepared.approvedDigest });

  const handleConfirm = useCallback(async () => {
    setIsPending(true);
    try {
      const resp = await signAndExecute({ transaction: prepared.txBytes });
      onSuccess(resp);
    } catch (err) {
      const msg =
        err instanceof WysiwysError
          ? "Transaction bytes changed since approval — blocked for safety."
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

// ── CreateStepPanel ───────────────────────────────────────────────────────────

interface CreateStepPanelProps {
  walletAddress: string;
  existingBmId: string | null;
  onSkipToFund: () => void;
  onCreated: (bmId: string) => void;
}

export function CreateStepPanel({
  walletAddress,
  existingBmId,
  onSkipToFund,
  onCreated,
}: CreateStepPanelProps) {
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePrepare = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prepare-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, actionType: "bm_create" }),
      });
      const data = (await res.json()) as PrepareResult | { ok: false; reasons: string[] };
      if (!data.ok) {
        setError((data as { ok: false; reasons: string[] }).reasons.join("; "));
        return;
      }
      setPrepared(data as PrepareResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const handleSuccess = useCallback(
    (resp: SuiTransactionBlockResponse) => {
      const changes = resp.objectChanges ?? [];
      const bmChange = changes.find(
        (c) =>
          c.type === "created" &&
          typeof (c as { objectType?: string }).objectType === "string" &&
          (c as { objectType: string }).objectType.includes("balance_manager::BalanceManager"),
      );
      const newBmId =
        bmChange && "objectId" in bmChange
          ? (bmChange as { objectId: string }).objectId
          : "";
      setPrepared(null);
      onCreated(newBmId);
    },
    [onCreated],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHeading>Step 1 · Create trading account</SectionHeading>
      <p style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5, margin: 0 }}>
        DeepBook requires a shared BalanceManager object. One-time on-chain setup — persists across orders.
      </p>

      {existingBmId && (
        <button
          type="button"
          onClick={onSkipToFund}
          style={{
            alignSelf: "flex-start",
            fontSize: 12,
            color: "var(--accent)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Skip — fund existing account →
        </button>
      )}

      {!prepared ? (
        <>
          {error && <p style={{ fontSize: 12, color: "var(--destructive)", margin: 0 }}>{error}</p>}
          <button type="button" disabled={loading} onClick={() => void handlePrepare()} style={ctaStyle(!loading)}>
            {loading ? "Preparing…" : "Create trading account"}
          </button>
        </>
      ) : (
        <>
          <SigningStep
            prepared={prepared}
            onSuccess={handleSuccess}
            onError={(msg) => { setError(msg); setPrepared(null); }}
            onCancel={() => setPrepared(null)}
          />
          {error && <p style={{ fontSize: 12, color: "var(--destructive)", margin: 0 }}>{error}</p>}
        </>
      )}
    </div>
  );
}

// ── FundStepPanel ─────────────────────────────────────────────────────────────

interface FundStepPanelProps {
  walletAddress: string;
  bmId: string | null;
  onFunded: () => void;
}

export function FundStepPanel({ walletAddress, bmId, onFunded }: FundStepPanelProps) {
  const [coin, setCoin] = useState<CoinSymbol>("USDC");
  const [amount, setAmount] = useState("");
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePrepare = useCallback(async () => {
    if (!bmId) { setError("No trading account ID — complete step 1 first."); return; }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) { setError("Enter a valid amount."); return; }
    const amountInNative = BigInt(
      Math.round(amountNum * 10 ** (COIN_DECIMALS[coin] ?? 6)),
    ).toString();

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prepare-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          actionType: "bm_deposit",
          coinTypeIn: COIN_TYPES[coin],
          amountInNative,
          balanceManagerId: bmId,
        }),
      });
      const data = (await res.json()) as PrepareResult | { ok: false; reasons: string[] };
      if (!data.ok) {
        setError((data as { ok: false; reasons: string[] }).reasons.join("; "));
        return;
      }
      setPrepared(data as PrepareResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [walletAddress, bmId, coin, amount]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHeading>Step 2 · Fund account</SectionHeading>
      {bmId && (
        <p className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", wordBreak: "break-all", margin: 0 }}>
          BM: {bmId}
        </p>
      )}

      {!prepared ? (
        <>
          {/* Coin picker */}
          <div style={{ display: "flex", gap: 6 }}>
            {COIN_SYMBOLS.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => setCoin(sym)}
                style={{
                  flex: 1,
                  height: 34,
                  border: `1px solid ${coin === sym ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8,
                  background: coin === sym ? "var(--accent-soft)" : "var(--bg-sub)",
                  color: coin === sym ? "var(--accent-ink)" : "var(--fg-muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Amount input */}
          <input
            type="number"
            min={0}
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={`Deposit amount in ${coin}`}
            style={{
              height: 40,
              padding: "0 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--bg-sub)",
              color: "var(--fg)",
              fontSize: 14,
              fontFamily: "var(--font-mono, monospace)",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />

          {error && <p style={{ fontSize: 12, color: "var(--destructive)", margin: 0 }}>{error}</p>}

          <button
            type="button"
            disabled={loading || !amount}
            onClick={() => void handlePrepare()}
            style={ctaStyle(!loading && !!amount)}
          >
            {loading ? "Preparing…" : `Fund with ${coin}`}
          </button>
        </>
      ) : (
        <>
          <SigningStep
            prepared={prepared}
            onSuccess={() => { setPrepared(null); onFunded(); }}
            onError={(msg) => { setError(msg); setPrepared(null); }}
            onCancel={() => setPrepared(null)}
          />
          {error && <p style={{ fontSize: 12, color: "var(--destructive)", margin: 0 }}>{error}</p>}
        </>
      )}
    </div>
  );
}
