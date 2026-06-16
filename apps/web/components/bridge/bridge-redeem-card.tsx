"use client";

/**
 * BridgeRedeemCard — the Sui-side Wormhole redeem preview.
 *
 * Honesty by design: the card makes the two-leg model explicit. The source-chain
 * transfer is the user's OWN wallet-driven decision (Wormhole Connect) — Dewlock
 * never signs it. Dewlock builds ONLY this Sui redeem, and only to the user's own
 * address (recipient==self), with a transparent bridge fee. The 9 fail-closed
 * bridge gates run before this card is shown.
 */

const WORMHOLE_CHAIN_NAMES: Record<number, string> = {
  1: "Solana", 2: "Ethereum", 4: "BSC", 5: "Polygon", 6: "Avalanche",
  23: "Arbitrum", 24: "Optimism", 30: "Base",
};

export interface BridgeRedeemPreview {
  sourceChain: number;
  suiCoinType: string;
  usdValue: number;
  bridgeFeeUsd: number;
  recipient: string;
  demoFixture: boolean;
}

export interface BridgeRedeemCardProps {
  preview: BridgeRedeemPreview;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isPending?: boolean;
}

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function ticker(coinType: string): string {
  return coinType.split("::").pop() ?? coinType;
}

export function BridgeRedeemCard({ preview, onConfirm, onCancel, isPending = false }: BridgeRedeemCardProps) {
  const src = WORMHOLE_CHAIN_NAMES[preview.sourceChain] ?? `chain ${preview.sourceChain}`;
  return (
    <div
      className="w-full overflow-hidden"
      style={{ maxWidth: 440, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex items-center justify-between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <span className="split-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-muted)" }}>
          Tx preview · wormhole redeem
        </span>
        {preview.demoFixture && (
          <span className="split-mono" style={{ fontSize: 10, color: "var(--warning)", background: "color-mix(in srgb, var(--warning) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)", padding: "3px 9px", borderRadius: 99 }}>
            DEMO
          </span>
        )}
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Two-leg honesty */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="flex items-center gap-2" style={{ padding: "11px 13px", background: "var(--bg-sub)", border: "1px solid var(--border)", borderRadius: 10 }}>
            <span className="split-mono" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.08em" }}>1 · SOURCE</span>
            <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{src} → Sui · <strong style={{ color: "var(--fg)" }}>your wallet (Connect)</strong></span>
          </div>
          <div className="flex items-center gap-2" style={{ padding: "11px 13px", background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)", borderRadius: 10 }}>
            <span className="split-mono" style={{ fontSize: 10, color: "var(--accent-ink)", letterSpacing: "0.08em" }}>2 · REDEEM</span>
            <span style={{ fontSize: 13, color: "var(--fg)" }}>Dewlock builds this Sui redeem</span>
          </div>
        </div>

        {/* Receive + fee */}
        <div style={{ padding: "13px 15px", background: "var(--bg-sub)", border: "1px solid var(--border)", borderRadius: 10 }}>
          <div className="split-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)" }}>You receive</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
            {usd(preview.usdValue)} <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{ticker(preview.suiCoinType)}</span>
          </div>
          <div className="flex items-center justify-between" style={{ fontSize: 12, marginTop: 6 }}>
            <span style={{ color: "var(--fg-muted)" }}>Bridge fee</span>
            <span className="mono" style={{ color: "var(--fg)" }}>{usd(preview.bridgeFeeUsd)}</span>
          </div>
        </div>

        {/* Recipient == self (the structural safety) */}
        <div className="flex items-start justify-between gap-2">
          <span className="split-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)", flexShrink: 0 }}>To (your address)</span>
          <code className="mono" style={{ fontSize: 11, color: "var(--fg)", wordBreak: "break-all", textAlign: "right" }}>{preview.recipient}</code>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {["emitter", "VAA quorum", "recipient==self", "priced asset", "guardian-set"].map((g) => (
            <span key={g} className="inline-flex items-center gap-1 split-mono" style={{ fontSize: 10, color: "var(--success)", background: "color-mix(in srgb, var(--success) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)", padding: "3px 8px", borderRadius: 99 }}>
              ✓ {g}
            </span>
          ))}
        </div>

        <p style={{ fontSize: 11, color: "var(--fg-faint)", lineHeight: 1.45, margin: 0 }}>
          The source-chain amount is your own decision (wallet-driven). Dewlock signs only this Sui redeem, only to your address.
        </p>

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={isPending} className="flex-1 rounded-lg font-semibold" style={{ height: 44, border: "1px solid var(--border)", background: "var(--bg-elev)", color: "var(--fg)", fontSize: 14, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.5 : 1 }}>
            Cancel
          </button>
          <button type="button" onClick={() => void onConfirm()} disabled={isPending} className="flex-1 rounded-lg font-semibold" style={{ height: 44, background: "var(--accent)", color: "#fff", border: "none", fontSize: 14.5, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.5 : 1 }}>
            {isPending ? "Signing…" : "Confirm & Sign redeem"}
          </button>
        </div>
      </div>
    </div>
  );
}
