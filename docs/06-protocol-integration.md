# 06 — Protocol Integration (research captured)

Network reality, SDK packages, and gotchas. Verify exact versions at `npm install` time (incubation SDKs drift).

## Network matrix

| Capability | Mainnet | Testnet | Devnet | SDK |
|---|---|---|---|---|
| Swap / Add LP / Create pool | ✅ | ✅ (self-seed) | partial | `@cetusprotocol/cetus-sui-clmm-sdk` |
| Transfer | ✅ | ✅ | ✅ | `@mysten/sui` Transaction |
| SuiNS resolve | ✅ | ✅ | ✅ | SuiNS SDK |
| Lending (NAVI/Scallop) | ✅ | ❌ mainnet-locked | ❌ | scallop/navi SDK |
| Confidential transfers | ❌ (~late 2026) | ❌ (~late 2026) | ✅ public beta (unaudited) | Sui OSS repo |

**Decision recap:** core = mainnet small; confidential = devnet; testnet only for dev/CI integration tests (self-seeded Cetus pool).

## Cetus (swap + LP) — primary

- Package: `@cetusprotocol/cetus-sui-clmm-sdk`.
- SDK has per-network config (mainnet/testnet RPC + faucet). Init with keypair (for tests) or read-only for quoting.
- **Swap:** get pool by coin-type pair → `preswap`/quote → build swap tx → dry-run → user signs.
- **Add LP:** use `TickMath` to compute tick range from price → build add-liquidity tx.
- **Create pool (testnet seeding):** SDK `createPool` + add initial liquidity. Use Sui faucet (`getFaucetHost`, `requestSuiFromFaucetV2` from `@mysten/sui/faucet`) for gas; mint a test coin (publish a tiny test-coin Move pkg) for the non-SUI side.
- Docs: cetus-developer-docs → "Create clmm pool"; SDK tests: `CetusProtocol/cetus-clmm-sui-sdk/tests/pool.test.ts`.

## SuiNS (name → address) — for transfers

- SuiNS SDK; testnet supported (Mysten public testnet nodes resolve SuiNS).
- Init: `new SuinsClient({ client: suiClient, network: 'mainnet'|'testnet' })`.
- Forward resolve `NAME.sui` → target address. Also reverse-lookup (address → default name) for the **spoof guard** in 03.
- Docs: docs.suins.io/developer/sdk.

## Lending (NAVI / Scallop) — phase 2, mainnet only

- Scallop: `@scallop-io/sui-scallop-sdk`. **Mainnet only** — testnet has no package IDs (SDK errors). TS SDK for supply/borrow/positions.
- NAVI: SDK exists (verify package name `navi-sdk` at install). Mainnet lending markets.
- For hero round: **read-only tracking** (show lending positions) is fine; execution deferred. If executing later, use mainnet small + same dry-run/confirm gate.

## Confidential Transfers — phase 3, devnet only

- Public beta on **devnet** (June 2026), **unaudited, not production-ready**. Conceals balances + amounts; sender/receiver stay visible (auditable).
- Integration via Sui's open-source repo + SDK (devnet). Separate `SuiClient(devnet)`, separate wallet/network in UI, feature flag `NEXT_PUBLIC_FEATURE_CONFIDENTIAL`.
- Treat as a labeled "preview" demo; never route mainnet funds.
- Testnet launch scheduled ~late 2026 → revisit then to unify network.

## Testnet integration-test strategy (CI / dev)

1. Faucet SUI (`@mysten/sui/faucet`).
2. Publish a minimal test-coin Move package (mint test USDC-like).
3. Create a Cetus testnet pool SUI/testUSDC; seed liquidity.
4. Run swap/addLP/transfer flows against it → assert dry-run effects.
This gives deterministic tests without mainnet money. Hero **demo** still runs mainnet-small for realism.

## Token identity rule (security-critical)

Always operate on **coin type** (`0x..::usdc::USDC`), never display symbol. Resolve user "USDC" → the canonical mainnet USDC type via a small curated map; show the type in the tx preview. Prevents fake-token spoofing.

## Sources

- blog.sui.io/confidential-transfers-public-beta
- cetus-1.gitbook.io/cetus-developer-docs → create-clmm-pool
- docs.suins.io/developer/sdk
- github.com/scallop-io/sui-scallop-sdk
- docs.sui.io/guides/developer/getting-started/get-coins
