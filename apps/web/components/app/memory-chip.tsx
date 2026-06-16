"use client";

/**
 * MemoryChip — a small inline recall note rendered in the chat thread.
 *
 * Represents copilot "memory" context surfaced to the user: daily cap,
 * risk profile, saved contacts. These are PREVIEW/SAMPLE — the memory
 * persistence layer (P5 roadmap) is not yet live. Labeled clearly.
 *
 * Visual: star icon + mono label + text, matches the mockup sidebar memory pill.
 */

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

/** Static sample chips shown at the top of the chat on first load — preview only. */
export const SAMPLE_MEMORY_CHIPS: string[] = [
  "I remember your $5,000 daily cap",
  "Cetus LP in range",
  "888.sui is a saved contact",
];
