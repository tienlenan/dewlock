// Verify the gRPC endpoint actually serves requests (fastRouterSwap uses the gRPC
// client for on-chain coin selection during the BUILD step). Try a few candidate
// endpoints + an address-free read (reference gas price) and a coin read.
const grpcMod = await import("@mysten/sui/grpc");
const KNOWN = "0x0000000000000000000000000000000000000000000000000000000000000005"; // sui system state owner-ish; just for listCoins read attempt
const SUI = "0x2::sui::SUI";

const endpoints = [
  "https://fullnode.mainnet.sui.io:443",
  "https://fullnode.mainnet.sui.io",
  "https://sui-mainnet.mystenlabs.com:443",
];

for (const baseUrl of endpoints) {
  console.log(`\n=== ${baseUrl} ===`);
  const grpc = new grpcMod.SuiGrpcClient({ network: "mainnet", baseUrl });
  const guard = setTimeout(() => { console.log("  (still hanging ~12s)"); }, 12000);
  try {
    const gp = await grpc.getReferenceGasPrice();
    console.log("  getReferenceGasPrice OK:", JSON.stringify(gp).slice(0, 120));
  } catch (e) {
    console.log("  getReferenceGasPrice ERR:", String(e.message).split("\n")[0].slice(0, 140));
  }
  clearTimeout(guard);
}
process.exit(0);
