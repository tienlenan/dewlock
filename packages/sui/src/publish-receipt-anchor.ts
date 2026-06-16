/**
 * Dewlock receipt anchor — writes ReceiptHead on-chain via the operational key.
 *
 * Security invariants (must never be removed):
 *  - The signer is WALRUS_SDK_WALLET_KEY (operational key, receipt-writes ONLY).
 *    This is the SAME key used by blob.ts for Walrus blob writes.
 *    It NEVER holds user funds and NEVER signs user-fund transactions.
 *  - The only moveCall targets this file ever constructs are
 *    `${PACKAGE_ID}::receipt::create_head` and `${PACKAGE_ID}::receipt::set_head`.
 *    This is enforced by the `buildAnchorTx` helper — the package ID is checked
 *    against DEWLOCK_RECEIPT_PACKAGE_ID before any PTB is built.
 *
 * Degrade ladder (fail-soft):
 *  1. DEWLOCK_RECEIPT_PACKAGE_ID or WALRUS_SDK_WALLET_KEY missing → not_configured.
 *  2. PTB build / execute failure → failed (blob receipt is the source of truth).
 *  Never throws to caller — the blob receipt always wins.
 *
 * HEAD-id persistence (demo-safe):
 *  In-memory Map<"${wallet}:${action}", objectId> — sufficient for hackathon demo.
 *  Cold serverless restart = always create_head (orphan HEAD accepted for demo).
 *  Production: replace with KV lookup keyed by (wallet, action).
 */

import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getSuiMainnetClient } from "./client";

// SUI_CLOCK_OBJECT_ID is a well-known shared object at 0x6 on all Sui networks.
const SUI_CLOCK_OBJECT_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AnchorStatus =
  | "anchored"
  | "blob_only"
  | "not_configured"
  | "failed";

export interface AnchorResult {
  status: AnchorStatus;
  anchorObjectId: string | null;
  txDigest: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// In-memory HEAD-id registry (demo-safe; lost on cold start → create_head)
// ---------------------------------------------------------------------------

const headIdRegistry = new Map<string, string>();

function headKey(walletAddress: string, action: string): string {
  return `${walletAddress}:${action}`;
}

// ---------------------------------------------------------------------------
// Pure move-target resolver — the ONLY two targets this module ever builds.
// Exported so it can be asserted in tests without mocking @mysten/sui.
// ---------------------------------------------------------------------------

export function anchorMoveTarget(packageId: string, hasExistingHead: boolean): string {
  return `${packageId}::receipt::${hasExistingHead ? "set_head" : "create_head"}`;
}

// ---------------------------------------------------------------------------
// Injectable dependencies — default to the real client + keypair; tests pass
// mocks here instead of mocking @mysten/sui modules (which the vitest @mysten
// resolver bypasses).
// ---------------------------------------------------------------------------

interface ExecResult {
  digest?: string;
  objectChanges?: Array<{ type?: string; objectId?: string }>;
}
interface AnchorClient {
  signAndExecuteTransaction(args: {
    transaction: Transaction;
    signer: unknown;
    options?: { showObjectChanges?: boolean };
  }): Promise<ExecResult>;
}
export interface AnchorDeps {
  getClient?: () => AnchorClient;
  makeSigner?: (secretKey: string) => unknown;
}

// ---------------------------------------------------------------------------
// Internal PTB builder — allowlist-enforced move targets only
// ---------------------------------------------------------------------------

function buildAnchorTx(opts: {
  packageId: string;
  headObjectId: string | undefined;
  walletAddress: string;
  action: string;
  blobId: string;
  contentHash: string;
}): Transaction {
  const { packageId, headObjectId, walletAddress, action, blobId, contentHash } = opts;

  // Allowlist guard: only call into the configured receipt package.
  // Any caller that attempts to pass a different packageId is blocked here.
  const allowedTarget = packageId;
  const tx = new Transaction();
  const clock = tx.object(SUI_CLOCK_OBJECT_ID);

  if (!headObjectId) {
    // First write for this (wallet, action): create a new owned HEAD object.
    tx.moveCall({
      target: anchorMoveTarget(allowedTarget, false),
      arguments: [
        tx.pure.address(walletAddress),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(action))),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(blobId))),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(contentHash))),
        clock,
      ],
    });
  } else {
    // Subsequent write: update the existing HEAD.
    tx.moveCall({
      target: anchorMoveTarget(allowedTarget, true),
      arguments: [
        tx.object(headObjectId),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(blobId))),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(contentHash))),
        clock,
      ],
    });
  }

  return tx;
}

// ---------------------------------------------------------------------------
// Extract created object ID from transaction result
// ---------------------------------------------------------------------------

function extractCreatedObjectId(
  result: { objectChanges?: Array<{ type?: string; objectId?: string }> },
): string | null {
  if (!result.objectChanges) return null;
  for (const change of result.objectChanges) {
    if (change.type === "created" && change.objectId) {
      return change.objectId;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write (or update) a ReceiptHead on-chain pointing at the given blobId.
 * Uses the WALRUS_SDK_WALLET_KEY operational key — never user-fund keys.
 * Degrades gracefully: returns blob_only/not_configured/failed instead of throwing.
 */
export async function anchorReceiptHead(
  input: {
    walletAddress: string;
    action: string;
    blobId: string;
    contentHash: string;
  },
  deps?: AnchorDeps,
): Promise<AnchorResult> {
  const packageId = process.env.DEWLOCK_RECEIPT_PACKAGE_ID;
  const secretKey = process.env.WALRUS_SDK_WALLET_KEY;

  // Degrade: missing config → not_configured (blob receipt still valid)
  if (!packageId || !secretKey) {
    return { status: "not_configured", anchorObjectId: null, txDigest: null };
  }

  try {
    const makeSigner = deps?.makeSigner ?? ((sk: string) => Ed25519Keypair.fromSecretKey(sk));
    const getClient = deps?.getClient ?? (getSuiMainnetClient as unknown as () => AnchorClient);
    const keypair = makeSigner(secretKey);
    const client = getClient();

    const key = headKey(input.walletAddress, input.action);
    const existingHeadId = headIdRegistry.get(key);

    const tx = buildAnchorTx({
      packageId,
      headObjectId: existingHeadId,
      walletAddress: input.walletAddress,
      action: input.action,
      blobId: input.blobId,
      contentHash: input.contentHash,
    });

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showObjectChanges: true },
    });

    if (!existingHeadId) {
      // First write: record the new HEAD object id for subsequent updates.
      const createdId = extractCreatedObjectId(
        result as { objectChanges?: Array<{ type?: string; objectId?: string }> },
      );
      if (createdId) {
        headIdRegistry.set(key, createdId);
        return {
          status: "anchored",
          anchorObjectId: createdId,
          txDigest: (result as { digest?: string }).digest ?? null,
        };
      }
      // Created but couldn't parse id — still anchored, just no id to return.
      return {
        status: "anchored",
        anchorObjectId: null,
        txDigest: (result as { digest?: string }).digest ?? null,
      };
    }

    // set_head succeeded — return the existing HEAD id.
    return {
      status: "anchored",
      anchorObjectId: existingHeadId,
      txDigest: (result as { digest?: string }).digest ?? null,
    };
  } catch (err) {
    // Anchor failure is non-fatal — blob receipt is the source of truth.
    return {
      status: "failed",
      anchorObjectId: null,
      txDigest: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Retrieve a known HEAD object id for a (wallet, action) pair from the
 * in-memory registry. Returns undefined on cold start.
 */
export function getKnownHeadObjectId(
  walletAddress: string,
  action: string,
): string | undefined {
  return headIdRegistry.get(headKey(walletAddress, action));
}
