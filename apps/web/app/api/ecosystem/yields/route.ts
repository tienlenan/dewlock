/**
 * GET /api/ecosystem/yields — top Sui stablecoin yield pools (DefiLlama, keyless).
 * Server-side only; the ~11 MB upstream payload is filtered to top-N here and
 * never reaches the browser. Read-only public market data; no secrets.
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ecosystemOptions, ecosystemResponse } from "@/lib/ecosystem/respond";
import { getStablecoinYields } from "@/lib/ecosystem/stablecoin-yields";

export async function OPTIONS(req: NextRequest) {
  return ecosystemOptions(req);
}

export async function GET(req: NextRequest) {
  return ecosystemResponse(req, "ecosystem-yields", (limit) => getStablecoinYields(limit));
}
