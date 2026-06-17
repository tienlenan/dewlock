"use client";

/**
 * CopyAddressButton — copies a wallet address to the clipboard and briefly
 * swaps the icon to a check for feedback. Icon-only and theme-aware so it fits
 * next to the wallet identity in the connect bar, sidebar, and app header.
 */

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyAddressButtonProps {
  address: string;
  className?: string;
  /** Icon size in px. Default 13. */
  size?: number;
}

export function CopyAddressButton({
  address,
  className,
  size = 13,
}: CopyAddressButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard unavailable (insecure context / permission denied) — no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={copied ? "Address copied" : "Copy wallet address"}
      title={copied ? "Copied" : "Copy address"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-fg-subtle outline-none transition-colors",
        "hover:text-accent focus-visible:text-accent",
        className,
      )}
    >
      {copied ? (
        <Check size={size} className="text-success" aria-hidden />
      ) : (
        <Copy size={size} aria-hidden />
      )}
    </button>
  );
}
