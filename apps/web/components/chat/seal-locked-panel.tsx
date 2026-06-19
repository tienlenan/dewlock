"use client";

/**
 * Inline unlock panel shown in the chat area when the active conversation is Seal-encrypted
 * and not yet decrypted this session. NOT a dialog/overlay — it lives in the message flow.
 * Clicking "Sign to unlock" triggers the one-time SessionKey signature; on success the parent
 * clears the locked state and renders the decrypted thread.
 */

import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

export function SealLockedPanel({
  onUnlock,
  error,
}: {
  onUnlock: () => Promise<void> | void;
  error?: string | null;
}) {
  const [signing, setSigning] = useState(false);

  const handleUnlock = async () => {
    setSigning(true);
    try {
      await onUnlock();
    } catch {
      /* error surfaces via the `error` prop from the parent */
    } finally {
      setSigning(false);
    }
  };

  return (
    <div
      className="flex-1 flex items-center justify-center"
      style={{ padding: "32px 20px", minHeight: 0, animation: "fadeUp 0.3s ease both" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          padding: "32px 30px",
          maxWidth: 380,
          textAlign: "center",
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--bg-elev)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Lock medallion with a soft accent wash */}
        <div
          style={{
            position: "relative",
            width: 56,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: "var(--accent-soft)",
            color: "var(--accent-ink)",
          }}
        >
          <Lock size={24} aria-hidden />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--fg)", margin: 0 }}>
            Encrypted conversation
          </p>
          <p style={{ fontSize: "13px", color: "var(--fg-muted)", margin: 0, lineHeight: 1.55 }}>
            This chat is sealed to your wallet with <strong style={{ color: "var(--fg)" }}>Seal</strong>.
            Only you can decrypt it — sign once to unlock it for this session.
          </p>
        </div>

        {error && (
          <p style={{ fontSize: "12px", color: "var(--destructive)", margin: 0, lineHeight: 1.4 }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleUnlock()}
          disabled={signing}
          className="split-mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 22px",
            border: "1px solid var(--accent)",
            borderRadius: 10,
            background: signing ? "var(--accent-soft)" : "var(--accent)",
            color: signing ? "var(--accent-ink)" : "#fff",
            fontSize: "12.5px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: signing ? "default" : "pointer",
            transition: "opacity 120ms, background 120ms",
            opacity: signing ? 0.9 : 1,
          }}
          onMouseEnter={(e) => { if (!signing) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = signing ? "0.9" : "1"; }}
        >
          <ShieldCheck size={15} aria-hidden />
          {signing ? "Waiting for signature…" : "Sign to unlock"}
        </button>
      </div>
    </div>
  );
}
