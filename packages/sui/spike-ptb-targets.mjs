// Build a real aggregator swap PTB (mock the gRPC coin-fetch so no funds needed)
// and dump EVERY MoveCall target, so the Guardian allowlist can match exactly.
import { Transaction } from "@mysten/sui/transactions";
const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const SENDER = "0x" + "1".repeat(64);

const raw = await import("@cetusprotocol/aggregator-sdk");
const m = raw.AggregatorClient ? raw : (raw.default ?? raw);
const grpcMod = await import("@mysten/sui/grpc");
const realGrpc = new grpcMod.SuiGrpcClient({ network: "mainnet", baseUrl: "https://fullnode.mainnet.sui.io:443" });

// Proxy the grpc client: log method calls; return a synthetic coin list for coin reads
// so fastRouterSwap can assemble the PTB without the sender actually owning coins.
const fakeCoin = { coinObjectId: "0x" + "a".repeat(64), version: "1", digest: "11111111111111111111111111111111", balance: "1000000000000", coinType: SUI };
const calls = new Set();
const client = new Proxy(realGrpc, {
  get(t, p) {
    if (typeof p === "string" && /coin|object|balance/i.test(p)) {
      calls.add(p);
      return async (...a) => {
        if (/listCoins|getCoins/i.test(p)) return { data: [fakeCoin], coins: [fakeCoin], hasNextPage: false, nextCursor: null };
        if (/getBalance/i.test(p)) return { totalBalance: "1000000000000", balance: "1000000000000" };
        return Reflect.get(t, p)?.bind?.(t)?.(...a);
      };
    }
    const v = Reflect.get(t, p);
    return typeof v === "function" ? v.bind(t) : v;
  },
});

const agg = new m.AggregatorClient({ endpoint: "https://api-sui.cetus.zone/router_v3", signer: SENDER, client, env: m.Env.Mainnet });
const router = await agg.findRouters({ from: SUI, target: USDC, amount: "2000000000", byAmountIn: true, providers: ["CETUS", "DEEPBOOK"] });
console.log("route ok, amountOut", router?.amountOut?.toString());

const txb = new Transaction();
txb.setSender(SENDER);
try {
  await agg.fastRouterSwap({ router, slippage: 0.005, txb });
  const data = txb.getData();
  const targets = (data.commands ?? []).filter((c) => c.MoveCall).map((c) => `${c.MoveCall.package}::${c.MoveCall.module}::${c.MoveCall.function}`);
  console.log("\n=== ALL MoveCall targets in the swap PTB ===");
  [...new Set(targets)].forEach((t) => console.log(t));
  console.log("\ncoin-fetch methods used:", [...calls].join(", "));
} catch (e) {
  console.log("fastRouterSwap ERR:", e.stack?.split("\n").slice(0, 6).join("\n"));
  console.log("coin-fetch methods attempted:", [...calls].join(", "));
}
process.exit(0);
