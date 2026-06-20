/**
 * GET /api/ecosystem/tokens — trending Sui tokens (CoinGecko + GeckoTerminal,
 * keyless). Server-side only; read-only public market data, no secrets.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ecosystemOptions, ecosystemResponse } from "@/lib/ecosystem/respond";
import { getTrendingTokens } from "@/lib/ecosystem/trending-tokens";

export async function OPTIONS(req: NextRequest) {
  return ecosystemOptions(req);
}

export async function GET(req: NextRequest) {
  return ecosystemResponse(req, "ecosystem-tokens", (limit) => getTrendingTokens(limit));
}
