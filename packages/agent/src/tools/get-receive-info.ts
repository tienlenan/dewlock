/**
 * getReceiveInfo — read tool returning the connected wallet's receive details.
 *
 * Pure display: the user's own public address + a QR payload so others can send
 * to them (incl. "deposit from a CEX/another wallet" → the user pastes this into
 * the sender). NO key material, no signing — receiving needs only the address.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getReceiveInfo = createTool({
  id: "getReceiveInfo",
  description:
    "Return the connected wallet's receive address + QR payload so the user can " +
    "receive funds (e.g. withdraw from a CEX or another wallet TO this address). " +
    "Read-only — no signing. Use when the user asks for their address / how to receive / deposit in.",
  inputSchema: z.object({
    walletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 0x-prefixed 64-hex-char Sui address"),
  }),
  outputSchema: z.object({
    address: z.string(),
    /** QR payload — the bare address (wallets scan a Sui address directly). */
    qrData: z.string(),
    network: z.literal("mainnet"),
  }),
  execute: async (inputData) => ({
    address: inputData.walletAddress,
    qrData: inputData.walletAddress,
    network: "mainnet" as const,
  }),
});
