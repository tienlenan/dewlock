/**
 * Shared explorer / Walrus URL builders — used by the receipt card + passport card
 * (extracted to avoid duplication). Templates are env-overridable.
 */

const EXPLORER_NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "mainnet";

/** Fill a suiscan-style template: substitutes {network} + the value ({id} or {digest}). */
function fillTemplate(template: string, value: string): string {
  return template.split("{network}").join(EXPLORER_NETWORK).split("{digest}").join(value).split("{id}").join(value);
}

/** Transaction explorer URL (object template's /object/ → /tx/, or an explicit tx template). */
export function buildExplorerTxUrl(txDigest: string): string {
  const objTpl = process.env.NEXT_PUBLIC_EXPLORER_OBJECT_URL_TEMPLATE;
  const txTpl =
    process.env.NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE ||
    (objTpl ? objTpl.replace("/object/", "/tx/") : "https://suiscan.xyz/{network}/tx/{digest}");
  return fillTemplate(txTpl, txDigest);
}

/** Sui object explorer URL. */
export function buildSuiObjectUrl(objectId: string): string {
  const tpl = process.env.NEXT_PUBLIC_EXPLORER_OBJECT_URL_TEMPLATE || "https://suiscan.xyz/{network}/object/{id}";
  return fillTemplate(tpl, objectId);
}

/** Walrus aggregator URL for a blob id. */
export function buildWalrusAggregatorUrl(blobId: string): string {
  const base = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ?? "https://aggregator.walrus-mainnet.walrus.space";
  return `${base}/v1/blobs/${blobId}`;
}

/** Truncate a long hash/id: first 6 + … + last 4. */
export function shortHash(hash: string): string {
  return hash.length <= 14 ? hash : `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}
