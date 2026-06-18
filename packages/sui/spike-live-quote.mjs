// LIVE read-only test: normalized SDK -> SuiGrpcClient(baseUrl) -> AggregatorClient
// -> findRouters for 2 SUI -> USDC. Confirms the quote path works post-Env-fix and
// whether the router HTTP + gRPC endpoints are reachable from here.
const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

const raw = await import("@cetusprotocol/aggregator-sdk");
const mod = raw.AggregatorClient ? raw : (raw.default ?? raw);
console.log("normalized: AggregatorClient=", typeof mod.AggregatorClient, "Env.Mainnet=", mod.Env?.Mainnet);

const grpcMod = await import("@mysten/sui/grpc");
const grpc = new grpcMod.SuiGrpcClient({ network: "mainnet", baseUrl: "https://fullnode.mainnet.sui.io:443" });

const agg = new mod.AggregatorClient({
  endpoint: "https://api-sui.cetus.zone/router_v3",
  signer: "0x0000000000000000000000000000000000000000000000000000000000000001",
  client: grpc,
  env: mod.Env.Mainnet,
});

console.log("calling findRouters for 2 SUI -> USDC ...");
const t = setTimeout(() => { console.log("TIMEOUT 20s — endpoint unreachable from sandbox"); process.exit(1); }, 20000);
try {
  const router = await agg.findRouters({
    from: SUI, target: USDC, amount: "2000000000", byAmountIn: true,
    providers: ["CETUS", "DEEPBOOK"],
  });
  clearTimeout(t);
  console.log("findRouters OK. amountOut=", router?.amountOut?.toString());
  const paths = (router?.paths ?? []).map((p) => p.provider);
  console.log("providers:", [...new Set(paths)].join(", "));
} catch (e) {
  clearTimeout(t);
  console.log("findRouters ERR:", String(e.message).split("\n")[0]);
}
process.exit(0);
