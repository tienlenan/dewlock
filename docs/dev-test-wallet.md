# Dev Test Wallet (burner) — test without a real wallet

A dev-only **burner wallet** lets you drive the Copilot chat on `localhost` without a real wallet
extension. It registers itself via the Wallet Standard, so dapp-kit's `autoConnect` connects to it
and the chat unlocks.

> **Safety:** double-gated — `NEXT_PUBLIC_ENABLE_TEST_WALLET=1` **and** hostname is `localhost`/`127.0.0.1`.
> On the deployed app (Vercel) neither holds, so it never activates. The key is a throwaway generated
> in `localStorage`. **Never fund it with real mainnet assets.**

## Enable

Add to `apps/web/.env.local` (gitignored):

```bash
NEXT_PUBLIC_ENABLE_TEST_WALLET=1
```

Restart `pnpm --filter web dev`. A floating **⚠ TEST WALLET** panel appears bottom-left with the
burner address, network, and a faucet button. The chat connects automatically.

## Three modes

| Mode | Env | What works | What doesn't |
|------|-----|------------|--------------|
| **1. UI verify (default)** | `NEXT_PUBLIC_SUI_NETWORK` unset → mainnet | All UI **renders** (atomic toggle, recipient chips, bubble resolution, sign button). Server builds tx read-only. | Signing/execute (burner is unfunded on mainnet) — by design. |
| **2. Native send (devnet)** | client `NEXT_PUBLIC_SUI_NETWORK=devnet`; server `SUI_RPC_URL=https://fullnode.devnet.sui.io:443` | Real `send` (SUI transfer) executes end-to-end. Fund via the panel's **Request faucet**. | swap / lend / atomic composite — Cetus/NAVI aren't on devnet. |
| **3. Localnet** | run `sui start --with-faucet --force-regenesis`; client `NEXT_PUBLIC_SUI_NETWORK=localnet`; server `SUI_RPC_URL=http://127.0.0.1:9000` | Same as devnet but fully offline. | Same protocol limitation as devnet. |

**Why swap/lend/atomic can't execute off-mainnet:** the composite recipe targets the live mainnet
Cetus/NAVI/USDC packages, which don't exist on devnet/localnet. Use **mode 1** to verify their UI,
and **mode 2/3** only for native `send` execution.

## Files
- `apps/web/lib/dev/test-burner-keypair.ts` — gate, network/RPC, persisted keypair
- `apps/web/lib/dev/test-burner-wallet.ts` — Wallet-Standard wallet + `registerBurnerWallet()`
- `apps/web/components/dev/test-wallet-panel.tsx` — auto-connect + faucet panel
- `apps/web/app/providers.tsx` — `localnet` network + mounts the panel
