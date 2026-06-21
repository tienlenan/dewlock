/**
 * Tests: getExistingBalanceManagers resolves BMs from creation EVENTS, not the registry.
 *
 * Regression for the "account cũ" bug: createAndShareBalanceManager never registers the
 * BM, so the registry-based getBalanceManagerIds returned [] forever → returning users
 * were wrongly shown onboarding and could mint duplicates. Resolution now scans the
 * sender's `balance_manager::BalanceManagerEvent`s (owner === sender), paginated + capped.
 */

import { describe, it, expect, vi } from "vitest";
import { getExistingBalanceManagers } from "../deepbook/balance-manager";

const SENDER = "0x" + "5".repeat(64);
const BM = "0x" + "6".repeat(64);
const OTHER_BM = "0x" + "7".repeat(64);
const EVENT_TYPE = "0xcaf6::balance_manager::BalanceManagerEvent";

function clientWith(pages: Array<{ data: unknown[]; hasNextPage?: boolean; nextCursor?: unknown }>) {
  const queryEvents = vi.fn();
  pages.forEach((p) => queryEvents.mockResolvedValueOnce({ hasNextPage: false, nextCursor: null, ...p }));
  return { client: { queryEvents } as never, queryEvents };
}

describe("getExistingBalanceManagers — event-based resolution", () => {
  it("finds a BM from a creation event owned by the sender", async () => {
    const { client } = clientWith([
      { data: [{ type: EVENT_TYPE, parsedJson: { balance_manager_id: BM, owner: SENDER } }] },
    ]);
    const r = await getExistingBalanceManagers(client, SENDER);
    expect(r).toEqual({ status: "ok", ids: [BM] });
  });

  it("ignores events owned by someone else and non-BM events", async () => {
    const { client } = clientWith([
      {
        data: [
          { type: EVENT_TYPE, parsedJson: { balance_manager_id: OTHER_BM, owner: "0x" + "9".repeat(64) } },
          { type: "0x2::coin::SomethingElse", parsedJson: { balance_manager_id: BM, owner: SENDER } },
          { type: EVENT_TYPE, parsedJson: { balance_manager_id: BM, owner: SENDER } },
        ],
      },
    ]);
    const r = await getExistingBalanceManagers(client, SENDER);
    expect(r).toEqual({ status: "ok", ids: [BM] });
  });

  it("returns [] (status ok) when the sender created no BM", async () => {
    const { client } = clientWith([{ data: [] }]);
    expect(await getExistingBalanceManagers(client, SENDER)).toEqual({ status: "ok", ids: [] });
  });

  it("follows pagination to find a BM on a later page", async () => {
    const { client, queryEvents } = clientWith([
      { data: [{ type: "0x2::x::Y", parsedJson: {} }], hasNextPage: true, nextCursor: { eventSeq: "1", txDigest: "d" } },
      { data: [{ type: EVENT_TYPE, parsedJson: { balance_manager_id: BM, owner: SENDER } }] },
    ]);
    const r = await getExistingBalanceManagers(client, SENDER);
    expect(r).toEqual({ status: "ok", ids: [BM] });
    expect(queryEvents).toHaveBeenCalledTimes(2);
  });

  it("reports rpc_error (NOT empty) when the event query throws — never mints a duplicate", async () => {
    const client = { queryEvents: vi.fn().mockRejectedValue(new Error("rpc down")) } as never;
    expect(await getExistingBalanceManagers(client, SENDER)).toEqual({ status: "rpc_error", ids: [] });
  });
});
