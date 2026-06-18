"use client";

/**
 * AppSidebar — left panel of the /app copilot shell.
 *
 * Sections (top → bottom):
 *   Navigation (Copilot / My Dashboard / Network / Bridge / Guide)
 *   Memory summary chip (real recall via memwal; honest empty state otherwise)
 *   Wallet/network footer (live — reuses ConnectBar logic inline)
 *
 * NOTE: conversation history lives in ConversationPanel (beside the chat), NOT here.
 *
 * Width: 248px fixed on desktop. On mobile (≤768px) it is hidden and
 * replaced by a slide-in drawer triggered by the hamburger button in
 * the app shell header. The `open` + `onClose` props wire that drawer.
 */

import Link from "next/link";
import { X, LogOut, MessageSquare, LayoutDashboard, Globe, ArrowLeftRight, BookOpen, Brain } from "lucide-react";
import { useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import { useSuiGasBalance } from "@/lib/use-sui-gas-balance";
import { useSuinsName } from "@/lib/use-suins-name";
import { CopyAddressButton } from "@/components/copy-address-button";
import { formatMistAsSui, shortAddress } from "@/lib/utils";
import { useRecalledMemory, buildRecalledChips } from "./memory-chip";

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

/** Single-UI views rendered in the right content panel. */
export type AppView = "chat" | "my-dashboard" | "network-dashboard" | "memory" | "guide" | "protocols";

// Navigation: most items switch the in-place content panel; Bridge is a separate
// route (kept standalone so its dark page matches Mayan's widget colors).
type NavItem = { label: string; icon: typeof MessageSquare } & ({ view: AppView } | { href: string });
const NAV_ITEMS: NavItem[] = [
  { view: "chat", label: "Copilot", icon: MessageSquare },
  { view: "my-dashboard", label: "My Dashboard", icon: LayoutDashboard },
  { view: "network-dashboard", label: "Network", icon: Globe },
  { view: "memory", label: "Memory", icon: Brain },
  { href: "/bridge", label: "Bridge", icon: ArrowLeftRight },
  { view: "guide", label: "Guide", icon: BookOpen },
];

interface AppSidebarProps {
  /** Controls mobile drawer visibility */
  open: boolean;
  /** Called when drawer overlay or close button is clicked */
  onClose: () => void;
  /** Currently active content view. */
  activeView?: AppView;
  /** Switch the content view (single-UI navigation). */
  onSelectView?: (view: AppView) => void;
}

export function AppSidebar({
  open,
  onClose,
  activeView = "chat",
  onSelectView,
}: AppSidebarProps) {
  const account = useCurrentAccount();
  const gas = useSuiGasBalance(account?.address);
  const { name: suinsName } = useSuinsName(account?.address);
  const { mutate: disconnect } = useDisconnectWallet();
  const recalled = useRecalledMemory(account?.address);
  const memoryChips = recalled?.hasReal ? buildRecalledChips(recalled) : [];

  const renderSidebar = () => (
    <aside
      className="flex flex-col gap-1.5 h-full"
      style={{
        width: "248px",
        // Blend with the page canvas (--bg) instead of the grayer --bg-sub; the
        // border provides separation.
        background: "var(--bg)",
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

      {/* Navigation — in-place views + the Bridge route */}
      <nav className="flex flex-col gap-0.5" style={{ marginTop: 6 }} aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const navClass = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left";
          if ("href" in item) {
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={navClass}
                style={{ background: "transparent", color: "var(--fg-muted)", fontWeight: 400, textDecoration: "none" }}
              >
                <Icon size={15} aria-hidden />
                {item.label}
              </Link>
            );
          }
          const active = activeView === item.view;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => { onSelectView?.(item.view); onClose(); }}
              aria-current={active ? "page" : undefined}
              className={navClass}
              style={{
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent-ink)" : "var(--fg-muted)",
                fontWeight: active ? 600 : 400,
                border: "none",
                cursor: "pointer",
              }}
            >
              <Icon size={15} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </nav>


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
        </div>
        {memoryChips.length > 0 ? (
          <p style={{ margin: 0, fontSize: "11.5px", lineHeight: 1.45, color: "var(--fg-muted)" }}>
            {memoryChips.join(" · ")}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "11.5px", lineHeight: 1.45, color: "var(--fg-faint)" }}>
            {account
              ? "No saved preferences yet — I'll remember your cap, risk profile, and contacts as you use Dewlock."
              : "Connect a wallet to recall your saved cap, risk profile, and contacts."}
          </p>
        )}
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
              <span
                className="mono flex-1 truncate"
                style={{ fontSize: "10.5px", color: "var(--fg)" }}
                title={account.address}
              >
                {suinsName ?? shortAddress(account.address)}
              </span>
              <CopyAddressButton address={account.address} size={12} />
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
      <div className="hidden md:flex h-full">{renderSidebar()}</div>

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
            {renderSidebar()}
          </div>
        </div>
      )}
    </>
  );
}
