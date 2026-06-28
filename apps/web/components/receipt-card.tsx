"use client";

/**
 * ReceiptCard — shown after a successful on-chain execution.
 *
 * Security affordances (must never be removed):
 *  - On-chain tx digest + explorer link for independent verification.
 *  - Guardian-approved digest (WYSIWYS) — lets user confirm bytes signed
 *    match exactly what the preview showed.
 *
 * Walrus + Sui anchor rows (optional):
 *  - blobId: immutable content-addressed receipt blob on Walrus.
 *  - anchorObjectId: mutable HEAD pointer on Sui (operational key owned).
 *  - status drives readiness shimmer vs. live link display.
 *    "pending"    → shimmer rows (writing receipt…)
 *    "blob_ready" → blob row live, anchor row shimmer
 *    "blob_only"  → blob row live (if blobId present), anchor row muted note
 *    "anchored"   → both rows live
 *
 * Visual: matches mockup "Receipt · SUCCESS" — bg-elev, green SUCCESS pill,
 * mono grid rows for tx digest / approved digest / walrus blob / sui object.
 */

import { ExternalLink } from "lucide-react";

export type ReceiptStatus = "pending" | "blob_ready" | "anchored" | "blob_only" | "timeout";

export interface ReceiptCardProps {
  txDigest: string;
  approvedDigest: string;
  /** Walrus blobId for the action receipt blob (null while pending). */
  blobId?: string | null;
  /** Sui anchor HEAD object id (null while pending or on blob_only). */
  anchorObjectId?: string | null;
  /** Sui object to link: the HEAD anchor if its package is deployed, else the
   *  on-chain Walrus Blob object created by the publish. Preferred over anchorObjectId. */
  suiObjectId?: string | null;
  /** Async receipt pipeline status. */
  status?: ReceiptStatus;
}

const EXPLORER_NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "mainnet";

/** Fill a suiscan-style template: substitutes {network} AND the value placeholder
 * (templates use {id}; tx links also accept {digest}). */
function fillTemplate(template: string, value: string): string {
  return template
    .split("{network}").join(EXPLORER_NETWORK)
    .split("{digest}").join(value)
    .split("{id}").join(value);
}

/** Transaction explorer URL. The configured template is OBJECT-scoped (/object/{id}),
 * so a tx digest needs the /tx/ path — derive it (or use an explicit tx template). */
function buildExplorerUrl(txDigest: string): string {
  const objTpl = process.env.NEXT_PUBLIC_EXPLORER_OBJECT_URL_TEMPLATE;
  const txTpl =
    process.env.NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE ||
    (objTpl ? objTpl.replace("/object/", "/tx/") : "https://suiscan.xyz/{network}/tx/{digest}");
  return fillTemplate(txTpl, txDigest);
}

function buildWalrusAggregatorUrl(blobId: string): string {
  const base =
    process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ??
    "https://aggregator.walrus-mainnet.walrus.space";
  return `${base}/v1/blobs/${blobId}`;
}

function buildSuiObjectUrl(objectId: string): string {
  const tpl =
    process.env.NEXT_PUBLIC_EXPLORER_OBJECT_URL_TEMPLATE ||
    "https://suiscan.xyz/{network}/object/{id}";
  return fillTemplate(tpl, objectId);
}

/** Truncate a long hash for display: first 6 chars + … + last 4 chars */
function shortHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Shimmer row — shown while async receipt is pending
// ---------------------------------------------------------------------------

function ShimmerRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span
        style={{
          display: "inline-block",
          width: 120,
          height: 12,
          borderRadius: 4,
          background: "linear-gradient(90deg, var(--bg-sub) 25%, var(--border) 50%, var(--bg-sub) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s ease-in-out infinite",
          opacity: 0.7,
        }}
        aria-label={`${label} — writing receipt…`}
      />
    </div>
  );
}

export function ReceiptCard({
  txDigest,
  approvedDigest,
  blobId,
  anchorObjectId,
  suiObjectId,
  status = "pending",
}: ReceiptCardProps) {
  const explorerUrl = buildExplorerUrl(txDigest);
  const isTimeout = status === "timeout";
  const showBlobRow = status !== "pending";
  const showAnchorRow = status !== "pending";
  const blobReady = !!blobId && (status === "anchored" || status === "blob_ready" || status === "blob_only");
  // Prefer the resolved Sui object (HEAD anchor or Walrus Blob object). The blob
  // object exists once the blob is published, so it's live at blob_ready too.
  const suiObj = suiObjectId ?? anchorObjectId ?? null;
  const anchorReady = !!suiObj && (status === "anchored" || status === "blob_ready" || status === "blob_only");

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        maxWidth: "440px",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Shimmer keyframe — injected inline so no global CSS dependency */}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* ── Header — "Receipt" label + SUCCESS badge ── */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="split-mono"
          style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--fg-muted)" }}
        >
          Receipt
        </span>
        <span
          className="split-mono"
          style={{
            fontSize: "10px",
            color: "var(--success)",
            background: "color-mix(in srgb, var(--success) 12%, transparent)",
            padding: "3px 9px",
            borderRadius: 99,
          }}
        >
          SUCCESS
        </span>
      </div>

      {/* ── Body — digest rows ── */}
      <div
        style={{
          padding: "16px",
          display: "grid",
          gap: "9px",
          fontFamily: "var(--font-mono)",
          fontSize: "12.5px",
        }}
      >
        {/* tx digest */}
        <ReceiptRow
          label="tx digest"
          value={shortHash(txDigest)}
          action={
            explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View transaction on explorer"
                style={{ color: "var(--accent-ink)", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
              >
                <ExternalLink size={12} aria-hidden />
              </a>
            ) : (
              <span style={{ color: "var(--accent-ink)", cursor: "pointer" }}>↗</span>
            )
          }
        />

        {/* WYSIWYS approved digest */}
        <ReceiptRow
          label="approved digest"
          value={shortHash(approvedDigest)}
          action={<span style={{ color: "var(--fg-faint)" }}>⧉</span>}
          title={`SHA-256: ${approvedDigest}`}
        />

        {/* Walrus blob row — shimmer while pending, live link when ready */}
        {!showBlobRow && <ShimmerRow label="blob id" />}
        {showBlobRow && blobReady && (
          <ReceiptRow
            label="blob id"
            value={shortHash(blobId!)}
            action={
              <a
                href={buildWalrusAggregatorUrl(blobId!)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View receipt blob on Walrus aggregator"
                style={{ color: "var(--accent-ink)", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
              >
                <ExternalLink size={12} aria-hidden />
              </a>
            }
          />
        )}
        {showBlobRow && !blobReady && (
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--fg-muted)" }}>blob id</span>
            <span style={{ color: "var(--fg-faint)", fontSize: "11px" }}>
              {status === "timeout"
                ? "still writing — retry later"
                : status === "blob_only"
                  ? "unavailable"
                  : "writing…"}
            </span>
          </div>
        )}

        {/* Sui anchor row — shimmer while pending, live link when anchored, muted note on blob_only */}
        {!showAnchorRow && <ShimmerRow label="sui object" />}
        {showAnchorRow && anchorReady && (
          <ReceiptRow
            label="sui object"
            value={shortHash(suiObj!)}
            action={
              buildSuiObjectUrl(suiObj!) ? (
                <a
                  href={buildSuiObjectUrl(suiObj!)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View receipt object on Sui explorer"
                  style={{ color: "var(--accent-ink)", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                >
                  <ExternalLink size={12} aria-hidden />
                </a>
              ) : (
                <span style={{ color: "var(--accent-ink)" }}>↗</span>
              )
            }
          />
        )}
        {showAnchorRow && !anchorReady && (
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--fg-muted)" }}>sui object</span>
            <span style={{ color: "var(--fg-faint)", fontSize: "11px" }}>
              {status === "blob_only" ? "on-chain anchor pending" : "writing…"}
            </span>
          </div>
        )}

        {/* Timeout notice — receipt write timed out but tx is confirmed on-chain */}
        {isTimeout && (
          <div
            role="status"
            style={{
              padding: "9px 12px",
              background: "color-mix(in srgb, var(--warning) 6%, var(--bg-sub))",
              border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--fg-muted)",
              lineHeight: 1.45,
            }}
          >
            Receipt write timed out. Your transaction is confirmed on-chain — the Walrus
            receipt blob will be retried on the next session.
          </div>
        )}

        {/* Full on-chain digest for copy */}
        <div
          style={{
            padding: "9px 12px",
            background: "var(--bg-sub)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <code
            className="mono"
            style={{ fontSize: "10px", wordBreak: "break-all", color: "var(--fg-muted)" }}
          >
            {txDigest}
          </code>
          <p style={{ fontSize: "11px", color: "var(--fg-subtle)", margin: 0 }}>
            The bytes you signed matched the Guardian-approved PTB exactly.
          </p>
        </div>
      </div>

      {/* ── Footer note ── */}
      <div
        style={{
          padding: "11px 16px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-sub)",
          fontSize: "11.5px",
          color: "var(--fg-subtle)",
          lineHeight: 1.45,
        }}
      >
        Transaction confirmed on Sui. Review on the explorer for full details.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal row helper — label + truncated value + optional link/icon
// ---------------------------------------------------------------------------

function ReceiptRow({
  label,
  value,
  action,
  title,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span
        className="flex items-center gap-1.5"
        style={{ color: "var(--fg)" }}
        title={title}
      >
        {value}
        {action}
      </span>
    </div>
  );
}
