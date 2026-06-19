// TEMP: live testnet round-trip proving the bcs/hex `id` seam + the published seal_policy.
// Encrypt to a throwaway address, then decrypt with a SessionKey + the seal_approve PTB.
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, normalizeSuiAddress } from "@mysten/sui/utils";
import { SealClient, SessionKey } from "@mysten/seal";

const PKG = "0x15622655d10255880e5ad3e4b54f5b0d1d86740b57d58060c7a8bc4dc1f03008"; // testnet seal_policy
const SERVERS = [
  { objectId: "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", weight: 1 },
  { objectId: "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8", weight: 1 },
];

const kp = new Ed25519Keypair();
const addr = kp.getPublicKey().toSuiAddress();
const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443" });
const seal = new SealClient({ suiClient: client, serverConfigs: SERVERS, verifyKeyServers: false });

const id = normalizeSuiAddress(addr);
const data = new TextEncoder().encode(JSON.stringify([{ role: "user", text: "hello seal round-trip" }]));

const { encryptedObject } = await seal.encrypt({ threshold: 2, packageId: PKG, id, data });
console.log("encrypted bytes:", encryptedObject.length);

const sk = await SessionKey.create({ address: addr, packageId: PKG, ttlMin: 10, signer: kp, suiClient: client });
const tx = new Transaction();
tx.moveCall({ target: `${PKG}::seal_policy::seal_approve`, arguments: [tx.pure.vector("u8", fromHex(id))] });
const txBytes = await tx.build({ client, onlyTransactionKind: true });

const dec = await seal.decrypt({ data: encryptedObject, sessionKey: sk, txBytes });
const ok = new TextDecoder().decode(dec) === new TextDecoder().decode(data);
console.log("ROUNDTRIP:", ok ? "PASS ✓" : "FAIL ✗");
process.exit(ok ? 0 : 1);
