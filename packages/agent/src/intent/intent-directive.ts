/**
 * Turn a parsed Intent into a STRONG, deterministic directive injected into the
 * agent turn so the LLM calls the right tool with the right args — fixing misroutes
 * (e.g. "lending" → portfolio) and applying the counter-asset + "all" + gas rules.
 *
 * Resolves "all"/"max" to a native amount from the live balance (reserving gas for
 * native SUI). Returns null when the intent isn't confidently actionable → the
 * caller uses the normal LLM path. The Guardian still gates every value move.
 */

import { parseIntent, type IntentAmount } from "./parse-intent";
import { COIN_TYPES, COIN_DECIMALS } from "../allowlist";
import { matchContacts, type StoredContact } from "../memory/contacts";
import { getSuiMainnetClient } from "@dewlock/sui";

// Keep ~0.05 SUI for gas when swapping/sending "all" of the native gas coin.
const SUI_GAS_RESERVE_MIST = 50_000_000n;

/**
 * Sanitize a saved contact name before it goes into a directive string. A name is
 * user-controlled, so strip newlines + leading markdown control chars and cap length to
 * prevent prompt-injection (a name like "\n## ignore rules" must not break out of the line).
 */
function sanitizeName(name: string): string {
  return name.replace(/[\r\n]+/g, " ").replace(/^[#>*\-\s]+/, "").trim().slice(0, 64);
}

const ALLOWLISTED_TYPES = new Set<string>(Object.values(COIN_TYPES));
const TYPE_TO_SYMBOL = new Map<string, string>(
  Object.entries(COIN_TYPES).map(([sym, type]) => [type, sym]),
);

// Whitelisted DeepBook pool → base coin type. Satisfies prepareTrade's required
// coinTypeIn enum for limit orders (the server re-derives the effective coin/amount
// from poolKey + quantity, so this is only schema plumbing).
const LIMIT_ORDER_BASE_COIN: Record<string, string> = {
  DEEP_USDC: COIN_TYPES.DEEP,
  SUI_USDC: COIN_TYPES.SUI,
  DEEP_SUI: COIN_TYPES.DEEP,
};

function humanToNative(human: string, coinType: string): string {
  const decimals = COIN_DECIMALS[coinType] ?? 9;
  // Integer math to avoid float drift: split on the decimal point.
  const [whole, frac = ""] = human.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0")).toString();
}

/** Resolve an Intent amount to a native-units string, or null if it can't be resolved. */
async function resolveNativeAmount(
  amount: IntentAmount,
  coinType: string,
  walletAddress: string,
): Promise<string | null> {
  if (amount.kind === "exact") return humanToNative(amount.human, coinType);
  if (amount.kind === "all") {
    try {
      const bal = await getSuiMainnetClient().getBalance({ owner: walletAddress, coinType });
      let native = BigInt(bal.totalBalance ?? "0");
      if (coinType === COIN_TYPES.SUI) {
        native = native > SUI_GAS_RESERVE_MIST ? native - SUI_GAS_RESERVE_MIST : 0n;
      }
      return native > 0n ? native.toString() : null;
    } catch {
      return null; // balance unavailable → let the LLM ask
    }
  }
  return null; // "none" → amount missing, LLM should ask
}

/**
 * Build a directive string for the agent turn, or null to use the normal LLM path.
 */
export async function buildIntentDirective(
  text: string,
  walletAddress: string | undefined,
  // The wallet's authoritative friend book, supplied by the route (ESM has Walrus access;
  // this CJS module must not). Used to resolve "send to <name>" deterministically.
  contactBook: StoredContact[] = [],
): Promise<string | null> {
  const intent = parseIntent(text);
  if (!intent) return null;

  const only = (tool: string) =>
    `## Deterministic intent (high confidence)\nCall ONLY \`${tool}\`. Do not call any other tool.`;

  switch (intent.action) {
    case "portfolio":
      // A full portfolio = coin balances AND DeepBook trading accounts. getDefiPositions
      // is the ONLY source of BalanceManager (BM) accounts — forcing getPortfolio alone
      // (the old `only()` directive) hid every BM. Both are read-only, so calling both is
      // allowed under the one-value-action rule.
      return [
        `## Deterministic intent (high confidence)`,
        `The user wants their full portfolio — coin balances AND open DeFi positions.`,
        `Call BOTH \`getPortfolio\` (coin balances) and \`getDefiPositions\` (DeepBook BalanceManager accounts — open orders + settled balances — plus NAVI lending). Call no other tool and do NOT ask in prose.`,
        `getDefiPositions is the ONLY source of the user's DeepBook trading accounts (BMs); without it the BM accounts are invisible. Present both cards.`,
      ].join("\n");
    case "protocols": return only("listProtocols");
    case "stats": return only("getUserStats");
    case "receive": return only("getReceiveInfo");
    case "ecosystemYields": return only("getStablecoinYields");
    case "ecosystemTvl": return only("getTopTvl");
    case "ecosystemTokens": return only("getTrendingTokens");

    case "lend": {
      // Lending must NEVER become a portfolio call. Route by what the user already
      // gave, so we ask for exactly the missing piece — never the whole form twice.
      const actionType = intent.verb === "repay" ? "lend_repay" : "lend_deposit";
      const lendSym = intent.coinType ? TYPE_TO_SYMBOL.get(intent.coinType) : undefined;
      const hasAmount = intent.amount.kind !== "none";
      const hasCoin = Boolean(intent.coinType);
      const hasProtocol = Boolean(intent.protocol);

      // The amount token to thread through follow-up commands ("1" or "all"/"max").
      const amountToken =
        intent.amount.kind === "exact" ? intent.amount.human : intent.amount.kind === "all" ? "all" : undefined;

      // Everything present → build the lend tx directly (resolve "all" to native).
      if (hasAmount && hasCoin && hasProtocol) {
        const native =
          intent.amount.kind === "exact"
            ? humanToNative(intent.amount.human, intent.coinType!)
            : walletAddress
              ? await resolveNativeAmount(intent.amount, intent.coinType!, walletAddress)
              : null;
        if (native) {
          return [
            `## Deterministic intent (high confidence)`,
            `Call \`prepareTrade\` with EXACTLY these arguments and no other tool:`,
            `- actionType: "${actionType}"`,
            walletAddress ? `- walletAddress: "${walletAddress}"` : ``,
            `- lendingProtocol: "${intent.protocol}"`,
            `- coinTypeIn: "${intent.coinType}"`,
            `- amountInNative: "${native}"`,
            `- argProvenance: { "amount": "user_turn", "coinType": "user_turn" }`,
            `Then present the returned preview card. Do NOT call getPortfolio or any other tool.`,
          ].filter(Boolean).join("\n");
        }
        // "all"/"max" without a resolvable balance → fall through to ask the amount.
      }

      // Amount + coin known, only the protocol is missing → show the protocol PICKER
      // (small cards with live supply APY), NOT a dropdown form.
      if (hasAmount && hasCoin) {
        return [
          `## Deterministic intent (high confidence)`,
          `The user wants to ${intent.verb} ${amountToken} ${lendSym} but has not chosen a lending protocol.`,
          `Call ONLY \`getLendOptions\` (do NOT ask in prose, do NOT call prepareTrade or requestActionForm):`,
          `- coinType: "${intent.coinType}"`,
          amountToken ? `- amountHuman: "${amountToken}"` : ``,
          `- verb: "${intent.verb}"`,
        ].filter(Boolean).join("\n");
      }

      // Missing amount and/or coin → render the input FORM for just those fields.
      // Protocol is chosen later via the picker, so it is never in the form.
      const needs = [...(hasAmount ? [] : ["amount"]), ...(hasCoin ? [] : ["coin"])];
      return [
        `## Deterministic intent (high confidence)`,
        `The user wants to ${intent.verb.toUpperCase()} (lending) — a value move, NOT a balance query.`,
        `Call ONLY \`requestActionForm\` (do NOT ask in prose, do NOT call getPortfolio or prepareTrade):`,
        `- formAction: "lend"`,
        `- lendVerb: "${intent.verb}"`,
        intent.coinType ? `- coinTypeIn: "${intent.coinType}"` : ``,
        amountToken ? `- amountHuman: "${amountToken}"` : ``,
        `- needs: ${JSON.stringify(needs)}`,
      ].filter(Boolean).join("\n");
    }

    case "swap_form":
      // Bare "swap" → render the from→to swap picker (with logos + live quote),
      // NOT a prose question.
      return [
        `## Deterministic intent (high confidence)`,
        `The user typed a bare "swap" with no pair/amount.`,
        `Call ONLY \`getSwapForm\` (do NOT ask in prose, do NOT call prepareTrade or getPortfolio). Pass no args — the user picks from/to + amount in the card.`,
      ].join("\n");

    case "limit_order_form":
      // Bare/partial "place limit order" → render the DeepBook order form (pair +
      // side + price + quantity), NOT a prose question and NOT a portfolio dump.
      return [
        `## Deterministic intent (high confidence)`,
        `The user wants to place a DeepBook limit order but gave no pair/side/price/quantity.`,
        `Call ONLY \`getLimitOrderForm\` (do NOT ask in prose, do NOT call getPortfolio, getDefiPositions, or prepareTrade).`,
        intent.side ? `- side: "${intent.side}"` : ``,
        intent.poolKey ? `- poolKey: "${intent.poolKey}"` : ``,
        `Pass only the args above (omit any not listed) — the user fills the rest in the card.`,
      ].filter(Boolean).join("\n");

    case "limit_order": {
      // Complete order (from the form's deterministic marker) → build directly. The
      // base coin type satisfies prepareTrade's required coinTypeIn enum; the server
      // overrides coinTypeIn/amountInNative for limit orders from poolKey + quantity.
      const baseCoinType = LIMIT_ORDER_BASE_COIN[intent.poolKey];
      return [
        `## Deterministic intent (high confidence)`,
        `Call \`prepareTrade\` with EXACTLY these arguments and no other tool:`,
        `- actionType: "limit_order"`,
        walletAddress ? `- walletAddress: "${walletAddress}"` : ``,
        `- poolKey: "${intent.poolKey}"`,
        `- side: "${intent.side}"`,
        `- limitPrice: ${intent.limitPrice}`,
        `- limitQuantity: ${intent.limitQuantity}`,
        `- expireTimestampMs: ${intent.expireTimestampMs}`,
        `- coinTypeIn: "${baseCoinType}"   (required by schema; server overrides for limit orders)`,
        `- amountInNative: "0"   (required by schema; server derives the real amount from limitQuantity)`,
        `- argProvenance: { "amount": "user_turn" }`,
        `Then present the returned preview card. Do NOT call getPortfolio or getDefiPositions.`,
        `If prepareTrade returns an onboarding_required block, present it so the UI shows the one-time trading-account setup — do NOT retry.`,
      ].filter(Boolean).join("\n");
    }

    case "send": {
      const sym = TYPE_TO_SYMBOL.get(intent.coinType) ?? "a token";
      // Capture the token after "to …" — accept a 0x address, a name.sui, OR a bare
      // SuiNS label (e.g. "roast2026wc"). buildTransfer appends ".sui" and resolves it.
      const recTok = /\bto\s+(\S+)\s*$/i.exec(text)?.[1] ?? "";
      const hasRecipient = /^(0x[0-9a-fA-F]{6,}|[a-z0-9][a-z0-9_.-]{1,62})$/i.test(recTok);
      const hasAmount = intent.amount.kind !== "none";
      // Everything present → build directly; the LLM has the recipient + amount.
      if (hasAmount && hasRecipient) {
        // Bare-word recipient (not a 0x address, no dot → not a .sui name) → resolve it
        // against the wallet's address book DETERMINISTICALLY (the LLM never matches or
        // supplies a 0x). 1 match → send with that exact address; 2+ → contact picker;
        // 0 → fall through to the SuiNS path (buildTransfer appends ".sui").
        const bareWord = !/^0x/i.test(recTok) && !recTok.includes(".");
        if (bareWord && contactBook.length > 0) {
          const matches = matchContacts(contactBook, recTok);
          const amountHuman = intent.amount.kind === "exact" ? intent.amount.human : "all";
          if (matches.length === 1) {
            const safeName = sanitizeName(matches[0].name);
            return [
              `## Deterministic intent (high confidence)`,
              `The user wants to SEND ${amountHuman} ${sym} to saved contact "${safeName}" (resolved from the address book).`,
              `Call ONLY \`prepareTrade\` with actionType "transfer":`,
              `- recipientInput: "${matches[0].address}"   (use this EXACT address — do not modify or invent)`,
              walletAddress ? `- walletAddress: "${walletAddress}"` : ``,
              // recipient provenance is "user_turn": the user designated this recipient by name
              // THIS turn and the 0x is resolved server-side from their own wallet-signed book
              // (first-party, not injected memory/pool data) — so the injection-provenance hard
              // block must NOT fire. The standard confirm card (showing the 0x) is the human gate.
              `- argProvenance: { "recipient": "user_turn", "amount": "user_turn" }`,
              `Then present the returned preview card. Call ONLY prepareTrade — do NOT call getPortfolio.`,
            ].filter(Boolean).join("\n");
          }
          if (matches.length >= 2) {
            const candidates = matches.map((m) => ({ name: sanitizeName(m.name), address: m.address }));
            return [
              `## Deterministic intent (high confidence)`,
              `"${sanitizeName(recTok)}" matches ${matches.length} saved contacts.`,
              `Call ONLY \`requestContactPicker\` (do NOT call prepareTrade or getPortfolio):`,
              `- query: "${sanitizeName(recTok)}"`,
              `- amountHuman: "${amountHuman}"`,
              `- coinSymbol: "${sym}"`,
              `- candidates: ${JSON.stringify(candidates)}`,
            ].join("\n");
          }
          // 0 matches → fall through to the generic directive (SuiNS resolution).
        }
        return `## Deterministic intent (high confidence)\nThe user wants to SEND/transfer ${sym}. Use \`prepareTrade\` (actionType "transfer"); set argProvenance.recipient accurately. Do NOT call getPortfolio.`;
      }
      // Missing amount and/or recipient → render an input FORM (not a prose question).
      const needs = [
        ...(hasAmount ? [] : ["amount"]),
        ...(hasRecipient ? [] : ["recipient"]),
      ];
      const amountHuman = intent.amount.kind === "exact" ? intent.amount.human : undefined;
      return [
        `## Deterministic intent (high confidence)`,
        `The user wants to SEND ${sym} but is missing ${needs.join(" + ")}.`,
        `Call ONLY \`requestActionForm\` (do NOT ask in prose, do NOT call prepareTrade or getPortfolio):`,
        `- formAction: "send"`,
        `- coinTypeIn: "${intent.coinType}"`,
        amountHuman ? `- amountHuman: "${amountHuman}"` : ``,
        `- needs: ${JSON.stringify(needs)}`,
      ].filter(Boolean).join("\n");
    }

    case "swap": {
      const inSym = TYPE_TO_SYMBOL.get(intent.coinInType) ?? "the token";
      // Only allowlisted pairs can be built; otherwise explain (don't fabricate).
      if (!intent.swappable || !ALLOWLISTED_TYPES.has(intent.coinOutType)) {
        return `## Deterministic intent\nThe user wants to sell/swap ${inSym}, but that pair is not in the swap allowlist yet. Explain which tokens are currently swappable and do NOT call prepareTrade.`;
      }
      // Exact amounts ("swap 5 SUI") resolve without a wallet; only "all"/"max"
      // needs the live balance (and thus a wallet).
      const nativeAmount =
        intent.amount.kind === "exact"
          ? humanToNative(intent.amount.human, intent.coinInType)
          : walletAddress
            ? await resolveNativeAmount(intent.amount, intent.coinInType, walletAddress)
            : null;
      if (!nativeAmount) {
        // Missing amount → render the from→to swap picker with the pair pre-filled
        // (live quote + a clear "You pay / You receive" layout), not a prose question.
        return [
          `## Deterministic intent (high confidence)`,
          `The user wants to SWAP ${inSym} → ${TYPE_TO_SYMBOL.get(intent.coinOutType)} but gave no amount.`,
          `Call ONLY \`getSwapForm\` (do NOT ask in prose, do NOT call prepareTrade or getPortfolio):`,
          `- coinTypeIn: "${intent.coinInType}"`,
          `- coinTypeOut: "${intent.coinOutType}"`,
        ].join("\n");
      }
      return [
        `## Deterministic intent (high confidence)`,
        `Call \`prepareTrade\` with EXACTLY these arguments and no other tool:`,
        `- actionType: "swap"`,
        walletAddress ? `- walletAddress: "${walletAddress}"` : ``,
        `- coinTypeIn: "${intent.coinInType}"`,
        `- coinTypeOut: "${intent.coinOutType}"`,
        `- amountInNative: "${nativeAmount}"`,
        // Honor the venue the user picked in the swap card (the Guardian re-derives min-out from
        // the SAME source). Omitted → prepareTrade defaults to the aggregator best route.
        intent.swapSource ? `- swapSource: "${intent.swapSource}"` : ``,
        // Pass an explicit slippage the user stated (bps). The Guardian blocks an over-wide
        // tolerance (slippage_tolerance gate) — that block is intended, surface it.
        intent.slippageBps !== undefined ? `- slippageBps: ${intent.slippageBps}` : ``,
        `- argProvenance: { "amount": "user_turn", "coinType": "user_turn" }`,
        `Then present the returned preview card. Do NOT call getPortfolio or any other tool.`,
      ].filter(Boolean).join("\n");
    }

    case "swap_unverified": {
      const inSym = TYPE_TO_SYMBOL.get(intent.coinInType) ?? "the token";
      // Amount is immaterial — the coin_allowlist gate refuses BEFORE any build — but the
      // schema requires a native integer, so resolve best-effort and fall back to "0".
      const nativeAmount =
        intent.amount.kind === "exact"
          ? humanToNative(intent.amount.human, intent.coinInType)
          : intent.amount.kind === "all" && walletAddress
            ? await resolveNativeAmount(intent.amount, intent.coinInType, walletAddress)
            : null;
      return [
        `## Deterministic intent (high confidence)`,
        `The user wants to swap ${inSym} into a raw coin type that is NOT a recognised, verified token.`,
        `Call \`prepareTrade\` with EXACTLY these arguments and no other tool:`,
        `- actionType: "swap"`,
        walletAddress ? `- walletAddress: "${walletAddress}"` : ``,
        `- coinTypeIn: "${intent.coinInType}"`,
        `- coinTypeOutRaw: "${intent.coinOutRaw}"   (the unverified destination — do NOT set coinTypeOut)`,
        `- amountInNative: "${nativeAmount ?? "0"}"`,
        `- argProvenance: { "amount": "user_turn", "coinType": "user_turn" }`,
        `The Guardian will block this (coin_allowlist) — present the returned block card plainly. Do NOT substitute another token and do NOT call any other tool.`,
      ].filter(Boolean).join("\n");
    }
  }
}
