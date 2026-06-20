/**
 * GET /api/ecosystem/tvl — top Sui protocols by Sui-chain TVL (DefiLlama SDK,
 * keyless). Server-side only; read-only public market data, no secrets.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ecosystemOptions, ecosystemResponse } from "@/lib/ecosystem/respond";
import { getTopTvlProtocols } from "@/lib/ecosystem/top-tvl";

export async function OPTIONS(req: NextRequest) {
  return ecosystemOptions(req);
}

export async function GET(req: NextRequest) {
  return ecosystemResponse(req, "ecosystem-tvl", (limit) => getTopTvlProtocols(limit));
}
