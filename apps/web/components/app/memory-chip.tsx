"use client";

/**
 * MemoryChip — inline recall note rendered in the chat thread.
 *
 * Represents copilot memory context: daily cap, risk profile, saved contacts.
 * Renders recalled data from the /api/memory-recall endpoint when available;
 * falls back to the sample chips only when memory is empty or not configured.
 *
 * Visual: star icon + mono label + text, matches the mockup sidebar memory pill.
 */

import { useEffect, useState } from "react";

interface MemoryChipProps {
  text: string;
}

// Star icon matching mockup memory section
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

export function MemoryChip({ text }: MemoryChipProps) {
  return (
    <div
      className="inline-flex items-start gap-1.5 rounded-lg px-2.5 py-1.5"
      style={{
        background: "var(--accent-soft)",
        border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
        maxWidth: "100%",
      }}
    >
      <span className="mt-px shrink-0">
        <StarIcon />
      </span>
      <span
        className="text-left leading-snug"
        style={{ fontSize: "11.5px", color: "var(--accent-ink)" }}
      >
        {text}
      </span>
    </div>
  );
}

/** Static sample chips — shown only when memwal is not configured or memory is empty. */
export const SAMPLE_MEMORY_CHIPS: string[] = [
  "I remember your $5,000 daily cap",
  "Cetus LP in range",
  "888.sui is a saved contact",
];

// ---------------------------------------------------------------------------
// Recalled memory state — fetched from /api/memory-recall per wallet
// ---------------------------------------------------------------------------

export interface RecalledMemory {
  /** e.g. "risk cap: $5/tx, $20/day; risk profile: conservative" */
  capEntry?: string;
  /** e.g. ["contact: alice = 0xabc..."] */
  contactEntries?: string[];
  /** true when memwal is configured and returned at least one result */
  hasReal: boolean;
}

/**
 * Hook: fetch recalled memory for the connected wallet.
 * Returns null while loading, empty object with hasReal=false when memwal not configured.
 * [needs live-env] real recall requires reachable memwal relayer + provisioned account.
 */
export function useRecalledMemory(walletAddress: string | undefined): RecalledMemory | null {
  const [mem, setMem] = useState<RecalledMemory | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setMem({ hasReal: false });
      return;
    }

    let cancelled = false;
    fetch(`/api/memory-recall?wallet=${encodeURIComponent(walletAddress)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { capEntry?: string; contactEntries?: string[] } | null) => {
        if (cancelled) return;
        if (!data) {
          setMem({ hasReal: false });
          return;
        }
        setMem({
          capEntry: data.capEntry,
          contactEntries: data.contactEntries,
          hasReal: Boolean(data.capEntry || data.contactEntries?.length),
        });
      })
      .catch(() => {
        if (!cancelled) setMem({ hasReal: false });
      });

    return () => { cancelled = true; };
  }, [walletAddress]);

  return mem;
}

/**
 * Build human-readable chip texts from recalled memory entries.
 * Returns an empty array when memory is empty — caller falls back to SAMPLE_MEMORY_CHIPS.
 */
export function buildRecalledChips(mem: RecalledMemory): string[] {
  const chips: string[] = [];

  if (mem.capEntry) {
    // "risk cap: $5/tx, $20/day; risk profile: conservative" → readable chip text
    const txMatch = /\$(\d+(?:\.\d+)?)\/tx/i.exec(mem.capEntry);
    const profileMatch = /risk profile:\s*([a-z]+)/i.exec(mem.capEntry);
    if (txMatch) {
      const profile = profileMatch ? ` · ${profileMatch[1]}` : "";
      chips.push(`Cap: $${txMatch[1]}/tx${profile}`);
    }
  }

  if (mem.contactEntries?.length) {
    const count = mem.contactEntries.length;
    chips.push(`${count} saved contact${count > 1 ? "s" : ""}`);
  }

  return chips;
}
