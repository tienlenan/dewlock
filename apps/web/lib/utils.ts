import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution. Used by all UI components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a MIST amount (1e-9 SUI) into a human-readable SUI string. */
export function formatMistAsSui(mist: string | null | undefined): string {
  if (!mist) return "— SUI";
  const sui = Number(BigInt(mist)) / 1e9;
  return `${sui.toFixed(4)} SUI`;
}

/** Truncate a 0x address to short form: 0x1234…abcd */
export function shortAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
