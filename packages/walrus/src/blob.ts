/**
 * Dewlock Walrus Blob client — server-side JSON blob writes and reads.
 * Used to store immutable action receipts: { txDigest, action, args, dryRunEffects, agentReasoning, ts }.
 *
 * Write path (cascade): HTTP publisher → Walrus SDK (upload relay) → Walrus CLI.
 * Blobs are written AFTER user signs (async, non-blocking UX).
 * The signer key here is WALRUS_SDK_WALLET_KEY — an operational key for blob receipts ONLY,
 * never a user-fund signer. Security invariant: no user-fund keys server-side.
 */

import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { walrus } from "@mysten/walrus";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
// SuiJsonRpcClient is the v2.x successor to the removed SuiClient class.
type SuiClient = SuiJsonRpcClient;

export interface WalrusBlobPointer {
  status: "not_configured" | "published" | "already_certified" | "failed";
  blobId: string | null;
  objectId: string | null;
  hash: string;
  error?: string;
}

interface WalrusStoreResponse {
  blobStoreResult?: WalrusStoreResponse;
  newlyCreated?: { blobObject?: { id?: string; blobId?: string } };
  alreadyCertified?: { blobId?: string };
}

// Canonical deterministic JSON — sort keys at every level for stable content hashes.
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, normalize(v)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function unwrapStoreResponse(
  v: WalrusStoreResponse | WalrusStoreResponse[],
): WalrusStoreResponse {
  const first = Array.isArray(v) ? v[0] : v;
  return first?.blobStoreResult ?? first ?? {};
}

export function contentHash(value: unknown): string {
  const body = typeof value === "string" ? value : stableJson(value);
  return createHash("sha256").update(body).digest("hex");
}

// --- HTTP publisher path (fastest — delegates encoding + coordination to hosted publisher) ---
async function publishWithHttpPublisher(
  kind: string,
  value: unknown,
  hash: string,
): Promise<WalrusBlobPointer> {
  const publisher = process.env.WALRUS_PUBLISHER_URL?.replace(/\/$/, "");
  if (!publisher)
    return { status: "not_configured", blobId: null, objectId: null, hash };
  const epochs = Number(process.env.WALRUS_BLOB_EPOCHS ?? 12);
  const url = `${publisher}/v1/blobs?epochs=${Number.isFinite(epochs) ? epochs : 12}&deletable=true`;
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "x-dewlock-kind": kind,
  };
  if (process.env.WALRUS_PUBLISHER_TOKEN) {
    headers.authorization = `Bearer ${process.env.WALRUS_PUBLISHER_TOKEN}`;
  }
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(value),
      // Bound the publisher call so an unreachable/slow publisher can't hang the
      // receipt request (the workflow has its own outer budget too).
      signal: AbortSignal.timeout(Number(process.env.WALRUS_PUBLISH_TIMEOUT_MS ?? 10_000)),
    });
    const data = unwrapStoreResponse(
      ((await res.json().catch(() => ({}))) as
        | WalrusStoreResponse
        | WalrusStoreResponse[]),
    );
    if (!res.ok) throw new Error(`publisher ${res.status}`);
    const created = data.newlyCreated?.blobObject;
    if (created?.blobId)
      return {
        status: "published",
        blobId: created.blobId,
        objectId: created.id ?? null,
        hash,
      };
    if (data.alreadyCertified?.blobId)
      return {
        status: "already_certified",
        blobId: data.alreadyCertified.blobId,
        objectId: null,
        hash,
      };
    return {
      status: "failed",
      blobId: null,
      objectId: null,
      hash,
      error: "publisher response missing blobId",
    };
  } catch (err) {
    return {
      status: "failed",
      blobId: null,
      objectId: null,
      hash,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// --- Upload relay options (keeps blob writes inside Vercel serverless timeout) ---
function uploadRelayOptions():
  | { host: string; sendTip: { max: number } }
  | undefined {
  if (process.env.WALRUS_UPLOAD_RELAY_DISABLED === "true") return undefined;
  const network =
    process.env.WALRUS_CONTEXT ?? process.env.SUI_NETWORK ?? "mainnet";
  const host =
    process.env.WALRUS_UPLOAD_RELAY_HOST ??
    (network === "mainnet"
      ? "https://upload-relay.mainnet.walrus.space"
      : "https://upload-relay.testnet.walrus.space");
  const maxTip = Number(process.env.WALRUS_UPLOAD_RELAY_TIP_MAX ?? 10_000_000);
  return {
    host,
    sendTip: { max: Number.isFinite(maxTip) ? maxTip : 10_000_000 },
  };
}

// --- Walrus TypeScript SDK path (upload relay enabled; operational key only) ---
async function publishWithWalrusSdk(
  value: unknown,
  hash: string,
): Promise<WalrusBlobPointer> {
  const secret = process.env.WALRUS_SDK_WALLET_KEY;
  if (!secret || process.env.WALRUS_SDK_DISABLED === "true")
    return { status: "not_configured", blobId: null, objectId: null, hash };
  try {
    const signer = Ed25519Keypair.fromSecretKey(secret);
    const relay = uploadRelayOptions();
    const rpcUrl =
      process.env.SUI_RPC_URL ?? "https://fullnode.mainnet.sui.io:443";
    const suiClient = new SuiJsonRpcClient({ network: "mainnet", url: rpcUrl });
    const client = suiClient.$extend(
      relay ? walrus({ uploadRelay: relay }) : walrus(),
    );
    const result = (await client.walrus.writeBlob({
      blob: new TextEncoder().encode(stableJson(value)),
      deletable: true,
      epochs: Number(process.env.WALRUS_BLOB_EPOCHS ?? 12),
      signer,
    })) as { blobId?: string; id?: string; blobObject?: { id?: string } };
    if (!result.blobId)
      return {
        status: "failed",
        blobId: null,
        objectId: null,
        hash,
        error: "Walrus SDK response missing blobId",
      };
    return {
      status: "published",
      blobId: result.blobId,
      objectId: result.id ?? result.blobObject?.id ?? null,
      hash,
    };
  } catch (err) {
    return {
      status: "failed",
      blobId: null,
      objectId: null,
      hash,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// --- Walrus CLI fallback ---
async function runWalrusCliStore(file: string): Promise<WalrusStoreResponse> {
  const binary =
    process.env.WALRUS_BINARY ??
    "/usr/local/bin/walrus";
  const context =
    process.env.WALRUS_CONTEXT ?? process.env.SUI_NETWORK ?? "mainnet";
  const epochs = process.env.WALRUS_BLOB_EPOCHS ?? "12";
  const args = [
    "--context",
    context,
    "--json",
    "store",
    "--epochs",
    epochs,
    "--force",
    "--ignore-resources",
    file,
  ];
  if (process.env.WALRUS_CONFIG) args.unshift("--config", process.env.WALRUS_CONFIG);
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `walrus exited ${code}`));
      try {
        resolve(
          unwrapStoreResponse(
            JSON.parse(stdout) as WalrusStoreResponse | WalrusStoreResponse[],
          ),
        );
      } catch {
        reject(new Error(`cannot parse walrus JSON: ${stdout.slice(0, 500)}`));
      }
    });
  });
}

async function publishWithWalrusCli(
  kind: string,
  value: unknown,
  hash: string,
): Promise<WalrusBlobPointer> {
  if (process.env.WALRUS_CLI_DISABLED === "true")
    return { status: "not_configured", blobId: null, objectId: null, hash };
  const tmp = await mkdtemp(path.join(tmpdir(), "dewlock-blob-"));
  try {
    const filename = `${kind.replace(/[^a-z0-9._-]/gi, "-")}-${hash.slice(0, 12)}.json`;
    const file = path.join(tmp, filename);
    await writeFile(file, stableJson(value));
    const data = await runWalrusCliStore(file);
    const created = data.newlyCreated?.blobObject;
    if (created?.blobId)
      return {
        status: "published",
        blobId: created.blobId,
        objectId: created.id ?? null,
        hash,
      };
    if (data.alreadyCertified?.blobId)
      return {
        status: "already_certified",
        blobId: data.alreadyCertified.blobId,
        objectId: null,
        hash,
      };
    return {
      status: "failed",
      blobId: null,
      objectId: null,
      hash,
      error: "walrus CLI response missing blobId",
    };
  } catch (err) {
    return {
      status: "failed",
      blobId: null,
      objectId: null,
      hash,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/**
 * Read a blob from the Walrus aggregator by blobId.
 * Returns null if the blob is not found or the aggregator is not configured.
 */
export async function readJsonBlob<T = unknown>(
  blobId: string,
): Promise<T | null> {
  const aggregator =
    process.env.WALRUS_AGGREGATOR_URL ??
    "https://aggregator.walrus-mainnet.walrus.space";
  try {
    const res = await fetch(`${aggregator}/v1/blobs/${blobId}`, {
      signal: AbortSignal.timeout(Number(process.env.WALRUS_READ_TIMEOUT_MS ?? 8_000)),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Write a JSON payload to Walrus and return a blob pointer.
 * Cascade: HTTP publisher → SDK (upload relay) → CLI.
 * Call this AFTER the user has signed — never block UX on blob writes.
 */
export async function publishJsonBlob(
  kind: string,
  value: unknown,
): Promise<WalrusBlobPointer> {
  const hash = contentHash(value);
  const httpPointer = await publishWithHttpPublisher(kind, value, hash);
  if (
    httpPointer.status === "published" ||
    httpPointer.status === "already_certified"
  )
    return httpPointer;
  const sdkPointer = await publishWithWalrusSdk(value, hash);
  if (
    sdkPointer.status !== "not_configured" &&
    sdkPointer.status !== "failed"
  )
    return sdkPointer;
  if (sdkPointer.status === "failed" && process.env.WALRUS_CLI_DISABLED === "true")
    return sdkPointer;
  return publishWithWalrusCli(kind, value, hash);
}
