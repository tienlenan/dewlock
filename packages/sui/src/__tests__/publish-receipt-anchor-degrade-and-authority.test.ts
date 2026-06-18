/**
 * Tests: anchorReceiptHead degrade path + write-authority invariant.
 *
 * Approach: we do NOT mock @mysten/sui (the vitest @mysten resolver bypasses
 * vi.mock of @mysten/sui subpaths). Instead anchorReceiptHead takes injectable
 * deps {getClient, makeSigner} — tests pass a mock client that captures the
 * real Transaction, and we assert the move-call target via the pure
 * anchorMoveTarget() + by inspecting the built tx's commands.
 *
 * Security note: the ReceiptHead is an OWNED object; only the operational-key
 * signer can pass it as a &mut arg to set_head (Sui owned-object authority +
 * a Move `assert!(writer == sender)` guard). This TS module additionally only
 * ever constructs `::receipt::create_head` / `::receipt::set_head` targets.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  anchorReceiptHead,
  getKnownHeadObjectId,
  anchorMoveTarget,
  type AnchorDeps,
} from "../publish-receipt-anchor.js";

// Valid 64-hex package id so the real Transaction accepts the moveCall target.
const PACKAGE_ID =
  "0x000000000000000000000000000000000000000000000000000000000000beef";
// Shared Config object id (first arg of create_head/set_head after the version guard).
const CONFIG_ID =
  "0x000000000000000000000000000000000000000000000000000000000000c0f1";
const SECRET_KEY = "suiprivkey_test_operational_key";

// Valid 64-hex wallet addresses (tx.pure.address validates hex).
const WALLET_REJECT = "0x" + "2".repeat(64);
const WALLET_NEW = "0x" + "1".repeat(64);
const WALLET_PERSIST = "0x" + "3".repeat(64);
const HEAD_PERSIST_ID = "0x" + "e".repeat(64);

interface ExecResult {
  digest?: string;
  objectChanges?: Array<{ type?: string; objectId?: string }>;
}

/** Mock client (DI) that captures each built tx and returns a scripted result. */
function makeDeps(exec: (tx: unknown) => Promise<ExecResult> | ExecResult) {
  const txs: Array<{ getData: () => { commands: Array<Record<string, unknown>> } }> = [];
  const signAndExecuteTransaction = vi.fn(
    async (args: { transaction: { getData: () => { commands: Array<Record<string, unknown>> } } }) => {
      txs.push(args.transaction);
      return exec(args.transaction);
    },
  );
  const deps: AnchorDeps = {
    getClient: () => ({ signAndExecuteTransaction }) as never,
    makeSigner: () => ({}),
  };
  return { deps, signAndExecuteTransaction, txs };
}

/** Pull the first command's MoveCall {package, module, function} from a real tx. */
function moveCallOf(tx: { getData: () => { commands: Array<Record<string, unknown>> } }) {
  const cmd = tx.getData().commands[0] as { MoveCall?: { package?: string; module?: string; function?: string } };
  return cmd?.MoveCall ?? null;
}

describe("anchorMoveTarget — only receipt::create_head / set_head", () => {
  it("returns create_head when there is no existing HEAD", () => {
    expect(anchorMoveTarget(PACKAGE_ID, false)).toBe(`${PACKAGE_ID}::receipt::create_head`);
  });
  it("returns set_head when a HEAD already exists", () => {
    expect(anchorMoveTarget(PACKAGE_ID, true)).toBe(`${PACKAGE_ID}::receipt::set_head`);
  });
  it("always targets the configured package + the receipt module only", () => {
    for (const has of [false, true]) {
      const [pkg, mod] = anchorMoveTarget(PACKAGE_ID, has).split("::");
      expect(pkg).toBe(PACKAGE_ID);
      expect(mod).toBe("receipt");
    }
  });
});

describe("anchorReceiptHead — degrade path", () => {
  beforeEach(() => {
    delete process.env.DEWLOCK_RECEIPT_PACKAGE_ID;
    delete process.env.WALRUS_SDK_WALLET_KEY;
  });
  afterEach(() => {
    delete process.env.DEWLOCK_RECEIPT_PACKAGE_ID;
    delete process.env.WALRUS_SDK_WALLET_KEY;
  });

  it("returns not_configured when DEWLOCK_RECEIPT_PACKAGE_ID is missing", async () => {
    process.env.WALRUS_SDK_WALLET_KEY = SECRET_KEY;
    const { deps, signAndExecuteTransaction } = makeDeps(() => ({}));
    const result = await anchorReceiptHead(
      { walletAddress: "0xabc", action: "transfer", blobId: "b1", contentHash: "h1" },
      deps,
    );
    expect(result.status).toBe("not_configured");
    expect(result.anchorObjectId).toBeNull();
    expect(signAndExecuteTransaction).not.toHaveBeenCalled();
  });

  it("returns not_configured when WALRUS_SDK_WALLET_KEY is missing", async () => {
    process.env.DEWLOCK_RECEIPT_PACKAGE_ID = PACKAGE_ID;
    const { deps, signAndExecuteTransaction } = makeDeps(() => ({}));
    const result = await anchorReceiptHead(
      { walletAddress: "0xabc", action: "transfer", blobId: "b1", contentHash: "h1" },
      deps,
    );
    expect(result.status).toBe("not_configured");
    expect(signAndExecuteTransaction).not.toHaveBeenCalled();
  });

  it("returns failed (non-throwing) when the client rejects", async () => {
    process.env.DEWLOCK_RECEIPT_PACKAGE_ID = PACKAGE_ID;
    process.env.DEWLOCK_RECEIPT_CONFIG_ID = CONFIG_ID;
    process.env.WALRUS_SDK_WALLET_KEY = SECRET_KEY;
    const { deps } = makeDeps(() => Promise.reject(new Error("RPC timeout")));
    const result = await anchorReceiptHead(
      { walletAddress: WALLET_REJECT, action: "transfer", blobId: "b2", contentHash: "h2" },
      deps,
    );
    expect(result.status).toBe("failed");
    expect(result.anchorObjectId).toBeNull();
    expect(result.txDigest).toBeNull();
    expect(result.error).toContain("RPC timeout");
  });
});

describe("anchorReceiptHead — write authority + HEAD registry", () => {
  beforeEach(() => {
    process.env.DEWLOCK_RECEIPT_PACKAGE_ID = PACKAGE_ID;
    process.env.DEWLOCK_RECEIPT_CONFIG_ID = CONFIG_ID;
    process.env.WALRUS_SDK_WALLET_KEY = SECRET_KEY;
  });
  afterEach(() => {
    delete process.env.DEWLOCK_RECEIPT_PACKAGE_ID;
    delete process.env.DEWLOCK_RECEIPT_CONFIG_ID;
    delete process.env.WALRUS_SDK_WALLET_KEY;
  });

  it("builds a create_head call + records the HEAD id (first write)", async () => {
    const { deps, txs } = makeDeps(() => ({
      digest: "tx-create",
      objectChanges: [{ type: "created", objectId: "0xhead001" }],
    }));
    const result = await anchorReceiptHead(
      { walletAddress: WALLET_NEW, action: "action-new", blobId: "blob-1", contentHash: "h-1" },
      deps,
    );
    expect(result.status).toBe("anchored");
    expect(result.anchorObjectId).toBe("0xhead001");
    expect(getKnownHeadObjectId(WALLET_NEW, "action-new")).toBe("0xhead001");

    const mc = moveCallOf(txs[0]!);
    expect(mc?.module).toBe("receipt");
    expect(mc?.function).toBe("create_head");
  });

  it("builds a set_head call once a HEAD id is known (second write)", async () => {
    const first = makeDeps(() => ({
      digest: "tx-create-2",
      objectChanges: [{ type: "created", objectId: HEAD_PERSIST_ID }],
    }));
    await anchorReceiptHead(
      { walletAddress: WALLET_PERSIST, action: "action-persist", blobId: "blob-a", contentHash: "h-a" },
      first.deps,
    );

    const second = makeDeps(() => ({ digest: "tx-update", objectChanges: [] }));
    const result = await anchorReceiptHead(
      { walletAddress: WALLET_PERSIST, action: "action-persist", blobId: "blob-b", contentHash: "h-b" },
      second.deps,
    );
    expect(result.status).toBe("anchored");
    expect(result.anchorObjectId).toBe(HEAD_PERSIST_ID);

    const mc = moveCallOf(second.txs[0]!);
    expect(mc?.function).toBe("set_head");
  });

  it("getKnownHeadObjectId returns undefined for an unseen (wallet, action)", () => {
    expect(getKnownHeadObjectId("0xunseen", "action-unseen")).toBeUndefined();
  });
});
