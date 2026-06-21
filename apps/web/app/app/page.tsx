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

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, Settings, LogOut, PanelLeftOpen, Users } from "lucide-react";
import {
  useCurrentAccount,
  useDisconnectWallet,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { useSuiGasBalance } from "@/lib/use-sui-gas-balance";
import { useSuinsName } from "@/lib/use-suins-name";
import { CopyAddressButton } from "@/components/copy-address-button";
import { formatMistAsSui, shortAddress } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AppThemeToggle } from "@/components/app/app-theme-toggle";
import { AppSidebar, type AppView } from "@/components/app/app-sidebar";
import { GuidePanel } from "@/components/app/guide-panel";
import { ChatThread } from "@/components/chat/chat-thread";
import { SealLockedPanel } from "@/components/chat/seal-locked-panel";
import { ChatInput } from "@/components/chat/chat-input";
import { ConversationPanel } from "@/components/chat/conversation-panel";
import { useConversations } from "@/lib/conversations/use-conversations";
import { buildSuggestions } from "@/lib/suggestions";
import { useCopilotChat } from "@/components/chat/use-copilot-chat";
import { useContacts } from "@/lib/contacts/use-contacts";
import { FriendListDialog } from "@/components/contacts/friend-list-dialog";
import { UserDashboard, NetworkDashboard } from "@/components/dashboard/dashboard-client";
import { MemoryView } from "@/components/memory/memory-view";
import { ProtocolList } from "@/components/protocols/protocol-list";

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
          <ConnectWalletButton label="Connect Wallet" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat shell — rendered only when a wallet is connected
// ---------------------------------------------------------------------------

type ChatApi = ReturnType<typeof useCopilotChat>;
type ConvosApi = ReturnType<typeof useConversations>;

const CONVOS_COLLAPSE_KEY = "dewlock:convos-collapsed";

function ChatShell({
  chat,
  convos,
  walletAddress,
  contacts,
}: {
  chat: ChatApi;
  // Conversation list + persistence are owned by AppPage (always mounted), passed in so a
  // view switch (chat ↔ dashboard ↔ protocols) never unmounts the hook and loses the active
  // conversation id — which made the next autosave write a DUPLICATE conversation.
  convos: ConvosApi;
  walletAddress: string;
  contacts: { name: string; address: string }[];
}) {
  // Collapse = fully hide the panel (persisted). When hidden, an expand button
  // appears at the top-left of the chat column.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(CONVOS_COLLAPSE_KEY) === "1"); } catch { /* ignore */ }
  }, []);
  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem(CONVOS_COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });

  // Mobile: the inline panel is hidden (<md), so conversations open as an off-canvas drawer.
  const [convosOpen, setConvosOpen] = useState(false);

  // Context-aware suggestion chips: from the latest portfolio card's holdings + last card type.
  const reversed = [...chat.messages].reverse();
  // Guard m.cards — streaming/user messages can arrive before cards is set, and
  // flatMap over an undefined would seed `undefined` entries that crash `.find`.
  const lastPortfolio = reversed.flatMap((m) => m.cards ?? []).find((c) => c?.type === "portfolio");
  const holdings =
    lastPortfolio?.type === "portfolio"
      ? lastPortfolio.portfolio.balances.map((b) => b.displayTicker)
      : [];
  const lastCardType = reversed.find((m) => (m.cards?.length ?? 0) > 0)?.cards?.at(-1)?.type;
  const suggestions = buildSuggestions({ connected: true, holdings, lastCardType });

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* Conversation history — beside the chat; fully hidden when collapsed */}
      {!collapsed && (
        <ConversationPanel
          sessions={convos.list}
          activeId={convos.activeId}
          loadingId={convos.loadingId}
          onSelect={(id) => void convos.open(id)}
          onDelete={(id) => void convos.remove(id)}
          onClearAll={() => void convos.clearAll()}
          onNewConversation={() => convos.create()}
          onCollapse={toggleCollapsed}
        />
      )}
      {/* Chat column */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, position: "relative" }}>
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Show conversations"
            title="Show conversations"
            className="hidden md:flex items-center justify-center transition-colors"
            style={{ position: "absolute", top: 12, left: 12, zIndex: 5, width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elev)", color: "var(--fg-muted)", cursor: "pointer" }}
          >
            <PanelLeftOpen size={15} aria-hidden />
          </button>
        )}
        {/* Mobile: floating trigger to open the conversations drawer (inline panel is md+ only). */}
        <button
          type="button"
          onClick={() => setConvosOpen(true)}
          aria-label="Show conversations"
          title="Conversations"
          className="md:hidden flex items-center justify-center transition-colors"
          style={{ position: "absolute", top: 12, left: 12, zIndex: 5, width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elev)", color: "var(--fg-muted)", cursor: "pointer" }}
        >
          <PanelLeftOpen size={15} aria-hidden />
        </button>
        {/* Mobile: conversations as an off-canvas drawer + backdrop. */}
        {convosOpen && (
          <div className="md:hidden" style={{ position: "fixed", inset: 0, zIndex: 50 }}>
            <div
              onClick={() => setConvosOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}
            />
            <div
              style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "min(82vw, 300px)", background: "var(--bg)", boxShadow: "var(--shadow-md)", display: "flex" }}
            >
              <ConversationPanel
                mode="drawer"
                sessions={convos.list}
                activeId={convos.activeId}
                loadingId={convos.loadingId}
                onSelect={(id) => { void convos.open(id); setConvosOpen(false); }}
                onDelete={(id) => void convos.remove(id)}
                onClearAll={() => void convos.clearAll()}
                onNewConversation={() => { convos.create(); setConvosOpen(false); }}
                onCollapse={() => setConvosOpen(false)}
              />
            </div>
          </div>
        )}
        {/* Locked → inline Seal unlock card (in the chat flow, not a dialog). Once unlocked,
            the decrypted thread renders in its place. */}
        {convos.lockedId && convos.lockedId === convos.activeId ? (
          <SealLockedPanel
            onUnlock={() => convos.unlock(convos.activeId!)}
            error={convos.decryptError}
          />
        ) : (
          <ChatThread messages={chat.messages} onReplaceCard={chat.onReplaceCard} walletAddress={walletAddress} onSend={(t) => void chat.sendMessage(t)} />
        )}
        <ChatInput
          onSendText={(t) => void chat.sendMessage(t)}
          disabled={chat.isStreaming}
          suggestions={suggestions}
          contacts={contacts}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AppPage() {
  const account = useCurrentAccount();
  const gas = useSuiGasBalance(account?.address);
  const { name: suinsName } = useSuinsName(account?.address);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  // Single-UI content view — sidebar nav + Settings switch this in place (no routing).
  const [view, setView] = useState<AppView>("chat");

  // Local app theme — dark by default, independent of landing global theme
  const { isDark, toggle: toggleAppTheme } = useAppTheme();

  // Lifted friend address book — ONE instance shared by the dialog, the dashboard card,
  // and the chat (single write path / single-flight). Its `contacts` feed the agent so a
  // just-added/deleted friend resolves immediately (memwal recall lags ~30s).
  const contactsApi = useContacts(account?.address ?? "");

  // Chat thread is the single source for the chat column. Conversation history
  // (list + persistence) is self-contained in AppSidebar, bound via the chat callbacks.
  const chat = useCopilotChat(account?.address ?? "", contactsApi.contacts);

  // Conversation list + persistence live at the PAGE level — the SAME level as `chat`, which
  // is always mounted. Switching views unmounts only the body (ChatShell), so keeping the
  // conversation hook here means the active conversation id (idRef/activeId) survives a view
  // switch. Previously this lived in ChatShell: a switch reset the id, so the next autosave
  // wrote a DUPLICATE conversation (same content under a fresh id).
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const convos = useConversations(account?.address, {
    onLoad: chat.loadMessages,
    onReset: chat.reset,
    signPersonalMessage,
  });

  // Debounced persist — ~1.5s after activity settles, never mid-stream. Keys off
  // chat.messages so it also captures post-stream card swaps (tx-preview → receipt after
  // the user signs), which an isStreaming-edge trigger would miss.
  useEffect(() => {
    if (chat.isStreaming || chat.messages.length === 0) return;
    // Never persist a thread that belongs to a DIFFERENT wallet (the switch window before the
    // reset lands) — that would write wallet A's content under wallet B's namespace.
    if (chat.threadWallet && chat.threadWallet !== account?.address) return;
    const t = setTimeout(() => void convos.saveCurrent(chat.messages), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages, chat.isStreaming]);

  // Durability backstop — flush the freshest thread when the page is hidden / on unmount
  // (the 1.5s debounce loses the last turn if the user leaves first). visibilitychange
  // (hidden) is the reliable cross-platform leave signal — beforeunload is dropped on mobile.
  // Refs keep the listener registered once while flushing the latest messages.
  const latestMessagesRef = useRef(chat.messages);
  latestMessagesRef.current = chat.messages;
  const convosRef = useRef(convos);
  convosRef.current = convos;
  // Owner-wallet of the thread + the live wallet — so the flush (which reads refs, not props)
  // can apply the same cross-wallet guard as the debounced save above.
  const threadWalletRef = useRef(chat.threadWallet);
  threadWalletRef.current = chat.threadWallet;
  const liveWalletRef = useRef(account?.address);
  liveWalletRef.current = account?.address;
  useEffect(() => {
    const flush = () => {
      const msgs = latestMessagesRef.current;
      const owner = threadWalletRef.current;
      if (msgs.length > 0 && (!owner || owner === liveWalletRef.current)) {
        void convosRef.current.saveCurrent(msgs);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

  // Honor a ?view= deep link (the old /dashboard, /protocols, /bridge routes
  // redirect here) so there's a single UI but links still land on the right view.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    // Legacy "dashboard" → My Dashboard; otherwise honor the explicit view.
    if (v === "dashboard") setView("my-dashboard");
    else if (v === "my-dashboard" || v === "network-dashboard" || v === "memory" || v === "protocols" || v === "guide") setView(v);
  }, []);


  return (
    /*
     * Self-contained theme on the /app shell root: `theme-dark`/`theme-light`
     * RE-DECLARE the full token set, so the /app theme always wins over the global
     * next-themes class on <html> (e.g. landing set to dark) — the toggle works
     * regardless of the landing's theme. `dark` is kept in dark mode for any
     * descendant relying on the Tailwind dark variant.
     */
    <div
      className={isDark ? "dark theme-dark" : "theme-light"}
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
      {/* Skip-to-main link — visually hidden, becomes visible on keyboard focus */}
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[999] focus:px-3 focus:py-2 focus:rounded focus:text-sm focus:font-semibold"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        Skip to main content
      </a>
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
          aria-controls="app-sidebar"
          aria-expanded={sidebarOpen}
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
          {/* Icon-only button — label above is the accessible name */}
          <Menu size={16} aria-hidden />
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
              <span className="mono" style={{ fontSize: "11px" }} title={account.address}>
                {suinsName ?? shortAddress(account.address)}
              </span>
              <CopyAddressButton address={account.address} size={12} />
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
              <ConnectWalletButton label="Connect" size="sm" />
            </div>
          )}

          {/* Friend list — opens the address-book dialog (manage saved friends) */}
          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            aria-label="Friend list"
            title="Friend list"
            style={{
              width: 34,
              height: 34,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border)",
              borderRadius: 9,
              background: "var(--bg-elev)",
              color: "var(--fg-muted)",
              cursor: "pointer",
            }}
          >
            <Users size={15} aria-hidden />
          </button>

          {/* Settings — opens the supported-protocols view */}
          <button
            type="button"
            onClick={() => setView("protocols")}
            aria-label="Settings — supported protocols"
            aria-pressed={view === "protocols"}
            style={{
              width: 34,
              height: 34,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border)",
              borderRadius: 9,
              background: view === "protocols" ? "var(--accent-soft)" : "var(--bg-elev)",
              color: view === "protocols" ? "var(--accent-ink)" : "var(--fg-muted)",
              cursor: "pointer",
            }}
          >
            <Settings size={15} aria-hidden />
          </button>

          {/* Local app theme toggle — flips dark class on this shell only */}
          <AppThemeToggle isDark={isDark} onToggle={toggleAppTheme} />
        </div>
      </header>

      {/* ── Body row: sidebar + main ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <AppSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeView={view}
          onSelectView={setView}
        />

        {/* Main content panel — single UI: the view switches in place */}
        <main
          id="app-main"
          style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
        >
          {view === "chat" ? (
            account ? <ChatShell chat={chat} convos={convos} walletAddress={account.address} contacts={contactsApi.contacts} /> : <ConnectGate />
          ) : (
            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: "32px clamp(16px, 4vw, 40px)", display: "flex", flexDirection: "column", alignItems: "center" }}
            >
              {view === "my-dashboard" && (
                <UserDashboard contactsApi={contactsApi} onManageContacts={() => setFriendsOpen(true)} />
              )}
              {view === "network-dashboard" && <NetworkDashboard />}
              {view === "memory" && <MemoryView />}
              {view === "protocols" && <ProtocolList />}
              {view === "guide" && <GuidePanel />}
            </div>
          )}
        </main>
      </div>

      {/* Friend list dialog — available from any view via the header button */}
      <FriendListDialog
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        api={contactsApi}
        connected={!!account}
      />
    </div>
  );
}
