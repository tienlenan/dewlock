# Dewlock — Deployment Guide

## Overview

Dewlock deploys as a Next.js app on Vercel. The monorepo root `vercel.json`
points the build at `apps/web`. All server-only secrets live in Vercel
environment variables — none are committed to the repo.

---

## Required Environment Variables

### Server-only (never exposed to the browser)

Set these in Vercel → Project Settings → Environment Variables under
"Server" scope. Do **not** prefix with `NEXT_PUBLIC_`.

| Variable | Purpose | Example |
|---|---|---|
| `AI_GATEWAY_API_KEY` | Anthropic AI Gateway auth key | `sk-ant-…` |
| `MEMWAL_BASE_URL` | Walrus memory service base URL | `https://mem.dewlock.xyz` |
| `MEMWAL_API_KEY` | Memory service API key | `mw_…` |
| `WALRUS_SDK_WALLET_KEY` | Ed25519 private key (base64) used to sign Walrus blob receipts — **must never hold user funds** | `<base64>` |
| `WALRUS_PUBLISHER_URL` | Walrus blob publisher endpoint | `https://publisher.walrus.site` |
| `WALRUS_AGGREGATOR_URL` | Walrus blob aggregator endpoint | `https://aggregator.walrus.site` |
| `SUI_RPC_URL` | Sui full-node RPC (mainnet) | `https://fullnode.mainnet.sui.io:443` |
| `DEWLOCK_RECEIPT_PACKAGE_ID` | Deployed `dewlock_receipt` Move package object ID | `0x…` |
| `TX_USD_CAP` | Per-transaction USD spending cap (server authority) | `5000` |
| `DAILY_USD_CAP` | Rolling 24-hour USD spending cap | `10000` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | `https://dewlock.xyz` |
| `SUI_USD_PRICE_FLOOR` | Conservative SUI/USD floor price for the cap gate | `3.0` |

### Public (exposed to browser via `NEXT_PUBLIC_` prefix)

These are safe to expose; they contain no credentials.

| Variable | Purpose | Example |
|---|---|---|
| `NEXT_PUBLIC_SUI_NETWORK` | Sui network (`mainnet` / `testnet`) | `mainnet` |
| `NEXT_PUBLIC_AGENT_URL` | URL of the `/api/agent` endpoint (can be relative `/` on Vercel) | `/` |
| `NEXT_PUBLIC_EXPLORER_OBJECT_URL_TEMPLATE` | Object explorer URL template with `{id}` placeholder | `https://suiscan.xyz/mainnet/object/{id}` |
| `NEXT_PUBLIC_TX_USD_CAP` | Client-side cap hint for UI warnings (server value is authoritative) | `5000` |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `fixture` to run fully deterministic demo with no live calls; leave empty for live mode | `fixture` |
| `NEXT_PUBLIC_APP_URL` | Canonical origin for OG/meta tags | `https://dewlock.xyz` |

---

## Pre-deploy Checklist

- [ ] Rotate `WALRUS_SDK_WALLET_KEY` — do not reuse dev/testnet keys on mainnet.
- [ ] Confirm the blob-signer wallet holds **zero user funds** (receipt-only key).
- [ ] `DEWLOCK_RECEIPT_PACKAGE_ID` set to the published Move package ID on mainnet.
- [ ] `MEMWAL_BASE_URL` provisioned (run `pnpm provision` against mainnet memwal).
- [ ] `ALLOWED_ORIGINS` set to the production domain only.
- [ ] `NEXT_PUBLIC_DEMO_MODE` is **empty** (not `fixture`) in the production environment.
- [ ] Run `pnpm audit` — zero critical vulnerabilities before first production deploy.

---

## Build Commands (Vercel auto-detects from vercel.json)

```
Install:  pnpm install --frozen-lockfile
Build:    pnpm --filter web build
Output:   apps/web/.next
```

---

## Items Requiring a Live Environment (`[needs live-env]`)

These items are implemented and unit-tested but require a live Sui wallet /
mainnet RPC / funded keys to validate end-to-end. Flag for a real-wallet
validation pass before public launch:

- **Cetus swap** — `fetchLiveQuote` + `buildLiveCetusPtb` path (Sprint 1.1)
- **Live portfolio** — `getPortfolio` with `getAllBalances` (Sprint 1.2)
- **SuiNS resolve** — forward resolve against mainnet SuiNS (Sprint 1.3)
- **Chat → tool → card → sign → receipt** full flow with AI Gateway (Sprint 1.4)
- **DeepBook limit order** — `placeLimitOrder` PTB with funded BalanceManager (Sprint 2.1)
- **Walrus blob receipt** — async receipt write with funded blob-signer key (Sprint 2.2)
- **Sui-object receipt anchor** — Move `dewlock_receipt` publish + HEAD pointer (Sprint 2.3)
- **Session persistence** — real thread storage via memwal (Sprint 3.4)
