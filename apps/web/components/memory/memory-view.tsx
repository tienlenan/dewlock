"use client";

/**
 * MemoryView — the Memory page: shows GLOBAL (seeded knowledge) + USER (per-wallet)
 * memory categories with approximate counts + samples, and a clear action gated by
 * a wallet signature (the only proof of wallet control, since there's no login).
 * Honest throughout: disconnected / memory-off / permanent-category states.
 */

import { useCallback, useEffect, useState } from "react";
import { useCurrentAccount, useSignPersonalMessage, ConnectButton } from "@mysten/dapp-kit";
import { Brain } from "lucide-react";
import { MemoryCategoryCard, type MemoryCategoryDto } from "./memory-category-card";

interface MemoryApiResponse {
  memoryEnabled: boolean;
  approximate?: boolean;
  categories: MemoryCategoryDto[];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="split-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-muted)", margin: "4px 0 10px" }}>
      {children}
    </div>
  );
}

export function MemoryView() {
  const account = useCurrentAccount();
  const wallet = account?.address;
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  const [data, setData] = useState<MemoryApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wallet) { setData(null); return; }
    try {
      const res = await fetch(`/api/memory?wallet=${encodeURIComponent(wallet)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memory");
    }
  }, [wallet]);

  useEffect(() => { void load(); }, [load]);

  const handleClear = useCallback(
    async (key: string) => {
      if (!wallet || clearing) return;
      setClearing(key);
      // Optimistic: zero the category now; reload after to reflect the truth.
      setData((d) => (d ? { ...d, categories: d.categories.map((c) => (c.key === key ? { ...c, approxCount: 0, samples: [] } : c)) } : d));
      try {
        const message = `clear-memory:${wallet}:${Date.now()}`;
        const { signature } = await signPersonalMessage({ message: new TextEncoder().encode(message) });
        const res = await fetch(`/api/memory?wallet=${encodeURIComponent(wallet)}&category=${encodeURIComponent(key)}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, signature }),
        });
        if (!res.ok) throw new Error(`clear ${res.status}`);
      } catch {
        await load(); // rollback to server truth (e.g. user rejected the signature)
      } finally {
        setClearing(null);
      }
    },
    [wallet, clearing, signPersonalMessage, load],
  );

  if (!wallet) {
    return (
      <div style={{ padding: 24, maxWidth: 560 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Memory</h1>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 14 }}>Connect a wallet to view what Dewlock remembers for you.</p>
        <ConnectButton />
      </div>
    );
  }

  const global = data?.categories.filter((c) => c.scope === "global") ?? [];
  const user = data?.categories.filter((c) => c.scope === "user") ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <Brain size={18} aria-hidden style={{ color: "var(--accent-ink)" }} />
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Memory</h1>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 18, lineHeight: 1.5 }}>
        What Dewlock remembers — stored in memwal (mutable) + Walrus (immutable). Counts are approximate.
        Clearing requires a wallet signature; your activity &amp; level are permanent and can&apos;t be cleared here.
      </p>

      {error && <p style={{ fontSize: 12, color: "var(--destructive)", marginBottom: 12 }}>{error}</p>}
      {data && !data.memoryEnabled && (
        <p style={{ fontSize: 12.5, color: "var(--fg-faint)" }}>Memory is not configured for this deployment.</p>
      )}

      {global.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>GLOBAL MEMORY</SectionLabel>
          <div style={{ display: "grid", gap: 10 }}>
            {global.map((c) => <MemoryCategoryCard key={c.key} category={c} clearing={clearing === c.key} onClear={handleClear} />)}
          </div>
        </section>
      )}

      {user.length > 0 && (
        <section>
          <SectionLabel>YOUR MEMORY</SectionLabel>
          <div style={{ display: "grid", gap: 10 }}>
            {user.map((c) => <MemoryCategoryCard key={c.key} category={c} clearing={clearing === c.key} onClear={handleClear} />)}
          </div>
        </section>
      )}
    </div>
  );
}
