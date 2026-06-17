/**
 * Server-side fetch of the CURRENT Wormhole guardian-set index from the on-chain
 * core-state object. This MUST come from chain (never client-set / stubbed) or
 * the bridge Gate 8 silently degrades from fail-closed to advisory.
 *
 * Fail-closed: if the core-state object id isn't configured or the read fails,
 * returns undefined → checkBridgeConstraints Gate 8 BLOCKs.
 *
 * [needs live-env] set WORMHOLE_CORE_STATE_ID to the mainnet Wormhole core State
 * shared object id; verify the `guardian_set_index` field path against the live
 * object shape before a mainnet redeem.
 */

import { getSuiMainnetClient } from "@dewlock/sui";

export async function fetchCurrentGuardianSetIndex(): Promise<number | undefined> {
  const stateId = process.env.WORMHOLE_CORE_STATE_ID;
  if (!stateId) return undefined; // not configured → fail-closed at Gate 8

  try {
    const client = getSuiMainnetClient();
    const obj = await client.getObject({ id: stateId, options: { showContent: true } });
    const content = obj.data?.content;
    if (!content || content.dataType !== "moveObject") return undefined;
    const fields = (content as { fields?: Record<string, unknown> }).fields ?? {};
    const raw = fields["guardian_set_index"];
    const idx = typeof raw === "string" ? parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
    return Number.isFinite(idx) ? idx : undefined;
  } catch {
    return undefined; // read failed → fail-closed
  }
}
