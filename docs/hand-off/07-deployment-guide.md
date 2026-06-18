# 07 — Deployment Guide (Vercel)

New app = Next.js on Vercel (chosen to avoid Walrus Sites cold-blob latency that hurt Daily Walrus).

## Why Vercel (not Walrus Sites)

Walrus Sites cold blobs → blank-screen/slow first paint (known pain in source repo). Vercel = instant, standard CI, env management, serverless API for the agent. Walrus is still used for **data** (memory + receipt blobs), just not for hosting.

## Deploy steps

1. Push new repo to GitHub → import in Vercel.
2. Framework preset: Next.js. Build: `pnpm build` (or `next build`). Node 20.
3. Set env vars (Vercel Project → Settings → Environment Variables) — see 04:
   - Server-only (no `NEXT_PUBLIC_`): `AI_GATEWAY_API_KEY`, `MEMWAL_*`, `WALRUS_SDK_WALLET_KEY`, `WALRUS_*`, `SUI_RPC_URL`, `SUI_DEVNET_RPC_URL`.
   - Public: `NEXT_PUBLIC_SUI_NETWORK`, `NEXT_PUBLIC_AGENT_URL`, `NEXT_PUBLIC_FEATURE_CONFIDENTIAL`, `NEXT_PUBLIC_TX_USD_CAP`.
4. Deploy. Agent runs as Route Handler / Server Action.

## Serverless constraints (carried over)

- **Function timeout:** Vercel default ~10s (Hobby) / configurable up to 60s. Walrus blob writes must use the **upload relay** to finish in time (`WALRUS_UPLOAD_RELAY_DISABLED=false`). Source repo tuned this exactly.
- Keep agent turns bounded; stream responses. Heavy multi-step jobs (if any) → background, not in-request.
- Walrus blob write = async after sign; never block the response.

## Provisioning Walrus Memory (one-time)

- Copy `provision-memwal.ts` (from `packages/walrus/scripts/`). Run once → produces `MEMWAL_ACCOUNT_ID` + `MEMWAL_DELEGATE_KEY`. Put in Vercel env. Relayer: `https://relayer.memory.walrus.xyz`.
- Health check: copy `packages/walrus/scripts/health.ts`.

## Walrus Blob signer

- `WALRUS_SDK_WALLET_KEY` (a funded Sui key) pays WAL + small SUI relay tip per blob. **Only used for blob writes — never for user-fund transactions.** Fund it with a little SUI + WAL.

## Secrets hygiene

- Never commit `.env.local`. Ship `.env.example` (template, no values) — pattern proven in source repo.
- Confirm no secret has `NEXT_PUBLIC_` prefix (that ships to the browser bundle).

## Domains / networks

- Main app → mainnet. Confidential preview → devnet (separate `SuiClient`, badge in UI). One Vercel deploy serves both; network chosen per feature.

## Pre-deploy checklist

- [ ] `pnpm build` + `pnpm typecheck` clean
- [ ] env set in Vercel (server vs public correct)
- [ ] memwal provisioned, health green
- [ ] blob signer funded (SUI + WAL)
- [ ] CORS / rate-limit on agent route
- [ ] grep: no user-fund signer key server-side
