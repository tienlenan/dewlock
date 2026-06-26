/**
 * chain-decompose-directive — builds the LLM directive for complex compound intents
 * that the regex chain parser (parseChainSteps) cannot split.
 *
 * WHY a separate directive: when parseChainSteps returns null on a chainable
 * multi-action (e.g. "finally" separator, multi-recipient, per-clause amounts),
 * we fall through to the normal agent stream. This directive tells the model to
 * call decomposeIntent with an ordered decomposition of complete single-action
 * commands — WITHOUT calling prepareTrade directly this turn.
 *
 * The moat is in decomposeIntent's execute: the LLM proposes, the deterministic
 * routeAction cross-check verifies. This directive just ensures the model knows
 * which tool to call and what shape to fill in.
 */

/**
 * Returns a short, imperative directive instructing the model to call
 * decomposeIntent for the given compound text.
 *
 * The directive is prepended to the prompt so it is the first thing the model
 * reads before the conversation history or user message.
 */
export function buildChainDecomposeDirective(text: string): string {
  return (
    `## Chain decompose directive\n` +
    `The user sent a multi-step compound request that requires LLM decomposition:\n` +
    `"${text}"\n\n` +
    `Call the \`decomposeIntent\` tool with \`steps\` = an ordered array of COMPLETE ` +
    `single-action command strings, one per intended action. For each step provide:\n` +
    `- \`command\`: a self-contained command (e.g. "swap 1 SUI to USDC")\n` +
    `- \`category\`: one of swap | lend | stake | send\n` +
    `- \`amountFrom\`: "explicit" if the user stated the amount; "prev-output" if this ` +
    `step consumes the prior step's output (e.g. "lend it", "send the proceeds")\n\n` +
    `Step 0 MUST have amountFrom="explicit". ` +
    `Do NOT call prepareTrade this turn. ` +
    `Do NOT produce a text explanation — only call decomposeIntent.`
  );
}
