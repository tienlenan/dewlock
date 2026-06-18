/**
 * Dewlock landing page copy — all headline/body text in one place.
 * Sourced from docs/01, 13, 14. Honest framings enforced:
 *   - "zero user keys" (NOT a flat "0 keys" — server holds operational blob key)
 *   - Walrus proof = immutable blob + Sui-object anchor; memwal is mutable
 *   - atomic PTB = WYSIWYS vehicle, not a "structurally impossible elsewhere" claim
 *   - Genuine novelties: fail-closed Guardian + min-out re-derivation + DeepBook limit-order
 */

export const COPY = {
  nav: {
    networkBadge: "sui:mainnet",
    launchApp: "Launch app",
    anchors: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Security", href: "#security" },
      { label: "DeepBook", href: "#deepbook" },
      { label: "Receipts", href: "#receipts" },
    ],
  },

  hero: {
    eyebrow: "Sui DeFi Intent Firewall",
    headline: ["Every transaction,", "sealed before", "you sign."],
    accentWord: "sealed",
    sub: "State your intent in plain language. Dewlock builds an unsigned PTB, re-derives the math, dry-runs it — then your wallet signs exactly what you reviewed.",
    cta: { primary: "Launch app", secondary: "See the BLOCK" },
    secondaryHref: "#block-teaser",
    stats: [
      { label: "Intent firewall", desc: "NL → unsigned PTB → you sign" },
      { label: "Dry-run preview", desc: "Effects visible before confirming" },
      { label: "Walrus receipts", desc: "Content-addressed immutable log" },
    ],
  },

  blockTeaser: {
    eyebrow: "Fail-closed by design",
    headline: "Proof a BLOCK happened.",
    sub: "When the Guardian detects a lookalike address or a min-out mismatch, it refuses to build the transaction. Not a warning — a hard stop before your wallet ever sees the request.",
    blockLabel: "BLOCKED",
    blockReason: "Destination address mismatch — lookalike SuiNS detected",
    addressRows: [
      { key: "You typed", value: "888.sui", highlight: false, danger: false },
      { key: "SuiNS resolved", value: "0x3a4f…c912", highlight: false, danger: false },
      { key: "Guardian detected", value: "0x3a4f…c913", highlight: true, danger: true },
      { key: "Lookalike (.sui)", value: "888-l.sui", highlight: true, danger: true },
    ],
    minOutRow: {
      key: "Min-out re-derived",
      expected: "9,847 USDC",
      got: "847 USDC",
      verdict: "FAIL — 90% slippage vs quoted",
    },
    footer: "Transaction refused. No wallet prompt. No fee.",
  },

  howItWorks: {
    eyebrow: "How it works",
    headline: "Four steps. You sign once.",
    sub: "Agent does the heavy lifting. Your wallet is the only key that matters.",
    steps: [
      {
        number: "01",
        label: "State your intent",
        desc: "Plain language: 'swap 10 SUI to USDC' or 'limit buy DEEP at 0.0031 USDC'.",
      },
      {
        number: "02",
        label: "Agent builds one PTB",
        desc: "One unsigned programmable transaction block — atomic payload built without touching your keys.",
      },
      {
        number: "03",
        label: "Guardian re-derives + dry-runs",
        desc: "Re-checks math from first principles and dry-runs on-chain. Min-out, coin type, or destination mismatch → hard block.",
      },
      {
        number: "04",
        label: "You sign. Walrus logs.",
        desc: "Wallet receives the exact PTB you reviewed. On success, an immutable Walrus blob receipt anchored to a Sui object records the action.",
      },
    ],
  },

  deepbook: {
    eyebrow: "DeepBook limit orders",
    headline: "Wait at your price. Don't market-buy.",
    sub: "AMMs have no order book — you over-pay or miss the trade. Dewlock connects to DeepBook's central limit order book: post POST_ONLY, fill at your price or not at all.",
    caption: "Impossible on an AMM. Native to DeepBook.",
    comparison: [
      {
        label: "AMM swap",
        detail: "Price set by current pool ratio. Slippage taken at execution. No limit, no waiting.",
        verdict: "market price + slippage",
        bad: true,
      },
      {
        label: "DeepBook limit order",
        detail: "Unsigned PTB posts POST_ONLY at your price. Guardian enforces tick/lot rules. Fill or stay on book.",
        verdict: "your price or no trade",
        bad: false,
      },
    ],
    codeSnippet: `intent: "buy 500 DEEP at 0.0031 USDC"
→ POST_ONLY placeLimitOrder PTB
→ Guardian: tick ✓  lot ✓  self-match ✗ block
→ wallet signs
→ fill or resting order`,
  },

  security: {
    eyebrow: "Security model",
    headline: "Fail-closed. Not trust-me.",
    sub: "The Guardian re-derives every critical value independently. Ambiguity, simulation failure, or parse error closes the gate — no degraded modes.",
    gates: [
      {
        label: "Zero user keys server-side",
        desc: "Agent builds unsigned PTBs only. Your private key never leaves your wallet. Server holds a Walrus-blob key for receipt storage only.",
      },
      {
        label: "Min-out re-derivation",
        desc: "Re-fetches live Cetus quote, re-calculates min-received from scratch. Diverges from PTB's value beyond allowed slippage → block.",
      },
      {
        label: "Coin-type gate, not symbol",
        desc: "Assets identified by full Move type (0x2::sui::SUI), not ticker. Spoofed USDC with different contract → detected and blocked.",
      },
      {
        label: "SuiNS lookalike guard",
        desc: "Resolved 0x address pinned at intent-parse time. Lookalike .sui name resolving to a different address → hard block before PTB is built.",
      },
      {
        label: "Deterministic fail-closed",
        desc: "Simulation failure, parse error, RPC timeout → Guardian blocks, not degrades. No partial fills, no silent fallbacks.",
      },
      {
        label: "Allowlist + BalanceManager cap",
        desc: "Only whitelisted protocol contracts can be called. BalanceManager hard cap limits per-trade and daily spend.",
      },
    ],
  },

  walrus: {
    eyebrow: "Walrus receipts",
    headline: "Content-addressed. On-chain anchored.",
    sub: "Every executed or blocked transaction produces an immutable Walrus blob receipt — PTB payload, Guardian verdict, dry-run deltas — with its blob ID pinned by a Sui object.",
    receiptCard: {
      label: "Near-miss receipt",
      status: "BLOCKED",
      blobId: "3vK…x9q2",
      suiObject: "0x7f1a…b3c4",
      verdict: "min-out mismatch — 90% slippage detected",
      timestamp: "2026-06-16T04:12:33Z",
      note: "Walrus blob = immutable content-addressed proof. Sui object = mutable HEAD pointer. Agent memory is a separate mutable layer.",
    },
    features: [
      { label: "Blob ID", desc: "SHA-256 content address — immutable by construction on Walrus" },
      { label: "Sui object anchor", desc: "On-chain pointer to the latest blob ID for each wallet+action" },
      { label: "Full payload", desc: "PTB bytes, Guardian verdict, dry-run deltas, agent chain-of-thought" },
    ],
  },

  whySui: {
    eyebrow: "Built on Sui",
    headline: "The stack that makes this possible.",
    sub: "Four Sui-native capabilities that have no direct equivalent elsewhere.",
    tracks: [
      {
        label: "DeFi & Payments",
        tech: "Cetus AMM · SuiNS · PTB composition",
        desc: "Atomic multi-protocol bundles. SuiNS name resolution with anti-lookalike guard. Min-out re-derivation against the Cetus math library.",
      },
      {
        label: "DeepBook",
        tech: "@mysten/deepbook-v3 · BalanceManager",
        desc: "Central limit order book on Sui mainnet. POST_ONLY limit orders with hard spending cap via BalanceManager.",
      },
      {
        label: "Walrus",
        tech: "Walrus blob storage · Sui object anchor",
        desc: "Content-addressed immutable receipts for every action — executed or blocked. Blob is the proof; Sui object is the discoverable pointer.",
      },
      {
        label: "Agentic Web",
        tech: "Mastra agent · unsigned PTBs only",
        desc: "Natural language to on-chain action with human-in-the-loop signing. Agent builds; you authorize. Zero agent custody.",
      },
    ],
  },

  poweredBy: {
    title: "Powered by an open AI × Sui stack",
    sub: "Best-in-class agent intelligence, settled on Sui's native data and security layer — open and verifiable end to end.",
    items: [
      { key: "mastra", name: "Mastra AI", href: "https://mastra.ai", kind: "mark" },
      { key: "gemini", name: "Gemini", href: "https://deepmind.google/technologies/gemini", kind: "mark" },
      { key: "sui", name: "Sui", href: "https://sui.io", kind: "img", src: "/logos/sui.svg", w: 64, h: 33 },
      { key: "walrus", name: "Walrus", href: "https://walrus.xyz", kind: "img", src: "/logos/walrus.svg", w: 145, h: 34 },
      { key: "memwal", name: "Walrus Memory", href: "https://memory.walrus.xyz", kind: "img", src: "/logos/memwal.svg", w: 142, h: 66 },
    ],
  },

  cta: {
    headline: "Ready to sign with confidence?",
    sub: "Live on Sui mainnet. State your intent, review the preview — sign only what you approved.",
    primary: "Launch app",
    secondary: "View on GitHub",
  },

  footer: {
    tagline: "Every transaction, sealed before you sign.",
    network: "sui:mainnet",
    disclaimer:
      "Hackathon preview — unaudited. Use small amounts.",
    links: [
      { label: "GitHub", href: "https://github.com" },
      { label: "Docs", href: "#" },
      { label: "Sui Explorer", href: "https://suiexplorer.com" },
    ],
  },
} as const;
