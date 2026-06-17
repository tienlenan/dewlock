/**
 * Per-wallet activity stats derived from the immutable receipt log.
 *
 * Pure: parses the memwal "action log: …" lines (formatDecisionLogEntry shape)
 * into structured stats. Receipts are the source of truth for what the user did
 * THROUGH Dewlock; badges (badges.ts) are computed from these stats.
 */

export interface UserStats {
  /** Total Dewlock actions executed. */
  txCount: number;
  /** Sum of estimated USD value across actions. */
  volumeUsd: number;
  /** Counts per action class (parsed from the action label). */
  actions: { transfer: number; swap: number; lend: number; bridge: number; limit: number };
  /** Distinct action classes used (variety). */
  distinctActions: number;
  /** Earliest action ISO timestamp, if any. */
  firstTs: string | null;
}

export interface ParsedReceipt {
  timestamp: string;
  actionLabel: string;
  txDigest: string;
  usdValue: number;
}

const LINE_RE =
  /^action log:\s*(?<ts>[^|]+?)\s*\|\s*(?<label>.+?)\s*\|\s*tx:(?<tx>[^|]+?)\s*\|\s*usd:\$(?<usd>[\d.]+)/;

/** Parse one receipt log line; returns null if it doesn't match the format. */
export function parseReceiptLine(line: string): ParsedReceipt | null {
  const m = LINE_RE.exec(line.trim());
  if (!m?.groups) return null;
  const usd = parseFloat(m.groups.usd);
  return {
    timestamp: m.groups.ts.trim(),
    actionLabel: m.groups.label.trim(),
    txDigest: m.groups.tx.trim(),
    usdValue: Number.isFinite(usd) ? usd : 0,
  };
}

/** Classify an action label into an action class by keyword (case-insensitive). */
export function classifyAction(label: string): keyof UserStats["actions"] | null {
  const l = label.toLowerCase();
  if (/\bbridge|redeem|wormhole\b/.test(l)) return "bridge";
  if (/\blimit\b/.test(l)) return "limit";
  if (/\b(lend|deposit|repay|supply|borrow|withdraw)\b/.test(l)) return "lend";
  if (/\bswap\b/.test(l)) return "swap";
  if (/\b(transfer|send|pay)\b/.test(l)) return "transfer";
  return null;
}

/** Parse + keep only valid receipt lines, newest first (by ISO timestamp). */
export function parseReceipts(lines: string[]): ParsedReceipt[] {
  return lines
    .map(parseReceiptLine)
    .filter((r): r is ParsedReceipt => r !== null)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
}

/** Sum USD volume of receipts whose ISO timestamp starts with `datePrefix` (YYYY-MM-DD). */
export function sumVolumeForDate(receipts: ParsedReceipt[], datePrefix: string): number {
  return receipts
    .filter((r) => r.timestamp.startsWith(datePrefix))
    .reduce((sum, r) => sum + r.usdValue, 0);
}

/** Derive stats from receipt log lines (the memwal "action log:" entries). */
export function deriveStats(lines: string[]): UserStats {
  const actions = { transfer: 0, swap: 0, lend: 0, bridge: 0, limit: 0 };
  let txCount = 0;
  let volumeUsd = 0;
  let firstTs: string | null = null;

  for (const line of lines) {
    const r = parseReceiptLine(line);
    if (!r) continue;
    txCount += 1;
    volumeUsd += r.usdValue;
    if (!firstTs || r.timestamp < firstTs) firstTs = r.timestamp;
    const cls = classifyAction(r.actionLabel);
    if (cls) actions[cls] += 1;
  }

  const distinctActions = Object.values(actions).filter((n) => n > 0).length;
  return { txCount, volumeUsd, actions, distinctActions, firstTs };
}
