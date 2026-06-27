/**
 * test-burner-wallet — a Wallet-Standard wallet wrapping the dev burner keypair, so dapp-kit
 * (`<WalletProvider autoConnect>`) can connect WITHOUT a real wallet extension.
 *
 * SECURITY: registration is gated by isTestWalletEnabled() (build-flag + localhost). The signing
 * features use a throwaway key — only meaningful on devnet/localnet with faucet funds. See
 * test-burner-keypair.ts. NEVER use with real mainnet assets.
 */

import { Transaction } from "@mysten/sui/transactions";
import { toBase64, fromBase64 } from "@mysten/sui/utils";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  ReadonlyWalletAccount,
  registerWallet,
  SUI_CHAINS,
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  SuiSignAndExecuteTransaction,
  SuiSignPersonalMessage,
  SuiSignTransaction,
  type StandardConnectMethod,
  type StandardEventsOnMethod,
  type SuiSignAndExecuteTransactionMethod,
  type SuiSignPersonalMessageMethod,
  type SuiSignTransactionMethod,
  type Wallet,
} from "@mysten/wallet-standard";
import {
  isTestWalletEnabled,
  loadOrCreateBurnerKeypair,
  testNetwork,
  testSuiClient,
  type TestNetwork,
} from "./test-burner-keypair";

export const BURNER_WALLET_NAME = "Dewlock Test Wallet (burner)";

// A neutral inline icon so the connect modal renders the wallet.
const ICON =
  "data:image/svg+xml;base64," +
  (typeof btoa !== "undefined"
    ? btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" rx="6" fill="#4DA2FF"/><text x="12" y="17" font-size="13" text-anchor="middle" fill="#fff">T</text></svg>',
      )
    : "");

function clientForChain(chain: string) {
  const net: TestNetwork = chain.endsWith("devnet")
    ? "devnet"
    : chain.endsWith("localnet")
      ? "localnet"
      : chain.endsWith("mainnet")
        ? "mainnet"
        : testNetwork();
  return testSuiClient(net);
}

class BurnerWallet implements Wallet {
  readonly #keypair: Ed25519Keypair;
  readonly #account: ReadonlyWalletAccount;
  #listeners: Array<() => void> = [];

  constructor(keypair: Ed25519Keypair) {
    this.#keypair = keypair;
    this.#account = new ReadonlyWalletAccount({
      address: keypair.getPublicKey().toSuiAddress(),
      publicKey: keypair.getPublicKey().toRawBytes(),
      chains: SUI_CHAINS,
      features: [SuiSignTransaction, SuiSignAndExecuteTransaction, SuiSignPersonalMessage],
    });
  }

  get version() {
    return "1.0.0" as const;
  }
  get name() {
    return BURNER_WALLET_NAME;
  }
  get icon() {
    return ICON as `data:image/svg+xml;base64,${string}`;
  }
  get chains() {
    return SUI_CHAINS;
  }
  get accounts() {
    return [this.#account];
  }

  get features() {
    return {
      [StandardConnect]: { version: "1.0.0", connect: this.#connect },
      [StandardDisconnect]: { version: "1.0.0", disconnect: async () => {} },
      [StandardEvents]: { version: "1.0.0", on: this.#on },
      [SuiSignTransaction]: { version: "2.0.0", signTransaction: this.#signTransaction },
      [SuiSignAndExecuteTransaction]: {
        version: "2.0.0",
        signAndExecuteTransaction: this.#signAndExecute,
      },
      [SuiSignPersonalMessage]: { version: "1.1.0", signPersonalMessage: this.#signPersonalMessage },
    };
  }

  #connect: StandardConnectMethod = async () => ({ accounts: this.accounts });

  #on: StandardEventsOnMethod = (_event, listener) => {
    this.#listeners.push(listener as () => void);
    return () => {
      this.#listeners = this.#listeners.filter((l) => l !== listener);
    };
  };

  #signTransaction: SuiSignTransactionMethod = async ({ transaction, chain }) => {
    const client = clientForChain(chain ?? `sui:${testNetwork()}`);
    const tx = Transaction.from(await transaction.toJSON());
    const bytes = await tx.build({ client });
    const { signature } = await this.#keypair.signTransaction(bytes);
    return { bytes: toBase64(bytes), signature };
  };

  #signAndExecute: SuiSignAndExecuteTransactionMethod = async ({ transaction, chain }) => {
    const client = clientForChain(chain ?? `sui:${testNetwork()}`);
    const tx = Transaction.from(await transaction.toJSON());
    const bytes = await tx.build({ client });
    const { signature } = await this.#keypair.signTransaction(bytes);
    const res = await client.executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: { showRawEffects: true },
    });
    return {
      digest: res.digest,
      bytes: toBase64(bytes),
      signature,
      effects: toBase64(Uint8Array.from(res.rawEffects ?? [])),
    };
  };

  #signPersonalMessage: SuiSignPersonalMessageMethod = async ({ message }) => {
    const msg = message instanceof Uint8Array ? message : fromBase64(message as unknown as string);
    const { signature } = await this.#keypair.signPersonalMessage(msg);
    return { bytes: toBase64(msg), signature };
  };
}

let registered = false;

/** Register the burner wallet once (dev-gated). No-op on the deployed app. */
export function registerBurnerWallet(): void {
  if (registered || !isTestWalletEnabled()) return;
  registered = true;
  registerWallet(new BurnerWallet(loadOrCreateBurnerKeypair()));
}
