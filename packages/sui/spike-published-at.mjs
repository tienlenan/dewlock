const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const DEEP = "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP";
const raw = await import("@cetusprotocol/aggregator-sdk");
const m = raw.AggregatorClient ? raw : (raw.default ?? raw);
const grpcMod = await import("@mysten/sui/grpc");
const grpc = new grpcMod.SuiGrpcClient({ network: "mainnet", baseUrl: "https://fullnode.mainnet.sui.io:443" });
const agg = new m.AggregatorClient({ endpoint: "https://api-sui.cetus.zone/router_v3", signer: "0x" + "1".repeat(64), client: grpc, env: m.Env.Mainnet });
const seen = {};
async function probe(from, target, amount, providers) {
  try {
    const r = await agg.findRouters({ from, target, amount, byAmountIn: true, providers });
    for (const p of (r?.routes ?? r?.paths ?? [])) (seen[p.provider] ??= new Set()).add(p.publishedAt);
  } catch (e) { console.log(`[${providers}] ${from.slice(0,10)}->${target.slice(0,10)} ERR`, String(e.message).split("\n")[0]); }
}
await probe(DEEP, USDC, "1000000", ["DEEPBOOK"]);
await probe(DEEP, SUI, "1000000", ["DEEPBOOK"]);
await probe(USDC, DEEP, "1000000", ["DEEPBOOK"]);
await probe(SUI, USDC, "2000000000", ["CETUS"]);
for (const [provider, pkgs] of Object.entries(seen)) console.log(`${provider}: ${[...pkgs].join(", ")}`);
process.exit(0);
