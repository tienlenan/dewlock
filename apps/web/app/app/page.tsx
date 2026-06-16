"use client";

/**
 * /app — Dewlock copilot shell.
 *
 * Theme: local light/dark state (default dark, matching the mockup).
 * Persisted to localStorage "dewlock-app-theme". Toggled by AppThemeToggle
 * in the header — INDEPENDENT from the next-themes global provider used by
 * the landing page (so landing defaults light, /app defaults dark, neither
 * bleeds into the other).
 *
 * The `dark` class is applied to this component's root div only, not to
 * <html> — so all CSS custom properties inside this subtree resolve
 * from the .dark ruleset while the rest of the document stays unaffected.
 *
 * Disconnect: useDisconnectWallet() from dapp-kit — shown in both the header
 * wallet pill and the sidebar footer when a wallet is connected.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, LogOut } from "lucide-react";
import {
  useCurrentAccount,
  useDisconnectWallet,
  ConnectButton,
} from "@mysten/dapp-kit";
import { useSuiGasBalance } from "@/lib/use-sui-gas-balance";
import { formatMistAsSui, shortAddress } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AppThemeToggle } from "@/components/app/app-theme-toggle";
import { AppSidebar } from "@/components/app/app-sidebar";
import { ChatThread } from "@/components/chat/chat-thread";
import { ChatInput } from "@/components/chat/chat-input";
import { useCopilotChat } from "@/components/chat/use-copilot-chat";

// ---------------------------------------------------------------------------
// Local-theme hook — reads/writes localStorage "dewlock-app-theme".
// Default: "dark" (matches the mockup aesthetic for the copilot surface).
// Returns [isDark, toggle] — caller adds/removes `dark` class on the shell root.
// ---------------------------------------------------------------------------

const APP_THEME_KEY = "dewlock-app-theme";

function useAppTheme() {
  const [isDark, setIsDark] = useState(true); // SSR-safe default = dark

  // Hydrate from localStorage on mount only (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(APP_THEME_KEY);
      // If a preference was saved, use it; otherwise keep default dark
      if (stored === "light") setIsDark(false);
      else setIsDark(true);
    } catch {
      // localStorage unavailable (private browsing edge case) — stay dark
    }
  }, []);

  function toggle() {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(APP_THEME_KEY, next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return { isDark, toggle };
}

// ---------------------------------------------------------------------------
// DisconnectButton — calls useDisconnectWallet() on click.
// Shown in the header wallet pill area and/or sidebar footer when connected.
// ---------------------------------------------------------------------------

function DisconnectButton({ compact = false }: { compact?: boolean }) {
  const { mutate: disconnect } = useDisconnectWallet();
  return (
    <button
      type="button"
      onClick={() => disconnect()}
      title="Disconnect wallet"
      aria-label="Disconnect wallet"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 0 : 5,
        padding: compact ? "4px 6px" : "4px 10px",
        border: "1px solid var(--border)",
        borderRadius: 99,
        background: "transparent",
        color: "var(--fg-muted)",
        fontSize: "11px",
        cursor: "pointer",
        transition: "color 120ms, border-color 120ms",
        flexShrink: 0,
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
      <LogOut size={12} aria-hidden />
      {!compact && <span className="mono" style={{ letterSpacing: "0.04em" }}>Disconnect</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Connect gate — shown when no wallet is connected
// ---------------------------------------------------------------------------

function ConnectGate() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div
        className="w-full flex flex-col gap-4"
        style={{
          maxWidth: "400px",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "28px",
          background: "var(--bg-elev)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <p
          className="split-mono"
          style={{ fontSize: "10px", color: "var(--accent-ink)" }}
        >
          Dewlock Copilot
        </p>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--fg)", margin: 0 }}>
          Connect your wallet to begin
        </h2>
        <p style={{ fontSize: "13.5px", color: "var(--fg-muted)", lineHeight: 1.55, margin: 0 }}>
          Dewlock builds, previews, and safely signs Sui DeFi transactions.
          The Guardian inspects every action before your wallet is asked to sign.
        </p>
        <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 14 }}>
          <p
            className="split-mono"
            style={{ fontSize: "10px", color: "var(--accent-ink)", marginBottom: 4 }}
          >
            Security invariant
          </p>
          <p style={{ fontSize: "12.5px", color: "var(--fg-subtle)", lineHeight: 1.45, margin: 0 }}>
            The server builds unsigned transactions only.
            Your private keys never leave your wallet.
          </p>
        </div>
        <div className="mt-1">
          <ConnectButton connectText="Connect Wallet" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat shell — rendered only when a wallet is connected
// ---------------------------------------------------------------------------

function ChatShell({ walletAddress }: { walletAddress: string }) {
  const { messages, isStreaming, sendMessage, onDemoResult, onReplaceCard } =
    useCopilotChat(walletAddress);

  return (
    <>
      <ChatThread messages={messages} onReplaceCard={onReplaceCard} />
      <ChatInput
        onSendText={(t) => void sendMessage(t)}
        onDemoResult={onDemoResult}
        walletAddress={walletAddress}
        disabled={isStreaming}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AppPage() {
  const account = useCurrentAccount();
  const gas = useSuiGasBalance(account?.address);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Local app theme — dark by default, independent of landing global theme
  const { isDark, toggle: toggleAppTheme } = useAppTheme();

  function handleNewConversation() {
    window.location.reload();
  }

  return (
    /*
     * `dark` class applied HERE (to the /app shell root) when isDark=true.
     * This scopes all .dark CSS custom-property overrides to this subtree only.
     * The landing page (<html> element) is untouched.
     */
    <div
      className={isDark ? "dark" : ""}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--fg)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ── Top bar ── */}
      <header
        style={{
          flexShrink: 0,
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elev)",
        }}
      >
        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden flex items-center justify-center"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
          style={{
            width: 34,
            height: 34,
            border: "1px solid var(--border)",
            borderRadius: 9,
            background: "var(--bg-elev)",
            color: "var(--fg-muted)",
            cursor: "pointer",
          }}
        >
          <Menu size={16} />
        </button>

        {/* Brand — mark + copilot label. BrandLogo is theme-aware via CSS dark: */}
        <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
          <BrandLogo variant="mark" height={26} />
        </Link>
        <span
          className="split-mono hidden sm:inline"
          style={{
            fontSize: "10px",
            letterSpacing: "0.1em",
            color: "var(--fg-faint)",
            borderLeft: "1px solid var(--border)",
            paddingLeft: 12,
          }}
        >
          copilot
        </span>

        {/* Right controls */}
        <div className="ml-auto flex items-center" style={{ gap: 10 }}>
          {/* Network pill */}
          <span
            className="hidden sm:inline-flex items-center split-mono"
            style={{
              gap: 7,
              fontSize: "10px",
              letterSpacing: "0.1em",
              color: "var(--fg-muted)",
              border: "1px solid var(--border)",
              background: "var(--bg-sub)",
              padding: "6px 10px",
              borderRadius: 99,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: "var(--success)",
                animation: "pulse 2.4s ease-in-out infinite",
              }}
            />
            sui:{gas.network}
          </span>

          {/* Wallet pill — address + gas balance + disconnect button */}
          {account && (
            <span
              className="hidden sm:inline-flex items-center"
              style={{
                gap: 8,
                background: "var(--bg-sub)",
                border: "1px solid var(--border)",
                borderRadius: 99,
                padding: "5px 7px 5px 11px",
                fontSize: "12.5px",
                color: "var(--fg)",
              }}
            >
              <span className="mono" style={{ fontSize: "11px" }}>
                {shortAddress(account.address)}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: "10.5px",
                  color: "var(--fg-muted)",
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border)",
                  borderRadius: 99,
                  padding: "2px 8px",
                }}
              >
                {gas.loading ? "…" : formatMistAsSui(gas.mist)}
              </span>
              {/* Disconnect — compact icon-only in the pill */}
              <DisconnectButton compact />
            </span>
          )}

          {/* Connect button when no wallet */}
          {!account && (
            <div className="hidden sm:block">
              <ConnectButton connectText="Connect" />
            </div>
          )}

          {/* Local app theme toggle — flips dark class on this shell only */}
          <AppThemeToggle isDark={isDark} onToggle={toggleAppTheme} />
        </div>
      </header>

      {/* ── Body row: sidebar + main ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <AppSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewConversation={handleNewConversation}
        />

        {/* Main chat column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {account ? (
            <ChatShell walletAddress={account.address} />
          ) : (
            <ConnectGate />
          )}
        </div>
      </div>
    </div>
  );
}
