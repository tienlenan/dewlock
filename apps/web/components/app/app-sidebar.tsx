"use client";

/**
 * AppSidebar — left panel of the /app copilot shell.
 *
 * Sections (top → bottom):
 *   New conversation button
 *   Session list (sample entries — labeled preview)
 *   Memory summary chip (sample — labeled preview)
 *   Wallet/network footer (live — reuses ConnectBar logic inline)
 *
 * Width: 248px fixed on desktop. On mobile (≤768px) it is hidden and
 * replaced by a slide-in drawer triggered by the hamburger button in
 * the app shell header. The `open` + `onClose` props wire that drawer.
 */

import { X, LogOut } from "lucide-react";
import { useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import { useSuiGasBalance } from "@/lib/use-sui-gas-balance";
import { formatMistAsSui, shortAddress } from "@/lib/utils";
import { SessionList } from "./session-list";

// Plus icon matching mockup "New conversation" button
function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Star icon for memory section header
function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2l1.6 3.6L13.5 6l-2.9 2.6.8 4L8 10.8 4.6 12.6l.8-4L2.5 6l3.9-.4L8 2Z"
        stroke="var(--accent-ink)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface AppSidebarProps {
  /** Controls mobile drawer visibility */
  open: boolean;
  /** Called when drawer overlay or close button is clicked */
  onClose: () => void;
  /** Called when "New conversation" is clicked */
  onNewConversation: () => void;
}

export function AppSidebar({ open, onClose, onNewConversation }: AppSidebarProps) {
  const account = useCurrentAccount();
  const gas = useSuiGasBalance(account?.address);
  const { mutate: disconnect } = useDisconnectWallet();

  const sidebarContent = (
    <aside
      className="flex flex-col gap-1.5 h-full"
      style={{
        width: "248px",
        background: "var(--bg-sub)",
        borderRight: "1px solid var(--border)",
        padding: "14px 12px",
        flexShrink: 0,
      }}
    >
      {/* Mobile close button */}
      <div className="flex items-center justify-between mb-1 md:hidden">
        <span
          className="split-mono"
          style={{ fontSize: "9.5px", color: "var(--fg-faint)", letterSpacing: "0.12em" }}
        >
          copilot
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 28,
            height: 28,
            color: "var(--fg-muted)",
            border: "1px solid var(--border)",
            background: "var(--bg-elev)",
          }}
          aria-label="Close sidebar"
        >
          <X size={14} />
        </button>
      </div>

      {/* New conversation CTA */}
      <button
        type="button"
        onClick={() => { onNewConversation(); onClose(); }}
        className="flex items-center gap-2 rounded-lg font-semibold transition-opacity hover:opacity-90"
        style={{
          height: "38px",
          padding: "0 12px",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          fontSize: "13.5px",
          boxShadow: "var(--shadow-aqua)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <PlusIcon />
        New conversation
      </button>

      {/* Session list */}
      <SessionList />

      {/* Memory summary — preview */}
      <div
        className="mt-auto rounded-lg p-3"
        style={{
          border: "1px solid var(--border)",
          background: "var(--bg-elev)",
          flexShrink: 0,
        }}
      >
        <div
          className="flex items-center gap-1.5 split-mono mb-2"
          style={{ fontSize: "9.5px", color: "var(--accent-ink)", letterSpacing: "0.12em" }}
        >
          <StarIcon />
          memory
          <span
            className="ml-auto rounded px-1"
            style={{
              fontSize: "9px",
              background: "var(--accent-soft)",
              color: "var(--fg-faint)",
              border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
            }}
          >
            preview
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "11.5px", lineHeight: 1.45, color: "var(--fg-muted)" }}>
          Daily cap{" "}
          <strong style={{ color: "var(--fg)" }}>$5,000</strong>
          {" · "}risk profile{" "}
          <strong style={{ color: "var(--fg)" }}>conservative</strong>
          {" · "}1 saved contact.
        </p>
      </div>

      {/* Wallet / network footer */}
      <div
        className="rounded-lg p-3 flex flex-col gap-2"
        style={{
          border: "1px solid var(--border)",
          background: "var(--bg-elev)",
          flexShrink: 0,
        }}
      >
        {/* Network badge */}
        <div
          className="flex items-center gap-1.5 split-mono"
          style={{ fontSize: "9.5px", color: "var(--fg-muted)" }}
        >
          {/* Pulsing dot */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: "var(--success)",
              flexShrink: 0,
              animation: "pulse 2.4s ease-in-out infinite",
            }}
          />
          sui:{gas.network}
        </div>

        {account ? (
          <>
            {/* Address + gas balance pill */}
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{
                background: "var(--bg-sub)",
                border: "1px solid var(--border)",
                fontSize: "12px",
              }}
            >
              <span className="mono flex-1 truncate" style={{ fontSize: "10.5px", color: "var(--fg)" }}>
                {shortAddress(account.address)}
              </span>
              <span
                className="mono shrink-0 rounded-full px-2 py-0.5"
                style={{
                  fontSize: "10px",
                  color: "var(--fg-muted)",
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border)",
                }}
              >
                {gas.loading ? "…" : formatMistAsSui(gas.mist)}
              </span>
            </div>

            {/* Disconnect — visible only when connected */}
            <button
              type="button"
              onClick={() => disconnect()}
              aria-label="Disconnect wallet"
              className="flex items-center gap-1.5 w-full rounded-lg px-2.5 py-1.5 transition-colors"
              style={{
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--fg-muted)",
                fontSize: "11px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--destructive)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--destructive)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              }}
            >
              <LogOut size={11} aria-hidden />
              <span className="mono" style={{ letterSpacing: "0.04em" }}>Disconnect</span>
            </button>
          </>
        ) : (
          <span style={{ fontSize: "11px", color: "var(--fg-faint)" }}>No wallet connected</span>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <div className="hidden md:flex h-full">{sidebarContent}</div>

      {/* Mobile: drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={onClose}
            aria-hidden
          />
          {/* Drawer panel */}
          <div className="relative z-50 flex h-full" style={{ boxShadow: "var(--shadow-lg)" }}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
