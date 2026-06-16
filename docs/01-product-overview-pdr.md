# 01 — Product Overview / PDR

> ⚠️ **Hero framing SUPERSEDED by `13-defi-core-recenter-decision.md`.** DeFi = core; memwal = side-tech. Hero = intent-firewall (Guardian fail-closed + min-out re-derivation) + DeepBook limit-order; transfer/swap/LP are the payload the firewall guards, not the headline.
>
> 🏷️ **Working name: `Dewlock`** (runner-up `Dewpoint`) — Sui droplet / pastel-aqua theme, pending TM/WHOIS/SuiNS verification. See `14-product-naming.md`. Tagline: *Every transaction, sealed before you sign.*

## Problem

Sui DeFi fragmented (Cetus, NAVI, Scallop, Suilend…). Users lack: single portfolio view + PnL; safe natural-language way to act (transfer/swap/LP); any memory of intent, risk profile, contacts, past rationale.

## Solution

**Sui DeFi Copilot** — chat agent that:
1. Tracks portfolio (balances, LP positions, PnL) across Sui protocols.
2. Explains positions, warns on risk.
3. Turns NL intent into an **unsigned transaction**; **user signs in wallet**.
4. Remembers user across sessions (Walrus Memory) and writes immutable receipts (Walrus Blob).

Agent never custodies funds. "Agentic web" + "bảo mật cực cao" reconciled via human-in-the-loop.

## Hero scope (this round)

NL → action, all human-signed:
- **Track** — "portfolio tôi sao rồi?" → balances + Cetus LP + PnL card.
- **Transfer** — "chuyển 5 USDC tới 888.sui" → SuiNS resolve → PTB → sign.
- **Swap** — "đổi 10 SUI sang USDC" → Cetus quote → PTB → sign.
- **Add LP** — "bỏ 20 USDC vào pool SUI/USDC" → tick range → PTB → sign.
- **Confidential transfer** (devnet, feature-flag tab) — Sui's new private transfer as the novelty.

Out of scope this round: lending execution (mainnet SDK exists but defer), auto/unattended invest, cross-chain, vault tokenization.

## Locked decisions

| Topic | Decision |
|---|---|
| Custody | Human-in-the-loop; agent builds unsigned PTB only; 0 keys server-side |
| Network | Mainnet (small test portfolio) core; devnet confidential (isolated); testnet sandbox |
| Lending | Track-only / later phase (NAVI/Scallop SDKs mainnet-only) |
| Context | Hackathon submission — one polished end-to-end flow + novelty |
| Frontend | New repo, Next.js (App Router) on Vercel |
| Stack reuse | Copy Walrus memory/blob + Mastra patterns from Daily Walrus |

### Decision-shift log
Original ask: "dừng ở testnet". Revised by user → **mainnet-capable, tested small**. Reason: testnet Sui has no real DeFi liquidity; small mainnet amounts + human signing keep blast radius small while data/protocols are real. Confidential stays devnet (only network where Sui shipped it; testnet ~late 2026).

## Phasing (summary; detail in 09)

- P0 scaffold → P1 hero (track/transfer/swap/LP + security + memory/blob) → P2 lending → P3 confidential (devnet) → P4 proactive suggestions (still signed).

## Success metrics (demo)

- Each hero action executed on mainnet-small, dry-run shown, signed in wallet.
- Memory recall visibly changes a later answer (contact / risk profile).
- Receipt blob retrievable + shareable for an executed action.
- Confidential transfer works on devnet.
- Code audit: zero private-key material server-side.
