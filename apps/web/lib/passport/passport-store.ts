/**
 * Passport persistence (server-only): public Walrus blob (immutable proof) + memwal
 * pointer + optional on-chain HEAD anchor. The LIVE passport is built per request from
 * the action log; the blob/HEAD is the shareable proof artifact, persisted in the
 * BACKGROUND and only when identity (level/badges) changes (red-team C1/C1b — never in
 * the awaited receipt pipeline, never a write per action).
 *
 * Pointer format: "passport: <blobId> <blobObjectId> <anchorObjectId|-> @ <ts>".
 * The anchor reuses the receipt HEAD module (action="passport"); it degrades to
 * blob-only (not_configured) until the Move package is deployed.
 */

import { memNamespace, rememberBulk, recall, isMemoryEnabled, publishJsonBlob, readJsonBlob } from "@dewlock/walrus";
import { anchorReceiptHead } from "@dewlock/sui";
import {
  buildPassport,
  monotonicMergePassport,
  passportIdentityChanged,
  type DewlockPassport,
} from "@dewlock/agent/memory/passport";

const POINTER_PREFIX = "passport:";
const POINTER_RE = /^passport:\s+(\S+)\s+(\S+)\s+(\S+)\s+@\s+(\d+)/;

export interface PassportResult {
  passport: DewlockPassport;
  /** Walrus blob id of the latest persisted passport (null until first persist lands). */
  blobId: string | null;
  /** On-chain Walrus Blob object id. */
  blobObjectId: string | null;
  /** Sui object to surface: HEAD anchor if deployed, else the Walrus Blob object. */
  suiObjectId: string | null;
}

interface Persisted {
  passport: DewlockPassport | null;
  blobId: string | null;
  blobObjectId: string | null;
  anchorObjectId: string | null;
}

function dash(v: string): string | null {
  return v === "-" ? null : v;
}

/** Read the latest persisted passport + its proof ids from the memwal pointer. */
async function readPersisted(wallet: string): Promise<Persisted> {
  const empty: Persisted = { passport: null, blobId: null, blobObjectId: null, anchorObjectId: null };
  if (!isMemoryEnabled()) return empty;
  try {
    const lines = await recall(memNamespace(wallet), POINTER_PREFIX, 8);
    let best: { blobId: string; blobObjectId: string | null; anchorObjectId: string | null; at: number } | null = null;
    for (const line of lines) {
      const m = POINTER_RE.exec(line.trim());
      if (!m) continue;
      const at = Number(m[4]);
      if (!best || at > best.at) best = { blobId: m[1], blobObjectId: dash(m[2]), anchorObjectId: dash(m[3]), at };
    }
    if (!best) return empty;
    const passport = await readJsonBlob<DewlockPassport>(best.blobId).catch(() => null);
    return { passport, blobId: best.blobId, blobObjectId: best.blobObjectId, anchorObjectId: best.anchorObjectId };
  } catch {
    return empty;
  }
}

/** Publish the passport blob, anchor a HEAD (best-effort), and write the pointer. */
async function persistPassport(wallet: string, passport: DewlockPassport): Promise<void> {
  if (!isMemoryEnabled()) return;
  try {
    const ptr = await publishJsonBlob("dewlock-passport", passport);
    if (!ptr.blobId) return;
    const blobObjectId = ptr.objectId ?? "-";
    let anchorObjectId = "-";
    try {
      const anchor = await anchorReceiptHead({
        walletAddress: wallet,
        action: "passport",
        blobId: ptr.blobId,
        contentHash: ptr.hash ?? "",
      });
      if (anchor.anchorObjectId) anchorObjectId = anchor.anchorObjectId;
    } catch {
      /* anchor not configured / failed → blob-only (degrade) */
    }
    await rememberBulk(memNamespace(wallet), [
      `${POINTER_PREFIX} ${ptr.blobId} ${blobObjectId} ${anchorObjectId} @ ${Date.now()}`,
    ]);
  } catch {
    /* fail-soft — the live passport still renders; proof catches up next change */
  }
}

/**
 * Build the live passport from receipt lines; return it + the latest persisted proof
 * ids. When identity changed, persist in the BACKGROUND (never blocks the response).
 */
export async function buildAndMaybePersistPassport(
  wallet: string,
  receiptLines: string[],
  nowMs: number,
): Promise<PassportResult> {
  const derived = buildPassport(wallet, receiptLines, nowMs);
  const persisted = await readPersisted(wallet);
  const merged = monotonicMergePassport(persisted.passport, derived);
  if (isMemoryEnabled() && passportIdentityChanged(persisted.passport, merged)) {
    void persistPassport(wallet, merged).catch(() => undefined);
  }
  return {
    passport: merged,
    blobId: persisted.blobId,
    blobObjectId: persisted.blobObjectId,
    suiObjectId: persisted.anchorObjectId ?? persisted.blobObjectId,
  };
}
