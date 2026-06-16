/**
 * Provision a Dewlock MemWal account + delegate key.
 * Run: pnpm provision (from monorepo root) OR tsx scripts/provision-memwal.ts
 *
 * Requires SESSION_WALLET_KEY or WALRUS_SDK_WALLET_KEY with ~0.1 SUI (mainnet gas).
 * Writes MEMWAL_ACCOUNT_ID + MEMWAL_DELEGATE_KEY to apps/web/.env.local.
 *
 * Adapted from walrus-memory-world-cup packages/walrus/scripts/provision-memwal.ts.
 * Namespace changed to dewlock:.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { createAccount, generateDelegateKey, addDelegateKey } from "@mysten-incubation/memwal/account";

// MemWal mainnet contract addresses (docs.wal.app/walrus-memory/contract/overview)
const PACKAGE_ID =
  "0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6";
const REGISTRY_ID =
  "0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd";
const RPC =
  process.env.SUI_RPC_URL ?? "https://fullnode.mainnet.sui.io:443";

// Write to apps/web/.env.local (Next.js reads from its own app dir)
const ENV_PATH = resolve(process.cwd(), "apps/web/.env.local");

function upsertEnvLocal(updates: Record<string, string>): void {
  const lines = existsSync(ENV_PATH)
    ? readFileSync(ENV_PATH, "utf8").split("\n")
    : [];
  for (const [k, v] of Object.entries(updates)) {
    const i = lines.findIndex((l) => l.startsWith(k + "="));
    if (i >= 0) lines[i] = `${k}=${v}`;
    else lines.push(`${k}=${v}`);
  }
  writeFileSync(ENV_PATH, lines.join("\n"));
}

async function suiBalanceSui(owner: string): Promise<number> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_getBalance",
      params: [owner],
    }),
  });
  const json = (await res.json()) as { result?: { totalBalance?: string } };
  return Number(json.result?.totalBalance ?? 0) / 1e9;
}

// 1) Resolve the owner keypair (reuse WALRUS_SDK_WALLET_KEY if available — same operational key)
const secret =
  process.env.SESSION_WALLET_KEY ?? process.env.WALRUS_SDK_WALLET_KEY;
const kp = secret
  ? Ed25519Keypair.fromSecretKey(secret)
  : new Ed25519Keypair();
const suiPrivateKey = kp.getSecretKey();
const address = kp.toSuiAddress();

if (!secret) {
  upsertEnvLocal({ SESSION_WALLET_KEY: suiPrivateKey });
  console.log("Created new session wallet. SESSION_WALLET_KEY written to apps/web/.env.local");
}
console.log("Owner address:", address);

// 2) Check gas
const sui = await suiBalanceSui(address);
console.log("SUI balance:", sui);
if (sui < 0.05) {
  console.error(
    `\nInsufficient gas. Send ~0.1 SUI (mainnet) to:\n  ${address}\nThen re-run: pnpm provision`,
  );
  process.exit(1);
}

// 3) Create MemWal account on-chain
console.log("\nCreating MemWal account...");
const account = (await createAccount({
  packageId: PACKAGE_ID,
  registryId: REGISTRY_ID,
  suiPrivateKey,
  network: "mainnet",
})) as string | Record<string, string>;
const accountId =
  typeof account === "string"
    ? account
    : (account.accountId ?? account.objectId ?? account.id);
if (!accountId) throw new Error("Could not get accountId: " + JSON.stringify(account));
console.log("   accountId:", accountId);

// 4) Generate delegate key + register on-chain
console.log("Generating delegate key...");
const delegate = await generateDelegateKey();
await addDelegateKey({
  packageId: PACKAGE_ID,
  accountId,
  publicKey: delegate.publicKey,
  label: "dewlock-copilot",
  suiPrivateKey,
  network: "mainnet",
});

// 5) Write to .env.local
upsertEnvLocal({
  MEMWAL_ACCOUNT_ID: accountId,
  MEMWAL_DELEGATE_KEY: delegate.privateKey,
});
console.log("\nProvisioned! MEMWAL_ACCOUNT_ID + MEMWAL_DELEGATE_KEY written to apps/web/.env.local");
console.log("Run health check: pnpm health");
