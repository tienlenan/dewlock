"use client";

/**
 * BridgeClient — the /bridge surface. Honest two-leg model:
 *   Leg 1 (source) is wallet-driven via Wormhole Connect — Dewlock never signs it.
 *   Leg 2 (Sui redeem) is built by Dewlock behind the 9 fail-closed bridge gates
 *   and signed by the user here (WYSIWYS).
 *
 * For the demo, the source leg accepts a pasted signed VAA (Connect embed is
 * [needs live-env] — its mainnet config + VAA hand-off are wired separately).
 * Pasting a VAA POSTs /api/bridge-redeem → gates run → redeem card → user signs.
 */

import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useSignAndExecuteTx, WysiwysError } from "@dewlock/sui/sign";
import { BridgeRedeemCard, type BridgeRedeemPreview } from "@/components/bridge/bridge-redeem-card";
import { WormholeConnectEmbed } from "@/components/bridge/wormhole-connect-embed";

type RedeemResult =
  | { ok: true; txBytes: string; approvedDigest: string; preview: BridgeRedeemPreview }
  | { ok: false; reasons: string[]; gates: string[] };

export function BridgeClient() {
  const account = useCurrentAccount();
  const [vaa, setVaa] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [signed, setSigned] = useState<string | null>(null);

  async function submit() {
    if (!account?.address || !vaa.trim()) return;
    setLoading(true);
    setResult(null);
    setSigned(null);
    try {
      const res = await fetch("/api/bridge-redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: account.address, vaaBase64: vaa.trim() }),
      });
      setResult((await res.json()) as RedeemResult);
    } catch (e) {
      setResult({ ok: false, reasons: [`Request failed: ${e instanceof Error ? e.message : String(e)}`], gates: ["network"] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: 480, width: "100%" }}>
      {/* Leg 1: source (wallet-driven) — the real Wormhole Connect widget */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", padding: 16 }}>
        <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--fg-muted)" }}>1 · SOURCE LEG · WALLET-DRIVEN (WORMHOLE CONNECT)</div>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "8px 0 12px", lineHeight: 1.5 }}>
          Lock/burn + bridge into Sui with the Wormhole Connect widget — you sign in your own wallet; Dewlock never signs the source leg.
        </p>
        <WormholeConnectEmbed />
      </div>

      {/* Leg 2: redeem via Dewlock's Guardian (optional — for a manual VAA redeem) */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elev)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--accent-ink)" }}>2 · OR REDEEM A VAA VIA DEWLOCK'S GUARDIAN</div>
        <p style={{ fontSize: 12.5, color: "var(--fg-muted)", margin: 0, lineHeight: 1.45 }}>
          Have a signed VAA already? Redeem it behind Dewlock's 9 fail-closed bridge gates (recipient==self, priced-asset allowlist, VAA verify) instead of the default relayer.
        </p>
        <textarea
          value={vaa}
          onChange={(e) => setVaa(e.target.value)}
          placeholder="Paste the signed VAA (base64)…"
          rows={3}
          style={{ width: "100%", fontSize: 12, fontFamily: "var(--font-mono, monospace)", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-sub)", color: "var(--fg)", resize: "vertical" }}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !account?.address || !vaa.trim()}
          className="rounded-lg font-semibold"
          style={{ height: 42, background: "var(--accent)", color: "#fff", border: "none", fontSize: 14, cursor: loading ? "wait" : "pointer", opacity: !account?.address || !vaa.trim() ? 0.5 : 1 }}
        >
          {!account?.address ? "Connect a wallet" : loading ? "Verifying VAA…" : "Verify & prepare redeem"}
        </button>
      </div>

      {/* Result */}
      {result && !result.ok && (
        <div style={{ border: "1px solid color-mix(in srgb, var(--destructive) 35%, transparent)", background: "color-mix(in srgb, var(--destructive) 6%, transparent)", borderRadius: 12, padding: 14 }}>
          <div className="split-mono" style={{ fontSize: 10, color: "var(--destructive)", letterSpacing: "0.1em" }}>BRIDGE BLOCKED · {result.gates.join(", ")}</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--fg-muted)" }}>
            {result.reasons.map((r, i) => <li key={i} style={{ marginTop: 4 }}>{r}</li>)}
          </ul>
        </div>
      )}
      {result?.ok && !signed && (
        <RedeemSigner result={result} onSigned={setSigned} />
      )}
      {signed && (
        <div style={{ border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", background: "color-mix(in srgb, var(--success) 6%, transparent)", borderRadius: 12, padding: 14 }}>
          <div className="split-mono" style={{ fontSize: 10, color: "var(--success)", letterSpacing: "0.1em" }}>REDEEMED</div>
          <code className="mono" style={{ fontSize: 11, color: "var(--fg)", wordBreak: "break-all" }}>{signed}</code>
        </div>
      )}
    </div>
  );
}

function RedeemSigner({
  result,
  onSigned,
}: {
  result: { txBytes: string; approvedDigest: string; preview: BridgeRedeemPreview };
  onSigned: (digest: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signAndExecute } = useSignAndExecuteTx({ approvedDigest: result.approvedDigest });

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const resp = await signAndExecute({ transaction: result.txBytes });
      onSigned((resp as { digest: string }).digest);
    } catch (err) {
      setError(err instanceof WysiwysError
        ? "Transaction bytes changed since Guardian approval — blocked for your safety."
        : `Signing failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <BridgeRedeemCard preview={result.preview} onConfirm={confirm} onCancel={() => onSigned("")} isPending={pending} />
      {error && <p style={{ fontSize: 12, color: "var(--destructive)", margin: 0 }}>{error}</p>}
    </div>
  );
}
