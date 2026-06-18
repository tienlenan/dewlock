"use client";

/**
 * PassportCard — the user's Dewlock Passport rendered as a premium, always-dark
 * membership card: gradient glows + guilloché wash + EMV chip + gradient level +
 * XP bar + stat tiles + badge chips + a holographic proof footer (Walrus blob +
 * Sui object). Live stats from /api/passport (display authority); cap/risk omitted.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ShieldCheck, ExternalLink, Share2, Check } from "lucide-react";
import { TX_CONFIRMED_EVENT, DASHBOARD_RELOAD_EVENT } from "@/lib/tx-events";
import { readDashCache, writeDashCache } from "@/lib/dashboard/dashboard-cache";
import { buildSuiObjectUrl, buildWalrusAggregatorUrl, shortHash } from "@/lib/explorer-urls";
import { shortAddress } from "@/lib/utils";

interface PassportDto {
  level: number;
  xp: number;
  title: string;
  earnedBadgeIds: string[];
  actionCounts: { transfer: number; swap: number; lend: number; bridge: number; limit: number };
  txCount: number;
  memberSince: string | null;
}
interface PassportApi {
  passport: PassportDto;
  blobId: string | null;
  suiObjectId: string | null;
  progress?: { xpIntoLevel: number; xpForNext: number | null };
}

const INK = "hsl(205 22% 90%)";
const FAINT = "hsl(205 14% 60%)";
const HAIR = "rgba(255,255,255,0.10)";

function prettyBadge(id: string): string {
  return id.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** EMV-style smartcard chip — brushed steel-blue to match the card (not gold). */
function Chip() {
  return (
    <div style={{ width: 34, height: 26, borderRadius: 6, background: "linear-gradient(135deg, #e8eef6 0%, #b7c7da 45%, #8ea4bd 100%)", position: "relative", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35), inset 0 0 0 2px rgba(20,40,70,0.25)" }} aria-hidden>
      <div style={{ position: "absolute", inset: 4, borderRadius: 3, border: "1px solid rgba(20,40,70,0.30)" }} />
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(20,40,70,0.30)" }} />
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(20,40,70,0.30)" }} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${HAIR}`, borderRadius: 10, padding: "8px 10px", display: "grid", gap: 2 }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{value}</span>
      <span className="split-mono" style={{ fontSize: 8.5, letterSpacing: "0.1em", color: FAINT }}>{label}</span>
    </div>
  );
}

function ProofLink({ label, value, href, title }: { label: string; value: string | null; href: string | null; title: string }) {
  return (
    <div className="flex items-center justify-between" style={{ fontSize: 10.5 }}>
      <span style={{ color: FAINT }}>{label}</span>
      {value && href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" title={title} className="flex items-center gap-1" style={{ color: "var(--accent-2)" }}>
          {shortHash(value)} <ExternalLink size={10} aria-hidden />
        </a>
      ) : (
        <span style={{ color: FAINT }}>{value ? shortHash(value) : "—"}</span>
      )}
    </div>
  );
}

export function PassportCard() {
  const account = useCurrentAccount();
  const wallet = account?.address;
  const [data, setData] = useState<PassportApi | null>(null);
  const [copied, setCopied] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const load = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/passport?wallet=${encodeURIComponent(wallet)}`);
      if (res.ok) {
        const json = (await res.json()) as PassportApi;
        setData(json);
        writeDashCache(`passport:${wallet}`, json); // refresh last-good cache
      }
    } catch { /* fail-soft */ }
  }, [wallet]);

  // Seed from the last-good cache INSTANTLY (no cold/empty passport while memwal is slow),
  // then revalidate via load(). memwal recall is slow + variable; cache stabilizes the paint.
  useEffect(() => {
    setData(wallet ? readDashCache<PassportApi>(`passport:${wallet}`) : null);
    void load();
  }, [wallet, load]);
  useEffect(() => {
    if (!wallet) return;
    function onTx() {
      timers.current.forEach(clearTimeout);
      // memwal indexes the action log ~30-43s after the write, so include a later
      // refetch (70s) — 40s alone can land just before it's queryable.
      timers.current = [8_000, 20_000, 40_000, 70_000].map((d) => setTimeout(() => void load(), d));
    }
    const onReload = () => void load(); // user-triggered hard reload → refetch now
    window.addEventListener(TX_CONFIRMED_EVENT, onTx);
    window.addEventListener(DASHBOARD_RELOAD_EVENT, onReload);
    return () => {
      window.removeEventListener(TX_CONFIRMED_EVENT, onTx);
      window.removeEventListener(DASHBOARD_RELOAD_EVENT, onReload);
      timers.current.forEach(clearTimeout);
    };
  }, [wallet, load]);

  if (!wallet) return null;
  const p = data?.passport;
  const suiUrl = data?.suiObjectId ? buildSuiObjectUrl(data.suiObjectId) : null;
  const blobUrl = data?.blobId ? buildWalrusAggregatorUrl(data.blobId) : null;
  const anchored = !!data?.suiObjectId;
  const into = data?.progress?.xpIntoLevel ?? 0;
  const next = data?.progress?.xpForNext ?? null;
  const pct = next != null && into + next > 0 ? Math.min(100, Math.round((into / (into + next)) * 100)) : 100;
  const badges = p?.earnedBadgeIds ?? [];

  function share() {
    const url = suiUrl ?? blobUrl;
    if (!url) return;
    void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <div
      className="w-full"
      style={{
        maxWidth: 440,
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        padding: "18px 20px 16px",
        color: INK,
        border: "1px solid color-mix(in srgb, var(--accent-2) 28%, var(--border-dark))",
        background:
          "radial-gradient(130% 80% at 0% 0%, color-mix(in srgb, var(--accent) 42%, transparent), transparent 58%)," +
          "radial-gradient(120% 90% at 100% 6%, color-mix(in srgb, var(--accent-2) 32%, transparent), transparent 55%)," +
          "var(--bg-ink)",
        boxShadow: "var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
    >
      {/* guilloché wash */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5,
        backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 10px)" }} />

      <div style={{ position: "relative", display: "grid", gap: 14 }}>
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Chip />
            <div style={{ display: "grid", gap: 1 }}>
              <span className="split-mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "#fff" }}>DEWLOCK PASSPORT</span>
              <span style={{ fontSize: 9.5, color: FAINT }}>{shortAddress(wallet)}</span>
            </div>
          </div>
          <button type="button" onClick={share} disabled={!suiUrl && !blobUrl}
            className="flex items-center gap-1.5"
            style={{ fontSize: 10.5, color: INK, background: "rgba(255,255,255,0.08)", border: `1px solid ${HAIR}`, borderRadius: 8, padding: "4px 9px", cursor: suiUrl || blobUrl ? "pointer" : "default" }}>
            {copied ? <Check size={11} aria-hidden /> : <Share2 size={11} aria-hidden />} {copied ? "Copied" : "Share"}
          </button>
        </div>

        {/* hero: level + title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em",
              background: "linear-gradient(180deg, #fff, var(--accent-2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              {p?.level ?? 1}
            </span>
            <div style={{ display: "grid", gap: 2, lineHeight: 1.1 }}>
              <span className="split-mono" style={{ fontSize: 9, letterSpacing: "0.14em", color: FAINT }}>LEVEL</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{p?.title ?? "Novice"}</span>
            </div>
          </div>
          {p?.memberSince && (
            <div style={{ textAlign: "right", display: "grid", gap: 2, lineHeight: 1.1 }}>
              <span className="split-mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: FAINT }}>MEMBER SINCE</span>
              <span style={{ fontSize: 11.5, color: INK }}>{p.memberSince.slice(0, 10)}</span>
            </div>
          )}
        </div>

        {/* XP bar */}
        <div style={{ display: "grid", gap: 4 }}>
          <div className="flex items-center justify-between" style={{ fontSize: 9.5, color: FAINT }}>
            <span className="split-mono" style={{ letterSpacing: "0.1em" }}>{p?.xp ?? 0} XP</span>
            <span>{next != null ? `${next} to Lv ${(p?.level ?? 1) + 1}` : "MAX"}</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg, var(--accent), var(--accent-2))", boxShadow: "0 0 8px color-mix(in srgb, var(--accent) 60%, transparent)", transition: "width .5s ease" }} />
          </div>
        </div>

        {/* stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <Stat label="ACTIONS" value={p?.txCount ?? 0} />
          <Stat label="SWAPS" value={p?.actionCounts.swap ?? 0} />
          <Stat label="SENDS" value={p?.actionCounts.transfer ?? 0} />
          <Stat label="BADGES" value={badges.length} />
        </div>

        {/* badge chips */}
        {badges.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 5 }}>
            {badges.slice(0, 5).map((id) => (
              <span key={id} className="split-mono" style={{ fontSize: 9, letterSpacing: "0.04em", color: "#fff", background: "color-mix(in srgb, var(--accent) 30%, transparent)", border: `1px solid color-mix(in srgb, var(--accent-2) 40%, transparent)`, borderRadius: 99, padding: "3px 8px" }}>
                {prettyBadge(id)}
              </span>
            ))}
            {badges.length > 5 && <span className="split-mono" style={{ fontSize: 9, color: FAINT, padding: "3px 4px" }}>+{badges.length - 5}</span>}
          </div>
        )}

        {/* proof footer */}
        <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 10, display: "grid", gap: 5 }}>
          <ProofLink label="walrus blob" value={data?.blobId ?? null} href={blobUrl} title="View passport blob on Walrus" />
          <ProofLink label={anchored ? "sui object · anchored" : "sui object"} value={data?.suiObjectId ?? null} href={suiUrl} title="View passport object on Sui" />
          <div className="flex items-center gap-1.5" style={{ fontSize: 9, color: FAINT, marginTop: 1 }}>
            <ShieldCheck size={11} aria-hidden style={{ color: "var(--accent-2)" }} />
            {anchored ? "Anchored on Sui" : "Stored on Walrus"} · self-reported activity through Dewlock
          </div>
        </div>
      </div>
    </div>
  );
}
