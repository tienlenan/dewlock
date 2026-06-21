/**
 * Map a raw Sui sign/execute error into a concise, user-facing message.
 *
 * Validator/wallet errors for OWNED objects are verbose and alarming (multi-line dumps
 * with object ids + dozens of signer keys). Worse, the raw text invites the user to mash
 * "retry", which on Sui makes things WORSE: re-signing against the same coin object
 * equivocates it (two conflicting txs lock the object until the next epoch). This maps the
 * common owned-object failures to clear guidance and truncates everything else, so the
 * error card stays readable and the user knows NOT to spam-retry.
 */
export function friendlySignError(raw: string): string {
  const s = raw.toLowerCase();

  // Object version moved between build and sign → the prepared tx is stale.
  if (
    s.includes("unavailable for consumption") ||
    s.includes("needs to be rebuilt") ||
    s.includes("not available for consumption")
  ) {
    return "Your balances changed since this was prepared, so it went stale. Re-issue the action to rebuild it with fresh balances — don't resend the same one.";
  }

  // Owned object locked by another (in-flight/conflicting) tx → equivocation.
  if (s.includes("already locked by a different transaction") || s.includes("equivocat")) {
    return "That coin is temporarily locked by a pending transaction. Wait a few seconds and try ONCE — repeated retries lock it longer (until the next epoch). If it persists, use a different coin/amount or split your SUI into more coins.";
  }

  // Not enough gas / coverage.
  if (s.includes("insufficientgas") || (s.includes("gas") && s.includes("balance"))) {
    return "Not enough SUI to cover network gas for this transaction. Add a little SUI and try again.";
  }

  // Fallback: keep it short — never dump a multi-line validator response into the card.
  const firstLine = raw.split("\n")[0].trim();
  return `Signing failed: ${firstLine.length > 180 ? firstLine.slice(0, 180) + "…" : firstLine}`;
}
